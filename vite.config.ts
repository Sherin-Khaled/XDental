import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT and BASE_PATH are provided by Replit workflows.
// Locally they default to 5173 and "/" so the dev server just works.
const port     = Number(process.env.PORT)     || 5173;
const basePath = process.env.BASE_PATH        || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root:  path.resolve(import.meta.dirname),
  build: {
    outDir:     path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split vendor chunks to keep the main bundle small
        manualChunks: {
          "motion":        ["framer-motion"],
          "ui-radix":      [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host:       "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
  },
});
