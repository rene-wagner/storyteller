import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/*.tsbuildinfo",
    "docs/**",
    "AGENTS.md",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  vue.configs["flat/recommended"],
  {
    files: ["**/*.mjs", "apps/api/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/**/*.{ts,vue}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  prettier,
]);
