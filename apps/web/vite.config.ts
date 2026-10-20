import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 4311}` },
  },
  preview: {
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 4311}` },
  },
});
