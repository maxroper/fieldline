import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// The router plugin must come before the React plugin. It generates src/routeTree.gen.ts from src/routes.
// VITE_BASE sets the public path (GitHub Pages serves the demo under /<repo>/); VITE_DEMO=1 builds the
// static demo that runs the API inside the browser.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true, routesDirectory: "./src/routes", generatedRouteTree: "./src/routeTree.gen.ts" }),
    react(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  optimizeDeps: {
    // PGlite ships WebAssembly and data files that must be loaded as-is.
    exclude: ["@electric-sql/pglite"],
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 4000,
  },
  server: {
    port: 5173,
    proxy: {
      // Same-origin API in development, so cookies and server-sent events need no CORS.
      "/api": { target: process.env.VITE_API_URL ?? "http://localhost:8787", changeOrigin: true },
    },
  },
});
