export type Bang = {
  d: string;
  t: string;
  u: string;
};

// No bang at all: plain query goes straight to Google.
export const DEFAULT_SEARCH_TEMPLATE = "https://www.google.com/search?udm=50&q={{{s}}}";
// A bare "!" with no bang text attached (e.g. "! cats") is an "empty bang".
export const EMPTY_BANG_SEARCH_TEMPLATE = "https://www.google.ch/search?q={{{s}}}";

function buildUrl(template: string, query: string) {
  return template.replace("{{{s}}}", encodeURIComponent(query).replace(/%2F/g, "/"));
}

/**
 * Resolves a raw `q` search param into a redirect URL. `findBang` is injected so
 * callers can back it with whatever lookup structure they have (Map on the server,
 * Array#find on the client).
 */
export function resolveRedirectUrl(
  rawQuery: string,
  findBang: (bangText: string) => Bang | undefined,
): string | null {
  const query = rawQuery.trim();
  if (!query) return null;

  const match = query.match(/!(\S*)/i);
  const bangToken = match?.[1];
  const cleanQuery = match ? query.replace(/!\S*\s*/i, "").trim() : query;

  if (bangToken === undefined) {
    return buildUrl(DEFAULT_SEARCH_TEMPLATE, query);
  }

  if (bangToken === "") {
    return buildUrl(EMPTY_BANG_SEARCH_TEMPLATE, cleanQuery);
  }

  const selectedBang = findBang(bangToken.toLowerCase());
  if (!selectedBang) {
    return buildUrl(DEFAULT_SEARCH_TEMPLATE, cleanQuery || query);
  }

  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (cleanQuery === "") return `https://${selectedBang.d}`;

  return buildUrl(selectedBang.u, cleanQuery);
}
