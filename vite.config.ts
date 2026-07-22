import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // We register the SW ourselves in main.ts, immediately on load rather
      // than on the `load` event, so it has a chance to install even on a
      // visit that's about to navigate away via a bang redirect.
      injectRegister: false,
    }),
  ],
});
