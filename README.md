# Unduck

An AI Mode-first fix of [Theo](https://x.com/theo)'s [unduck](https://github.com/t3dotgg/unduck), plus a Cloudflare Workers enhancement: bangs still work exactly as before, but a plain query now defaults to Google's AI Mode instead of classic search, and redirects resolve at the edge instead of client side.

DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables all of DuckDuckGo's bangs to work, but much faster.

```
https://undxck.edlei.dev/?q=%s
```

## How is it that much faster?

DuckDuckGo does their redirects server side, and their DNS/routing isn't always great. Result is that it often takes ages.

Unduck runs on Cloudflare's edge network as a Worker. The bang lookup happens at the edge, right next to the visitor, and the response is a bare `302` redirect — no HTML, no JS, no client-side work. If the Worker is ever bypassed (e.g. running locally via `vite dev`), the same redirect logic runs client side instead, lazily loading the (large) bang list only when a query actually references one.

## Deploying (Cloudflare)

```bash
pnpm install
pnpm run deploy   # builds the static site, typechecks the Worker, and runs `wrangler deploy`
```

This deploys a Cloudflare Worker (see `wrangler.jsonc`) that serves the static site from `dist/` and handles `?q=` redirects at the edge (`worker/index.ts`). Requires a Cloudflare account (`wrangler login`).
