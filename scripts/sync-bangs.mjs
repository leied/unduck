// Regenerates public/bangs.json from DuckDuckGo's list.
//
// Only d/t/u are kept — nothing else is read anywhere. Upstream also ships `r`,
// a popularity rank that churns on every refresh and would bury the real
// additions under thousands of meaningless diff lines.
//
// Entries whose `u` is relative (DuckDuckGo-internal bangs like !assist, which
// point at paths on duckduckgo.com) are dropped. Resolved against this origin
// they bounce back into the redirector, and Response.redirect rejects them
// outright. Dropping them makes those bangs fall through to a normal search.
//
// Locally-added bangs are detected as "any entry whose `t` upstream doesn't
// have" rather than from a hardcoded list, so adding a new one needs no change
// here. The tradeoff: a bang DuckDuckGo *removes* looks identical to a local
// addition and gets kept forever. Preserving a dead bang beats silently
// deleting one someone uses.

import { readFile, writeFile } from "node:fs/promises";

const SRC = new URL("../public/bangs.json", import.meta.url);
const UPSTREAM = "https://duckduckgo.com/bang.js";

const absolute = (bang) => /^https?:\/\//i.test(bang?.u ?? "");
const pick = ({ d, t, u }) => ({ d, t, u });

const response = await fetch(UPSTREAM);
if (!response.ok) throw new Error(`${UPSTREAM} responded ${response.status}`);
const raw = await response.json();
if (!Array.isArray(raw) || raw.length === 0) {
  throw new Error("upstream returned no bangs; refusing to overwrite");
}

const upstream = raw.filter(absolute).map(pick);
const existing = JSON.parse(await readFile(SRC, "utf8"));

const upstreamTags = new Set(upstream.map((bang) => bang.t));
const existingTags = new Set(existing.map((bang) => bang.t));
const custom = existing.filter((bang) => !upstreamTags.has(bang.t));
const added = upstream.filter((bang) => !existingTags.has(bang.t));

// One object per line: valid JSON, but diffs stay one line per bang.
const body = [...custom, ...upstream].map((bang) => JSON.stringify(bang)).join(",\n");
await writeFile(SRC, `[\n${body}\n]\n`);

console.log(
  `upstream ${upstream.length} (${raw.length - upstream.length} relative dropped) · ` +
    `kept ${custom.length} local · added ${added.length}`,
);
if (custom.length) console.log(`  local: ${custom.map((bang) => bang.t).join(", ")}`);
if (added.length) console.log(`  added: ${added.map((bang) => bang.t).join(", ")}`);
