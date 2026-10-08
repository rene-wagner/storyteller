import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

// These checks exercise constraints on a migrated, disposable PostgreSQL database.
test.skipIf(!process.env.DATABASE_URL)(
  "media items have independent metadata columns, constraints, and a unique storage key",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const migrations = await db.$client.query(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    expect(migrations.rows.map(({ id }) => id)).toContain(9);

    const columns = await db.$client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'media_items'
      ORDER BY ordinal_position
    `);
    expect(columns.rows).toEqual([
      { column_name: "id", is_nullable: "NO", data_type: "uuid" },
      { column_name: "name", is_nullable: "NO", data_type: "text" },
      { column_name: "type", is_nullable: "NO", data_type: "text" },
      { column_name: "file_name", is_nullable: "NO", data_type: "text" },
      { column_name: "storage_key", is_nullable: "NO", data_type: "text" },
      { column_name: "mime_type", is_nullable: "NO", data_type: "text" },
      { column_name: "file_size", is_nullable: "NO", data_type: "bigint" },
      {
        column_name: "created_at",
        is_nullable: "NO",
        data_type: "timestamp with time zone",
      },
      {
        column_name: "updated_at",
        is_nullable: "NO",
        data_type: "timestamp with time zone",
      },
    ]);
    const foreignKeys = await db.$client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'media_items'::regclass AND contype = 'f'
    `);
    expect(foreignKeys.rows).toEqual([]);
    const index = await db.$client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'media_items'
        AND indexname = 'media_items_storage_key_unique'
    `);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0].indexdef).toContain("UNIQUE INDEX");
    expect(index.rows[0].indexdef).toContain("(storage_key)");
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "media items persist without projects and enforce type, size, required fields, and storage key uniqueness",
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
      for (const type of ["background_music", "sound_effect"]) {
        const {
          rows: [item],
        } = await client.query(
          `INSERT INTO media_items (name, type, file_name, storage_key, mime_type, file_size)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, name, type, file_name, storage_key, mime_type, file_size, created_at, updated_at`,
          [
            "Theme",
            type,
            "theme.wav",
            `media/${randomUUID()}`,
            "audio/wav",
            "9007199254740993",
          ],
        );
        expect(item).toMatchObject({
          id: expect.stringMatching(
            /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i,
          ),
          name: "Theme",
          type,
          file_name: "theme.wav",
          storage_key: expect.stringMatching(/^media\//),
          mime_type: "audio/wav",
          file_size: "9007199254740993",
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        });
      }
      const {
        rows: [existing],
      } = await client.query("SELECT id, storage_key FROM media_items LIMIT 1");
      await client.query("DELETE FROM projects WHERE id = $1", [project.id]);
      expect(
        (await client.query("SELECT count(*)::int AS count FROM media_items"))
          .rows,
      ).toEqual([{ count: 2 }]);

      const valid = [
        randomUUID(),
        "Sound",
        "sound_effect",
        "sound.wav",
        `media/${randomUUID()}`,
        "audio/wav",
        "0",
        new Date(),
        new Date(),
      ];
      const probes = [
        { columnIndex: 0, value: existing.id, code: "23505" },
        { columnIndex: 0, value: null, code: "23502", column: "id" },
        { columnIndex: 1, value: null, code: "23502", column: "name" },
        { columnIndex: 2, value: null, code: "23502", column: "type" },
        { columnIndex: 2, value: "other", code: "23514" },
        { columnIndex: 3, value: null, code: "23502", column: "file_name" },
        { columnIndex: 4, value: null, code: "23502", column: "storage_key" },
        { columnIndex: 4, value: existing.storage_key, code: "23505" },
        { columnIndex: 5, value: null, code: "23502", column: "mime_type" },
        { columnIndex: 6, value: null, code: "23502", column: "file_size" },
        { columnIndex: 6, value: "-1", code: "23514" },
        { columnIndex: 7, value: null, code: "23502", column: "created_at" },
        { columnIndex: 8, value: null, code: "23502", column: "updated_at" },
      ];
      for (const { columnIndex, value, code, column } of probes) {
        const values = [...valid];
        values[columnIndex] = value;
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            `INSERT INTO media_items (id, name, type, file_name, storage_key, mime_type, file_size, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
