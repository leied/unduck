// Same file the service worker fetches at runtime, bundled in here so the
// cold-start path (before the service worker exists) resolves without a lookup.
import bangs from "../public/bangs.json";
import { resolveRedirectUrl } from "../src/bang-redirect";

// Built once per isolate and reused across every request it handles.
const bangMap = new Map(bangs.map((b) => [b.t, b]));

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/__reset") {
      // Clear-Site-Data wipes the browser's HTTP cache and "storage" (which
      // covers Cache Storage and service worker registrations), so a stuck or
      // stale-cached client can recover just by visiting this URL — no JS
      // required on their end beyond the redirect below.
      return new Response(
        `<!doctype html>
<meta charset="utf-8">
<title>Reset complete</title>
<script>location.replace("/?reset=" + Date.now())</script>
Resetting…`,
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Clear-Site-Data": '"cache", "storage"',
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    if (url.pathname === "/") {
      const query = url.searchParams.get("q");
      if (query !== null) {
        const redirectUrl = resolveRedirectUrl(query, (t) => bangMap.get(t));
        if (redirectUrl) {
          // No Referrer-Policy header on a bare Response.redirect() means the
          // browser falls back to strict-origin-when-cross-origin and still
          // sends this origin as the Referer on the hop to the destination.
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl,
              "Referrer-Policy": "no-referrer",
            },
          });
        }
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
