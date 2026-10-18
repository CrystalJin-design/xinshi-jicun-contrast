import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, process.cwd(), "VITE_").VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8790" },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("html2canvas") ? "image-export" : undefined,
      },
    },
  },
}));
