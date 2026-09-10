/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { resolveRedirectUrl, type Bang } from "./bang-redirect";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const BANGS_URL = "/bangs.json";
const BANGS_CACHE = "bangs-v1";
const FETCHED_AT = "x-fetched-at";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

precacheAndRoute(self.__WB_MANIFEST);

// Parsing 1.4MB of JSON and building the lookup costs real time, so it is held
// for as long as the worker stays alive. Cleared whenever the data is replaced.
let lookup: Promise<Map<string, Bang>> | null = null;

async function download(): Promise<Bang[]> {
  const response = await fetch(BANGS_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${BANGS_URL} responded ${response.status}`);
  const body = await response.text();
  const bangs: Bang[] = JSON.parse(body);
  if (!Array.isArray(bangs) || bangs.length === 0) {
    throw new Error("refusing to cache an empty bang list");
  }
  const cache = await caches.open(BANGS_CACHE);
  await cache.put(
    BANGS_URL,
    new Response(body, {
      headers: { "Content-Type": "application/json", [FETCHED_AT]: String(Date.now()) },
    }),
  );
  lookup = null;
  return bangs;
}

async function cached(): Promise<{ bangs: Bang[]; fetchedAt: number } | null> {
  const response = await (await caches.open(BANGS_CACHE)).match(BANGS_URL);
  if (!response) return null;
  return {
    bangs: await response.json(),
    fetchedAt: Number(response.headers.get(FETCHED_AT) ?? 0),
  };
}

function toLookup(bangs: Bang[]) {
  return new Map(bangs.map((bang) => [bang.t, bang]));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Best effort: a failed warm just means the first search falls through to the
  // Worker, which redirects correctly anyway.
  event.waitUntil(download().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("bangs-") && key !== BANGS_CACHE)
          .map((key) => caches.delete(key)),
      );
    })(),
  );
});

async function redirect(event: FetchEvent, query: string): Promise<Response> {
  const store = await cached();

  if (store && Date.now() - store.fetchedAt > MAX_AGE_MS) {
    event.waitUntil(download().catch(() => undefined));
  }

  // A query with no bang needs no lookup at all, so the common case never
  // touches the cached list.
  let find: (tag: string) => Bang | undefined = () => undefined;
  if (/!\S/.test(query)) {
    if (!store) {
      event.waitUntil(download().catch(() => undefined));
      return fetch(event.request);
    }
    lookup ??= Promise.resolve(toLookup(store.bangs));
    const map = await lookup;
    find = (tag) => map.get(tag);
  }

  const destination = resolveRedirectUrl(query, find);
  if (!destination) return fetch(event.request);

  // Response.redirect throws on anything that isn't an absolute URL. Letting
  // that reach the catch below would still be correct, but checking here keeps
  // a malformed entry from looking like a transport failure.
  new URL(destination);
  return Response.redirect(destination, 302);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname !== "/") return;

  const query = url.searchParams.get("q")?.trim();
  if (!query) return;

  // Anything unexpected falls through to the network, where the Worker issues
  // the same redirect. A broken service worker costs speed, never the search.
  event.respondWith(redirect(event, query).catch(() => fetch(request)));
});
