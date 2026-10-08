import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

const projectColumns = [
  "id",
  "title",
  "genre",
  "description",
  "created_at",
  "updated_at",
];

// The tests need a migrated PostgreSQL database; ordinary repository tests do not.
test.skipIf(!process.env.DATABASE_URL)(
  "baseline and project migrations create only the required project columns",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);

    const migrations = await db.$client.query(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    expect(migrations.rows.map((migration) => migration.id)).toEqual(
      expect.arrayContaining([1, 2]),
    );

    const columns = await db.$client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
      ORDER BY ordinal_position
    `);
    expect(columns.rows).toEqual(
      projectColumns.map((column_name) => ({
        column_name,
        is_nullable: "NO",
      })),
    );
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "projects generate IDs and timestamps and reject duplicate IDs or null fields",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);

    // A dedicated client keeps all constraint probes inside a rollback-only transaction.
    const client = await db.$client.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [project],
      } = await client.query(
        `INSERT INTO projects (title, genre, description)
         VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`,
        ["Pilot", "Mystery", "Intro"],
      );
      expect(project.id).toMatch(/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i);
      expect(project.created_at).toBeInstanceOf(Date);
      expect(project.updated_at).toBeInstanceOf(Date);

      await client.query("SAVEPOINT probe");
      await expect(
        client.query(
          `INSERT INTO projects (id, title, genre, description)
           VALUES ($1, $2, $3, $4)`,
          [project.id, "Another", "Comedy", "Duplicate key"],
        ),
      ).rejects.toMatchObject({ code: "23505" });
      await client.query("ROLLBACK TO SAVEPOINT probe");

      for (const column of projectColumns) {
        // Explicit NULL probes bypass Drizzle's required-field types to exercise PostgreSQL.
        const values = [
          project.id,
          "Pilot",
          "Mystery",
          "Intro",
          new Date(),
          new Date(),
        ];
        values[projectColumns.indexOf(column)] = null;
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            `INSERT INTO projects (id, title, genre, description, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            values,
          ),
        ).rejects.toMatchObject({ code: "23502", column });
        await client.query("ROLLBACK TO SAVEPOINT probe");
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);
