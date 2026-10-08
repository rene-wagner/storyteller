import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

// These checks exercise constraints on a migrated, disposable PostgreSQL database.
test.skipIf(!process.env.DATABASE_URL)(
  "cue point sound effects have a unique pair, type restriction, and deliberate deletion rules",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const migrations = await db.$client.query(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    expect(migrations.rows.map(({ id }) => id)).toContain(10);

    const columns = await db.$client.query(`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cue_point_sound_effects'
      ORDER BY ordinal_position
    `);
    expect(columns.rows).toEqual([
      {
        column_name: "cue_point_id",
        is_nullable: "NO",
        data_type: "uuid",
        column_default: null,
      },
      {
        column_name: "media_item_id",
        is_nullable: "NO",
        data_type: "uuid",
        column_default: null,
      },
      {
        column_name: "media_type",
        is_nullable: "NO",
        data_type: "text",
        column_default: "'sound_effect'::text",
      },
    ]);
    const constraints = await db.$client.query(`
      SELECT conname, contype, confdeltype, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'cue_point_sound_effects'::regclass
      ORDER BY conname
    `);
    expect(constraints.rows).toEqual([
      expect.objectContaining({
        conname: "cue_point_sound_effects_cue_point_id_cue_points_id_fk",
        contype: "f",
        confdeltype: "c",
        definition: expect.stringContaining(
          "REFERENCES cue_points(id) ON DELETE CASCADE",
        ),
      }),
      expect.objectContaining({
        conname: "cue_point_sound_effects_cue_point_id_media_item_id_pk",
        contype: "p",
        definition: expect.stringContaining(
          "PRIMARY KEY (cue_point_id, media_item_id)",
        ),
      }),
      expect.objectContaining({
        conname:
          "cue_point_sound_effects_media_item_id_media_type_media_items_id",
        contype: "f",
        confdeltype: "a",
        definition: expect.stringContaining("REFERENCES media_items(id, type)"),
      }),
      expect.objectContaining({
        conname: "cue_point_sound_effects_media_type_check",
        contype: "c",
        definition: expect.stringContaining(
          "media_type = 'sound_effect'::text",
        ),
      }),
    ]);
    const indexes = await db.$client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'cue_point_sound_effects'
    `);
    expect(indexes.rows.map(({ indexname }) => indexname)).toContain(
      "cue_point_sound_effects_media_item_id_idx",
    );
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "cue points accept zero or multiple reusable sound effects but reject invalid references and duplicates",
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
      const { rows: points } = await client.query(
        `INSERT INTO cue_points (scene_id, character_id, spoken_text, position)
         VALUES ($1, $2, 'First', 0), ($1, $2, 'Second', 1), ($1, $2, 'Unused', 2) RETURNING id`,
        [scene.id, character.id],
      );
      const { rows: effects } = await client.query(
        `INSERT INTO media_items (name, type, file_name, storage_key, mime_type, file_size)
         VALUES ('Rain', 'sound_effect', 'rain.wav', $1, 'audio/wav', 1),
                ('Wind', 'sound_effect', 'wind.wav', $2, 'audio/wav', 1),
                ('Theme', 'background_music', 'theme.wav', $3, 'audio/wav', 1)
         RETURNING id`,
        [randomUUID(), randomUUID(), randomUUID()],
      );
      expect(
        (
          await client.query(
            "SELECT * FROM cue_point_sound_effects WHERE cue_point_id = $1",
            [points[2].id],
          )
        ).rows,
      ).toEqual([]);
      await client.query(
        `INSERT INTO cue_point_sound_effects (cue_point_id, media_item_id)
         VALUES ($1, $3), ($1, $4), ($2, $3)`,
        [points[0].id, points[1].id, effects[0].id, effects[1].id],
      );
      const { rows: links } = await client.query(
        "SELECT cue_point_id, media_item_id, media_type FROM cue_point_sound_effects ORDER BY cue_point_id, media_item_id",
      );
      expect(links).toEqual(
        expect.arrayContaining([
          {
            cue_point_id: points[0].id,
            media_item_id: effects[0].id,
            media_type: "sound_effect",
          },
          {
            cue_point_id: points[0].id,
            media_item_id: effects[1].id,
            media_type: "sound_effect",
          },
          {
            cue_point_id: points[1].id,
            media_item_id: effects[0].id,
            media_type: "sound_effect",
          },
        ]),
      );
      expect(links).toHaveLength(3);

      for (const [pointId, mediaId, mediaType, code] of [
        [points[0].id, effects[0].id, "sound_effect", "23505"],
        [randomUUID(), effects[0].id, "sound_effect", "23503"],
        [points[0].id, randomUUID(), "sound_effect", "23503"],
        [points[0].id, effects[2].id, "sound_effect", "23503"],
        [points[0].id, effects[2].id, "background_music", "23514"],
        [null, effects[0].id, "sound_effect", "23502"],
        [points[0].id, null, "sound_effect", "23502"],
        [points[0].id, effects[0].id, null, "23502"],
      ]) {
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            `INSERT INTO cue_point_sound_effects (cue_point_id, media_item_id, media_type)
           VALUES ($1, $2, $3)`,
            [pointId, mediaId, mediaType],
          ),
        ).rejects.toMatchObject({ code });
        await client.query("ROLLBACK TO SAVEPOINT probe");
      }
      await client.query("SAVEPOINT media_change");
      await expect(
        client.query(
          "UPDATE media_items SET type = 'background_music' WHERE id = $1",
          [effects[0].id],
        ),
      ).rejects.toMatchObject({ code: "23503" });
      await client.query("ROLLBACK TO SAVEPOINT media_change");
      await client.query("SAVEPOINT media_delete");
      await expect(
        client.query("DELETE FROM media_items WHERE id = $1", [effects[0].id]),
      ).rejects.toMatchObject({ code: "23503" });
      await client.query("ROLLBACK TO SAVEPOINT media_delete");
      await client.query("DELETE FROM cue_points WHERE id = $1", [
        points[0].id,
      ]);
      expect(
        (
          await client.query(
            "SELECT cue_point_id FROM cue_point_sound_effects WHERE media_item_id = $1",
            [effects[0].id],
          )
        ).rows,
      ).toEqual([{ cue_point_id: points[1].id }]);
      await client.query(
        "DELETE FROM cue_point_sound_effects WHERE cue_point_id = $1",
        [points[1].id],
      );
      await expect(
        client.query("DELETE FROM media_items WHERE id = $1", [effects[0].id]),
      ).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "project deletion commits cascaded sound effect links without deleting shared media",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const client = await db.$client.connect();
    const projectIds = [];
    let mediaId;
    try {
      const { rows: projects } = await client.query(
        `INSERT INTO projects (title, genre, description)
         VALUES ('Removed', 'Mystery', 'Intro'), ('Retained', 'Mystery', 'Intro') RETURNING id`,
      );
      projectIds.push(...projects.map(({ id }) => id));
      const { rows: characters } = await client.query(
        `INSERT INTO characters (project_id, name, type)
         VALUES ($1, 'Removed', 'main'), ($2, 'Retained', 'main') RETURNING id`,
        projectIds,
      );
      const { rows: episodes } = await client.query(
        `INSERT INTO episodes (project_id, title, description, position)
         VALUES ($1, 'Removed', 'Intro', 0), ($2, 'Retained', 'Intro', 0) RETURNING id`,
        projectIds,
      );
      const { rows: scenes } = await client.query(
        `INSERT INTO scenes (episode_id, title, position)
         VALUES ($1, 'Removed', 0), ($2, 'Retained', 0) RETURNING id`,
        episodes.map(({ id }) => id),
      );
      const { rows: points } = await client.query(
        `INSERT INTO cue_points (scene_id, character_id, spoken_text, position)
         VALUES ($1, $3, 'Removed', 0), ($2, $4, 'Retained', 0) RETURNING id`,
        [...scenes.map(({ id }) => id), ...characters.map(({ id }) => id)],
      );
      const {
        rows: [media],
      } = await client.query(
        `INSERT INTO media_items (name, type, file_name, storage_key, mime_type, file_size)
         VALUES ('Shared', 'sound_effect', 'shared.wav', $1, 'audio/wav', 1) RETURNING id`,
        [randomUUID()],
      );
      mediaId = media.id;
      await client.query(
        `INSERT INTO cue_point_sound_effects (cue_point_id, media_item_id)
         VALUES ($1, $3), ($2, $3)`,
        [points[0].id, points[1].id, mediaId],
      );
      await client.query("BEGIN");
      await client.query("DELETE FROM projects WHERE id = $1", [projectIds[0]]);
      await expect(client.query("COMMIT")).resolves.toMatchObject({
        command: "COMMIT",
      });
      expect(
        (
          await client.query(
            "SELECT cue_point_id FROM cue_point_sound_effects WHERE media_item_id = $1",
            [mediaId],
          )
        ).rows,
      ).toEqual([{ cue_point_id: points[1].id }]);
      expect(
        (
          await client.query("SELECT id FROM media_items WHERE id = $1", [
            mediaId,
          ])
        ).rows,
      ).toEqual([{ id: mediaId }]);
      await client.query("DELETE FROM projects WHERE id = $1", [projectIds[1]]);
      expect(
        (
          await client.query(
            "SELECT * FROM cue_point_sound_effects WHERE media_item_id = $1",
            [mediaId],
          )
        ).rows,
      ).toEqual([]);
      await expect(
        client.query("DELETE FROM media_items WHERE id = $1", [mediaId]),
      ).resolves.toMatchObject({ rowCount: 1 });
      mediaId = undefined;
    } finally {
      await client.query("ROLLBACK");
      if (projectIds.length) {
        await client.query("DELETE FROM projects WHERE id = ANY($1::uuid[])", [
          projectIds,
        ]);
      }
      if (mediaId) {
        await client.query("DELETE FROM media_items WHERE id = $1", [mediaId]);
      }
      client.release();
    }
  },
);
