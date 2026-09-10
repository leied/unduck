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
      // Clear-Site-Data is the belt; the script is the suspenders. On Firefox
      // for Android the header alone has not reliably killed an
      // already-controlling service worker in testing, so this also
      // unregisters and deletes caches directly — the same origin-scoped
      // APIs the old in-page "clear cache" button used, which is why they're
      // reliable here even where the header isn't.
      return new Response(
        `<!doctype html>
<meta charset="utf-8">
<title>Reset complete</title>
<script>
(async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  location.replace("/?reset=" + Date.now());
})();
</script>
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
