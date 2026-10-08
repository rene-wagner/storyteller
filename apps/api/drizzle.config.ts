import { defineConfig } from "drizzle-kit";
import { parseConfig } from "./src/config.ts";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: parseConfig(process.env).DATABASE_URL },
});
