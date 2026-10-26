import { fileURLToPath } from "node:url";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwind()],
  resolve: {
    alias:
      mode === "demo"
        ? [
            {
              find: /^\.\/api\.js$/,
              replacement: fileURLToPath(new URL("./src/demo/api.ts", import.meta.url)),
            },
          ]
        : [],
  },
  build: { outDir: mode === "demo" ? "dist-demo" : "dist" },
  server: {
    port: mode === "demo" ? 4312 : undefined,
    strictPort: true,
    proxy:
      mode === "demo" ? undefined : { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 4311}` },
  },
  preview: {
    strictPort: true,
    proxy:
      mode === "demo" ? undefined : { "/api": `http://127.0.0.1:${process.env.API_PORT ?? 4311}` },
  },
}));
