import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works on GitHub Pages, inside a WordPress iframe, or any subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
