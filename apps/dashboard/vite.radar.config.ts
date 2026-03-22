// Dedicated Vite config builds only the radar page as dist-radar/index.html.
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone config keeps output minimal for Netlify single-page deploy.
export default defineConfig({
  plugins: [react()],
  // We skip copying shared public assets so output remains radar-only.
  publicDir: false,
  build: {
    outDir: "dist-radar",
    emptyOutDir: true,
    rollupOptions: {
      // We force the output HTML name to index.html for easy Netlify publish.
      input: {
        index: path.resolve(__dirname, "radar.html"),
      },
    },
  },
});
