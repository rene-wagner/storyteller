import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Config } from "../config.ts";

export function createDatabase(config: Pick<Config, "DATABASE_URL">) {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  return { db: drizzle({ client: pool }), close: () => pool.end() };
}
