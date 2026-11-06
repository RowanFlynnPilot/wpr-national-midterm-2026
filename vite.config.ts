import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works on GitHub Pages, inside a WordPress iframe, or any subpath.
// share.html is the 1200×630 Open Graph card, rendered to share.png by scripts/share-image.mjs.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), share: resolve(import.meta.dirname, "share.html") },
    },
  },
});
