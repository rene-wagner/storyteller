import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
