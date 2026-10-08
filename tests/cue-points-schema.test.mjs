import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

// These checks exercise constraints on a migrated, disposable PostgreSQL database.
test.skipIf(!process.env.DATABASE_URL)(
  "cue points have required fields, deliberate foreign-key deletion rules, and a scene position index",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const migrations = await db.$client.query(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    expect(migrations.rows.map(({ id }) => id)).toContain(8);

    const columns = await db.$client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cue_points'
      ORDER BY ordinal_position
    `);
    expect(columns.rows).toEqual([
      { column_name: "id", is_nullable: "NO", data_type: "uuid" },
      { column_name: "scene_id", is_nullable: "NO", data_type: "uuid" },
      { column_name: "character_id", is_nullable: "NO", data_type: "uuid" },
      { column_name: "spoken_text", is_nullable: "NO", data_type: "text" },
      { column_name: "position", is_nullable: "NO", data_type: "integer" },
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

    const index = await db.$client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'cue_points'
        AND indexname = 'cue_points_scene_id_position_idx'
    `);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0].indexdef).toContain('(scene_id, "position")');

    const foreignKeys = await db.$client.query(`
      SELECT a.attname AS column_name, referenced.relname AS target,
             fk.confdeltype, fk.condeferrable, fk.condeferred
      FROM pg_constraint AS fk
      JOIN pg_class AS source ON source.oid = fk.conrelid
      JOIN pg_class AS referenced ON referenced.oid = fk.confrelid
      JOIN pg_attribute AS a ON a.attrelid = source.oid AND a.attnum = ANY(fk.conkey)
      WHERE source.relname = 'cue_points' AND fk.contype = 'f'
      ORDER BY a.attname
    `);
    expect(foreignKeys.rows).toEqual([
      {
        column_name: "character_id",
        target: "characters",
        confdeltype: "a",
        condeferrable: true,
        condeferred: true,
      },
      {
        column_name: "scene_id",
        target: "scenes",
        confdeltype: "c",
        condeferrable: false,
        condeferred: false,
      },
    ]);
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "cue points persist scene ordering and reject invalid values or missing references",
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
        rows: [character],
      } = await client.query(
        "INSERT INTO characters (project_id, name, type) VALUES ($1, 'Narrator', 'main') RETURNING id",
        [project.id],
      );
      const {
        rows: [episode],
      } = await client.query(
        "INSERT INTO episodes (project_id, title, description, position) VALUES ($1, 'One', 'Intro', 0) RETURNING id",
        [project.id],
      );
      const {
        rows: [scene],
      } = await client.query(
        "INSERT INTO scenes (episode_id, title, position) VALUES ($1, 'Opening', 0) RETURNING id",
        [episode.id],
      );
      const {
        rows: [later, earlier],
      } = await client.query(
        `INSERT INTO cue_points (scene_id, character_id, spoken_text, position)
         VALUES ($1, $2, 'Later', 2), ($1, $2, 'Earlier', 0)
         RETURNING id, scene_id, character_id, spoken_text, position, created_at, updated_at`,
        [scene.id, character.id],
      );
      expect(later).toMatchObject({
        id: expect.stringMatching(/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i),
        scene_id: scene.id,
        character_id: character.id,
        spoken_text: "Later",
        position: 2,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      const { rows: sorted } = await client.query(
        "SELECT id FROM cue_points WHERE scene_id = $1 ORDER BY position, id",
        [scene.id],
      );
      expect(sorted.map(({ id }) => id)).toEqual([earlier.id, later.id]);

      const valid = [
        randomUUID(),
        scene.id,
        character.id,
        "Line",
        1,
        new Date(),
        new Date(),
      ];
      const probes = [
        { columnIndex: 0, value: later.id, code: "23505" },
        { columnIndex: 0, value: null, code: "23502", column: "id" },
        { columnIndex: 1, value: null, code: "23502", column: "scene_id" },
        { columnIndex: 1, value: randomUUID(), code: "23503" },
        { columnIndex: 2, value: null, code: "23502", column: "character_id" },
        { columnIndex: 2, value: randomUUID(), code: "23503" },
        { columnIndex: 3, value: null, code: "23502", column: "spoken_text" },
        { columnIndex: 4, value: null, code: "23502", column: "position" },
        { columnIndex: 4, value: -1, code: "23514" },
        { columnIndex: 5, value: null, code: "23502", column: "created_at" },
        { columnIndex: 6, value: null, code: "23502", column: "updated_at" },
      ];
      for (const { columnIndex, value, code, column } of probes) {
        const values = [...valid];
        values[columnIndex] = value;
        await client.query("SAVEPOINT probe");
        const insertion = client.query(
          `INSERT INTO cue_points (id, scene_id, character_id, spoken_text, position, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          values,
        );
        if (columnIndex === 2 && value !== null) {
          await insertion;
          await expect(
            client.query(
              "SET CONSTRAINTS cue_points_character_id_characters_id_fk IMMEDIATE",
            ),
          ).rejects.toMatchObject({ code });
        } else {
          await expect(insertion).rejects.toMatchObject(
            column ? { code, column } : { code },
          );
        }
        await client.query("ROLLBACK TO SAVEPOINT probe");
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "scene deletion cascades cue points but direct deletion of a referenced character is blocked",
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
        rows: [character],
      } = await client.query(
        "INSERT INTO characters (project_id, name, type) VALUES ($1, 'Narrator', 'main') RETURNING id",
        [project.id],
      );
      const {
        rows: [episode],
      } = await client.query(
        "INSERT INTO episodes (project_id, title, description, position) VALUES ($1, 'One', 'Intro', 0) RETURNING id",
        [project.id],
      );
      const {
        rows: [removed, retained],
      } = await client.query(
        `INSERT INTO scenes (episode_id, title, position)
         VALUES ($1, 'Removed', 0), ($1, 'Retained', 1) RETURNING id`,
        [episode.id],
      );
      const {
        rows: [removedPoint, retainedPoint],
      } = await client.query(
        `INSERT INTO cue_points (scene_id, character_id, spoken_text, position)
         VALUES ($1, $3, 'Removed', 0), ($2, $3, 'Retained', 0) RETURNING id`,
        [removed.id, retained.id, character.id],
      );
      await client.query("SAVEPOINT deletion");
      await client.query("DELETE FROM characters WHERE id = $1", [
        character.id,
      ]);
      await expect(
        client.query(
          "SET CONSTRAINTS cue_points_character_id_characters_id_fk IMMEDIATE",
        ),
      ).rejects.toMatchObject({ code: "23503" });
      await client.query("ROLLBACK TO SAVEPOINT deletion");
      await client.query("DELETE FROM scenes WHERE id = $1", [removed.id]);
      const { rows: points } = await client.query(
        "SELECT id FROM cue_points WHERE id IN ($1, $2)",
        [removedPoint.id, retainedPoint.id],
      );
      expect(points).toEqual([{ id: retainedPoint.id }]);
      const { rows: characters } = await client.query(
        "SELECT id FROM characters WHERE id = $1",
        [character.id],
      );
      expect(characters).toEqual([{ id: character.id }]);
      await client.query("DELETE FROM cue_points WHERE id = $1", [
        retainedPoint.id,
      ]);
      await expect(
        client.query("DELETE FROM characters WHERE id = $1", [character.id]),
      ).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);
