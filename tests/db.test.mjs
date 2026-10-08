import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

test.skipIf(!process.env.DATABASE_URL)(
  "Drizzle connects to PostgreSQL with the validated database URL",
  async () => {
    const config = parseConfig(process.env);
    const { db, close } = createDatabase(config);
    onTestFinished(close);
    const result = await db.$client.query("select 1 as connected");
    expect(result.rows[0]).toMatchObject({ connected: 1 });
  },
);
