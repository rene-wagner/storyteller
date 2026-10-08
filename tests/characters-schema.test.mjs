import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

// These checks exercise PostgreSQL constraints on a migrated, disposable database.
test.skipIf(!process.env.DATABASE_URL)(
  "characters require a project and valid type, and generate IDs and timestamps",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const client = await db.$client.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [project],
      } = await client.query(
        "INSERT INTO projects (title, genre, description) VALUES ($1, $2, $3) RETURNING id",
        ["Pilot", "Mystery", "Intro"],
      );
      for (const type of ["main", "supporting"]) {
        const {
          rows: [character],
        } = await client.query(
          `INSERT INTO characters (project_id, name, type)
           VALUES ($1, $2, $3) RETURNING id, project_id, name, type, created_at, updated_at`,
          [project.id, "Alex", type],
        );
        expect(character).toMatchObject({
          id: expect.stringMatching(
            /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i,
          ),
          project_id: project.id,
          name: "Alex",
          type,
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        });
      }

      const {
        rows: [existing],
      } = await client.query(
        "SELECT id FROM characters WHERE project_id = $1 LIMIT 1",
        [project.id],
      );
      await client.query("SAVEPOINT probe");
      await expect(
        client.query(
          "INSERT INTO characters (id, project_id, name, type) VALUES ($1, $2, $3, $4)",
          [existing.id, project.id, "Duplicate", "main"],
        ),
      ).rejects.toMatchObject({ code: "23505" });
      await client.query("ROLLBACK TO SAVEPOINT probe");

      const probes = [
        {
          values: [null, project.id, "Alex", "main", new Date(), new Date()],
          code: "23502",
          column: "id",
        },
        {
          values: [undefined, null, "Alex", "main", new Date(), new Date()],
          code: "23502",
          column: "project_id",
        },
        {
          values: [undefined, project.id, null, "main", new Date(), new Date()],
          code: "23502",
          column: "name",
        },
        {
          values: [undefined, project.id, "Alex", null, new Date(), new Date()],
          code: "23502",
          column: "type",
        },
        {
          values: [undefined, project.id, "Alex", "main", null, new Date()],
          code: "23502",
          column: "created_at",
        },
        {
          values: [undefined, project.id, "Alex", "main", new Date(), null],
          code: "23502",
          column: "updated_at",
        },
      ];
      for (const { values, code, column } of probes) {
        if (column !== "id") values[0] = randomUUID();
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            `INSERT INTO characters (id, project_id, name, type, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            values,
          ),
        ).rejects.toMatchObject({ code, column });
        await client.query("ROLLBACK TO SAVEPOINT probe");
      }

      const invalidCharacters = [
        { projectId: project.id, type: "other", code: "23514" },
        {
          projectId: "00000000-0000-0000-0000-000000000000",
          type: "main",
          code: "23503",
        },
      ];
      for (const { projectId, type, code } of invalidCharacters) {
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            "INSERT INTO characters (project_id, name, type) VALUES ($1, $2, $3)",
            [projectId, "Alex", type],
          ),
        ).rejects.toMatchObject({ code });
        await client.query("ROLLBACK TO SAVEPOINT probe");
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "deleting a project cascades to its characters without affecting another project",
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
        `INSERT INTO characters (project_id, name, type)
         VALUES ($1, 'Alex', 'main'), ($2, 'Sam', 'supporting') RETURNING id`,
        [first.id, second.id],
      );
      await client.query("DELETE FROM projects WHERE id = $1", [first.id]);
      const { rows } = await client.query(
        "SELECT id, project_id FROM characters WHERE id IN ($1, $2)",
        [removed.id, retained.id],
      );
      expect(rows).toEqual([{ id: retained.id, project_id: second.id }]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);
