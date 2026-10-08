import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
      },
    },
  },
});
