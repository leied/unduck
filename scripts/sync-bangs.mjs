// Regenerates src/bang.ts from DuckDuckGo's list.
//
// Only d/t/u are kept — the app reads nothing else. Upstream also ships `r`, a
// popularity rank that churns on every refresh, so keeping it would bury the
// handful of real additions under thousands of meaningless diff lines and make
// a scheduled sync impossible to review.
//
// Locally-added bangs are detected as "any entry whose `t` upstream doesn't
// have" rather than from a hardcoded list, so adding a new one needs no change
// here. The tradeoff: a bang DuckDuckGo *removes* looks identical to a local
// addition and gets kept forever. Preserving a dead bang beats silently
// deleting one someone uses.
//
// Existing entries are read with regexes rather than evaluated. This file is
// regenerated from a third-party response, so treating it as code on the next
// run would hand upstream a way to execute here.

import { readFile, writeFile } from "node:fs/promises";

const SRC = new URL("../src/bang.ts", import.meta.url);
const UPSTREAM = "https://duckduckgo.com/bang.js";
const FIELDS = ["d", "t", "u"];
const ENTRY = /^ {2}\{\n(?: {4}[^\n]*\n)+ {2}\},/gm;

// Prettier switches a value to single quotes when it contains double quotes,
// so both literal styles show up in the file.
function readField(entry, name) {
  const match = entry.match(
    new RegExp(String.raw`^ {4}${name}: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),$`, "m"),
  );
  if (!match) return undefined;
  const literal = match[1];
  if (literal.startsWith('"')) return JSON.parse(literal);
  const inner = literal.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"');
  return JSON.parse(`"${inner}"`);
}

function format(bang) {
  const lines = FIELDS.map((field) => {
    const value = JSON.stringify(bang[field]).replace(
      /[-￿]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
    return `    ${field}: ${value},`;
  });
  return `  {\n${lines.join("\n")}\n  },`;
}

const response = await fetch(UPSTREAM);
if (!response.ok) throw new Error(`${UPSTREAM} responded ${response.status}`);
const upstream = await response.json();
if (!Array.isArray(upstream) || upstream.length === 0) {
  throw new Error("upstream returned no bangs; refusing to overwrite");
}

const entries = (await readFile(SRC, "utf8")).match(ENTRY) ?? [];
if (entries.length === 0) throw new Error("could not parse src/bang.ts; refusing to overwrite");

const upstreamTags = new Set(upstream.map((bang) => bang.t));
const existingTags = new Set();
const custom = [];

for (const entry of entries) {
  const bang = Object.fromEntries(FIELDS.map((field) => [field, readField(entry, field)]));
  if (FIELDS.some((field) => bang[field] === undefined)) {
    throw new Error(`entry missing d/t/u:\n${entry}`);
  }
  existingTags.add(bang.t);
  if (!upstreamTags.has(bang.t)) custom.push(bang);
}

const added = upstream.filter((bang) => !existingTags.has(bang.t));
const body = [...custom, ...upstream].map(format).join("\n");

await writeFile(
  SRC,
  `// This file was (mostly) ripped from ${UPSTREAM}\n\nexport const bangs = [\n${body}\n];\n`,
);

console.log(`upstream ${upstream.length} · kept ${custom.length} local · added ${added.length}`);
if (custom.length) console.log(`  local: ${custom.map((bang) => bang.t).join(", ")}`);
if (added.length) console.log(`  added: ${added.map((bang) => bang.t).join(", ")}`);
