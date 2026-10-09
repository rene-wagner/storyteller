import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.mjs"],
        },
      },
      "./apps/web/vitest.config.mts",
    ],
  },
});
