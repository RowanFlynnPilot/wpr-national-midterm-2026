import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works on GitHub Pages, inside a WordPress iframe, or any subpath.
// share.html is the 1200×630 Open Graph card, rendered to share.png by scripts/share-image.mjs.
// compact.html is the balance-of-power module; race.html embeds one race in an article; partners.html is the page for
// other newsrooms that want to embed the results with their own state up front.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        share: resolve(import.meta.dirname, "share.html"),
        compact: resolve(import.meta.dirname, "compact.html"),
        race: resolve(import.meta.dirname, "race.html"),
        partners: resolve(import.meta.dirname, "partners.html"),
      },
    },
  },
});
