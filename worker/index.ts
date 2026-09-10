import { bangs } from "../src/bang";
import { resolveRedirectUrl } from "../src/bang-redirect";

// Built once per isolate and reused across every request it handles.
const bangMap = new Map(bangs.map((b) => [b.t, b]));

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
