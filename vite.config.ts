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
      // The service worker answers search navigations with a redirect of its
      // own rather than serving the app shell, which needs hand-written fetch
      // logic. See src/sw.ts for why that specific shape avoids Google's
      // confirmation prompt.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      // We register the SW ourselves in main.ts, immediately on load rather
      // than on the `load` event, so it has a chance to install even on a
      // visit that's about to navigate away via a bang redirect.
      injectRegister: false,
      injectManifest: {
        // The bang list is fetched and refreshed by the service worker on its
        // own schedule; precaching it too would store 1.4MB twice.
        globIgnores: ["**/bangs.json"],
      },
    }),
  ],
});
