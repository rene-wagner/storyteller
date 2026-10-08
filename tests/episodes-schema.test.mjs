import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

const episodeColumns = [
  "id",
  "project_id",
  "title",
  "description",
  "position",
  "created_at",
  "updated_at",
];

// These checks exercise constraints on a migrated, disposable PostgreSQL database.
test.skipIf(!process.env.DATABASE_URL)(
  "episodes have the required columns and an index for project position ordering",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const migrations = await db.$client.query(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    expect(migrations.rows.map((migration) => migration.id)).toContain(4);

    const columns = await db.$client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'episodes'
      ORDER BY ordinal_position
    `);
    expect(
      columns.rows.map(({ column_name, is_nullable }) => ({
        column_name,
        is_nullable,
      })),
    ).toEqual(
      episodeColumns.map((column_name) => ({ column_name, is_nullable: "NO" })),
    );
    expect(
      columns.rows.find(({ column_name }) => column_name === "position")
        .data_type,
    ).toBe("integer");

    const index = await db.$client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'episodes'
        AND indexname = 'episodes_project_id_position_idx'
    `);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0].indexdef).toContain('(project_id, "position")');
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "episodes persist positions and reject missing or invalid fields and projects",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const client = await db.$client.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [project],
      } = await client.query(
        "INSERT INTO projects (title, genre, description) VALUES ('Pilot', 'Mystery', 'Intro') RETURNING id",
      );
      const {
        rows: [later, earlier],
      } = await client.query(
        `INSERT INTO episodes (project_id, title, description, position)
         VALUES ($1, 'Later', 'Second', 2), ($1, 'Earlier', 'First', 0)
         RETURNING id, project_id, title, description, position, created_at, updated_at`,
        [project.id],
      );
      expect(later).toMatchObject({
        id: expect.stringMatching(/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i),
        project_id: project.id,
        title: "Later",
        description: "Second",
        position: 2,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      const { rows: sorted } = await client.query(
        "SELECT id FROM episodes WHERE project_id = $1 ORDER BY position, id",
        [project.id],
      );
      expect(sorted.map(({ id }) => id)).toEqual([earlier.id, later.id]);

      const probes = [
        {
          values: [
            later.id,
            project.id,
            "Duplicate",
            "Text",
            3,
            new Date(),
            new Date(),
          ],
          code: "23505",
        },
        {
          values: [
            null,
            project.id,
            "Title",
            "Text",
            1,
            new Date(),
            new Date(),
          ],
          code: "23502",
          column: "id",
        },
        {
          values: [
            randomUUID(),
            null,
            "Title",
            "Text",
            1,
            new Date(),
            new Date(),
          ],
          code: "23502",
          column: "project_id",
        },
        {
          values: [
            randomUUID(),
            project.id,
            null,
            "Text",
            1,
            new Date(),
            new Date(),
          ],
          code: "23502",
          column: "title",
        },
        {
          values: [
            randomUUID(),
            project.id,
            "Title",
            null,
            1,
            new Date(),
            new Date(),
          ],
          code: "23502",
          column: "description",
        },
        {
          values: [
            randomUUID(),
            project.id,
            "Title",
            "Text",
            null,
            new Date(),
            new Date(),
          ],
          code: "23502",
          column: "position",
        },
        {
          values: [
            randomUUID(),
            project.id,
            "Title",
            "Text",
            1,
            null,
            new Date(),
          ],
          code: "23502",
          column: "created_at",
        },
        {
          values: [
            randomUUID(),
            project.id,
            "Title",
            "Text",
            1,
            new Date(),
            null,
          ],
          code: "23502",
          column: "updated_at",
        },
        {
          values: [
            randomUUID(),
            randomUUID(),
            "Title",
            "Text",
            1,
            new Date(),
            new Date(),
          ],
          code: "23503",
        },
        {
          values: [
            randomUUID(),
            project.id,
            "Title",
            "Text",
            -1,
            new Date(),
            new Date(),
          ],
          code: "23514",
        },
      ];
      for (const { values, code, column } of probes) {
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            `INSERT INTO episodes (id, project_id, title, description, position, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            values,
          ),
        ).rejects.toMatchObject(column ? { code, column } : { code });
        await client.query("ROLLBACK TO SAVEPOINT probe");
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "deleting a project cascades only to its episodes",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const client = await db.$client.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [first, second],
      } = await client.query(
        `INSERT INTO projects (title, genre, description)
         VALUES ('First', 'Mystery', 'Intro'), ('Second', 'Comedy', 'Intro') RETURNING id`,
      );
      const {
        rows: [removed, retained],
      } = await client.query(
        `INSERT INTO episodes (project_id, title, description, position)
         VALUES ($1, 'One', 'Intro', 0), ($2, 'Two', 'Intro', 0) RETURNING id`,
        [first.id, second.id],
      );
      await client.query("DELETE FROM projects WHERE id = $1", [first.id]);
      const { rows } = await client.query(
        "SELECT id, project_id FROM episodes WHERE id IN ($1, $2)",
        [removed.id, retained.id],
      );
      expect(rows).toEqual([{ id: retained.id, project_id: second.id }]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);
