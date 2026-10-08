import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

// These checks exercise constraints on a migrated, disposable PostgreSQL database.
test.skipIf(!process.env.DATABASE_URL)(
  "scene background music is optional, restricted to music media, and protects referenced media",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const migrations = await db.$client.query(
      "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    expect(migrations.rows.map(({ id }) => id)).toContain(11);
    const constraints = await db.$client.query(`
      SELECT conname, contype, confdeltype, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'scenes'::regclass
        AND conname IN ('scenes_background_music_id_background_music_type_media_items_id_type_fk',
                        'scenes_background_music_type_check') ORDER BY conname
    `);
    expect(constraints.rows).toEqual([
      expect.objectContaining({
        contype: "f",
        confdeltype: "a",
        definition: expect.stringContaining("REFERENCES media_items(id, type)"),
      }),
      expect.objectContaining({
        contype: "c",
        definition: expect.stringContaining(
          "background_music_type = 'background_music'::text",
        ),
      }),
    ]);
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
      const { rows: media } = await client.query(
        `INSERT INTO media_items (name, type, file_name, storage_key, mime_type, file_size)
         VALUES ('Theme', 'background_music', 'theme.wav', $1, 'audio/wav', 1),
                ('Rain', 'sound_effect', 'rain.wav', $2, 'audio/wav', 1) RETURNING id`,
        [randomUUID(), randomUUID()],
      );
      const { rows: scenes } = await client.query(
        `INSERT INTO scenes (episode_id, title, background_music_id, position)
         VALUES ($1, 'Music', $2, 0), ($1, 'Silent', NULL, 1)
         RETURNING id, background_music_id, background_music_type`,
        [episode.id, media[0].id],
      );
      expect(
        scenes.map(({ background_music_id, background_music_type }) => ({
          background_music_id,
          background_music_type,
        })),
      ).toEqual([
        {
          background_music_id: media[0].id,
          background_music_type: "background_music",
        },
        {
          background_music_id: null,
          background_music_type: "background_music",
        },
      ]);
      for (const [id, type, code] of [
        [randomUUID(), "background_music", "23503"],
        [media[1].id, "background_music", "23503"],
        [media[0].id, "sound_effect", "23514"],
        [media[0].id, null, "23502"],
      ]) {
        await client.query("SAVEPOINT probe");
        await expect(
          client.query(
            `UPDATE scenes SET background_music_id = $1, background_music_type = $2 WHERE id = $3`,
            [id, type, scenes[1].id],
          ),
        ).rejects.toMatchObject({ code });
        await client.query("ROLLBACK TO SAVEPOINT probe");
      }
      await client.query("SAVEPOINT media_delete");
      await expect(
        client.query("DELETE FROM media_items WHERE id = $1", [media[0].id]),
      ).rejects.toMatchObject({ code: "23503" });
      await client.query("ROLLBACK TO SAVEPOINT media_delete");
      await client.query("SAVEPOINT media_change");
      await expect(
        client.query(
          "UPDATE media_items SET type = 'sound_effect' WHERE id = $1",
          [media[0].id],
        ),
      ).rejects.toMatchObject({ code: "23503" });
      await client.query("ROLLBACK TO SAVEPOINT media_change");
      await client.query(
        "UPDATE scenes SET background_music_id = NULL WHERE id = $1",
        [scenes[0].id],
      );
      await expect(
        client.query("DELETE FROM media_items WHERE id = $1", [media[0].id]),
      ).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "project deletion commits cascaded music scenes without deleting shared media",
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
      const { rows: episodes } = await client.query(
        `INSERT INTO episodes (project_id, title, description, position)
         VALUES ($1, 'Removed', 'Intro', 0), ($2, 'Retained', 'Intro', 0) RETURNING id`,
        projectIds,
      );
      const {
        rows: [media],
      } = await client.query(
        `INSERT INTO media_items (name, type, file_name, storage_key, mime_type, file_size)
         VALUES ('Shared theme', 'background_music', 'theme.wav', $1, 'audio/wav', 1) RETURNING id`,
        [randomUUID()],
      );
      mediaId = media.id;
      const { rows: scenes } = await client.query(
        `INSERT INTO scenes (episode_id, title, background_music_id, position)
         VALUES ($1, 'Removed', $3, 0), ($2, 'Retained', $3, 0) RETURNING id`,
        [...episodes.map(({ id }) => id), mediaId],
      );
      await client.query("BEGIN");
      await client.query("DELETE FROM projects WHERE id = $1", [projectIds[0]]);
      await expect(client.query("COMMIT")).resolves.toMatchObject({
        command: "COMMIT",
      });
      expect(
        (
          await client.query(
            "SELECT id FROM scenes WHERE background_music_id = $1",
            [mediaId],
          )
        ).rows,
      ).toEqual([{ id: scenes[1].id }]);
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
            "SELECT id FROM scenes WHERE background_music_id = $1",
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
