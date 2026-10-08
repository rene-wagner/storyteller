import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

// These checks exercise constraints on a migrated, disposable PostgreSQL database.
test.skipIf(!process.env.DATABASE_URL)(
  "scenes have nullable background music, an episode cascade, and a position index",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const migrations = await db.$client.query(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    expect(migrations.rows.map(({ id }) => id)).toContain(5);

    const columns = await db.$client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scenes'
      ORDER BY ordinal_position
    `);
    expect(
      columns.rows.map(({ column_name, is_nullable }) => ({
        column_name,
        is_nullable,
      })),
    ).toEqual([
      { column_name: "id", is_nullable: "NO" },
      { column_name: "episode_id", is_nullable: "NO" },
      { column_name: "title", is_nullable: "NO" },
      { column_name: "background_music_id", is_nullable: "YES" },
      { column_name: "position", is_nullable: "NO" },
      { column_name: "created_at", is_nullable: "NO" },
      { column_name: "updated_at", is_nullable: "NO" },
      { column_name: "background_music_type", is_nullable: "NO" },
    ]);
    expect(
      columns.rows.find(({ column_name }) => column_name === "position")
        .data_type,
    ).toBe("integer");
    expect(
      columns.rows.find(
        ({ column_name }) => column_name === "background_music_id",
      ).data_type,
    ).toBe("uuid");

    const index = await db.$client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'scenes'
        AND indexname = 'scenes_episode_id_position_idx'
    `);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0].indexdef).toContain('(episode_id, "position")');

    const foreignKeys = await db.$client.query(`
      SELECT a.attname AS column_name, referenced.relname AS target, fk.confdeltype
      FROM pg_constraint AS fk
      JOIN pg_class AS source ON source.oid = fk.conrelid
      JOIN pg_class AS referenced ON referenced.oid = fk.confrelid
      JOIN pg_attribute AS a ON a.attrelid = source.oid AND a.attnum = ANY(fk.conkey)
      WHERE source.relname = 'scenes' AND fk.contype = 'f'
      ORDER BY column_name
    `);
    expect(foreignKeys.rows).toEqual([
      {
        column_name: "background_music_id",
        target: "media_items",
        confdeltype: "a",
      },
      {
        column_name: "background_music_type",
        target: "media_items",
        confdeltype: "a",
      },
      { column_name: "episode_id", target: "episodes", confdeltype: "c" },
    ]);
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "scenes store optional background music and sort by episode position while enforcing constraints",
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
        rows: [episode],
      } = await client.query(
        "INSERT INTO episodes (project_id, title, description, position) VALUES ($1, 'One', 'Intro', 0) RETURNING id",
        [project.id],
      );
      const {
        rows: [{ id: musicId }],
      } = await client.query(
        `INSERT INTO media_items (name, type, file_name, storage_key, mime_type, file_size)
         VALUES ('Theme', 'background_music', 'theme.wav', $1, 'audio/wav', 1) RETURNING id`,
        [randomUUID()],
      );
      const {
        rows: [later, earlier],
      } = await client.query(
        `INSERT INTO scenes (episode_id, title, background_music_id, position)
         VALUES ($1, 'Later', $2, 2), ($1, 'Earlier', NULL, 0)
         RETURNING id, episode_id, title, background_music_id, position, created_at, updated_at`,
        [episode.id, musicId],
      );
      expect(later).toMatchObject({
        id: expect.stringMatching(/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i),
        episode_id: episode.id,
        title: "Later",
        background_music_id: musicId,
        position: 2,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(earlier.background_music_id).toBeNull();
      const { rows: sorted } = await client.query(
        "SELECT id FROM scenes WHERE episode_id = $1 ORDER BY position, id",
        [episode.id],
      );
      expect(sorted.map(({ id }) => id)).toEqual([earlier.id, later.id]);

      const probes = [
        {
          values: [
            later.id,
            episode.id,
            "Duplicate",
            null,
            1,
            new Date(),
            new Date(),
          ],
          code: "23505",
        },
        {
          values: [null, episode.id, "Title", null, 1, new Date(), new Date()],
          code: "23502",
          column: "id",
        },
        {
          values: [
            randomUUID(),
            null,
            "Title",
            null,
            1,
            new Date(),
            new Date(),
          ],
          code: "23502",
          column: "episode_id",
        },
        {
          values: [
            randomUUID(),
            randomUUID(),
            "Title",
            null,
            1,
            new Date(),
            new Date(),
          ],
          code: "23503",
        },
        {
          values: [
            randomUUID(),
            episode.id,
            null,
            null,
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
            episode.id,
            "Title",
            null,
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
            episode.id,
            "Title",
            null,
            -1,
            new Date(),
            new Date(),
          ],
          code: "23514",
        },
        {
          values: [
            randomUUID(),
            episode.id,
            "Title",
            null,
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
            episode.id,
            "Title",
            null,
            1,
            new Date(),
            null,
          ],
          code: "23502",
          column: "updated_at",
        },
      ];
      for (const { values, code, column } of probes) {
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            `INSERT INTO scenes (id, episode_id, title, background_music_id, position, created_at, updated_at)
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
  "deleting an episode cascades only to its scenes",
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
        rows: [first, second],
      } = await client.query(
        `INSERT INTO episodes (project_id, title, description, position)
         VALUES ($1, 'One', 'Intro', 0), ($1, 'Two', 'Intro', 1) RETURNING id`,
        [project.id],
      );
      const {
        rows: [removed, retained],
      } = await client.query(
        `INSERT INTO scenes (episode_id, title, position)
         VALUES ($1, 'Removed', 0), ($2, 'Retained', 0) RETURNING id`,
        [first.id, second.id],
      );
      await client.query("DELETE FROM episodes WHERE id = $1", [first.id]);
      const { rows } = await client.query(
        "SELECT id, episode_id FROM scenes WHERE id IN ($1, $2)",
        [removed.id, retained.id],
      );
      expect(rows).toEqual([{ id: retained.id, episode_id: second.id }]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);
