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
          return Response.redirect(redirectUrl, 302);
        }
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
