import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function getCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(getCommitHash()),
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // We register the SW ourselves in main.ts, immediately on load rather
      // than on the `load` event, so it has a chance to install even on a
      // visit that's about to navigate away via a bang redirect.
      injectRegister: false,
      workbox: {
        // A new SW takes over (and precached assets get pruned) as soon as
        // it finishes installing, instead of waiting for every open tab to
        // close. Since this app redirects away almost immediately, tabs
        // rarely stick around long enough for the usual "next reload" update
        // path to kick in.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Search navigations have to reach the Worker so it answers with a 302,
        // which the browser treats as a continuation of the user's own omnibox
        // navigation (Sec-Fetch-Site: none, Sec-Fetch-User: ?1). Letting the
        // default navigateFallback serve the precached shell instead pushes the
        // redirect into JS, which arrives as a script-initiated cross-site
        // navigation with no user activation — Google interrupts those with a
        // confirmation prompt.
        navigateFallbackDenylist: [/[?&]q=/],
      },
    }),
  ],
});
