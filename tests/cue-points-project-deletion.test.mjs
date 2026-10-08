import { expect, onTestFinished, test } from "vitest";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";

// Project deletion must complete its cascades before the character FK is checked.
test.skipIf(!process.env.DATABASE_URL)(
  "deleting a project cascades through characters, episodes, scenes and cue points",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const client = await db.$client.connect();
    const projectIds = [];
    try {
      await client.query("BEGIN");
      const {
        rows: [removedProject, retainedProject],
      } = await client.query(
        `INSERT INTO projects (title, genre, description)
         VALUES ('Removed', 'Mystery', 'Intro'), ('Retained', 'Mystery', 'Intro') RETURNING id`,
      );
      projectIds.push(removedProject.id, retainedProject.id);
      const {
        rows: [removedCharacter, retainedCharacter],
      } = await client.query(
        `INSERT INTO characters (project_id, name, type)
         VALUES ($1, 'Removed', 'main'), ($2, 'Retained', 'main') RETURNING id`,
        [removedProject.id, retainedProject.id],
      );
      const {
        rows: [removedEpisode, retainedEpisode],
      } = await client.query(
        `INSERT INTO episodes (project_id, title, description, position)
         VALUES ($1, 'Removed', 'Intro', 0), ($2, 'Retained', 'Intro', 0) RETURNING id`,
        [removedProject.id, retainedProject.id],
      );
      const {
        rows: [removedScene, retainedScene],
      } = await client.query(
        `INSERT INTO scenes (episode_id, title, position)
         VALUES ($1, 'Removed', 0), ($2, 'Retained', 0) RETURNING id`,
        [removedEpisode.id, retainedEpisode.id],
      );
      const {
        rows: [removedPoint, retainedPoint],
      } = await client.query(
        `INSERT INTO cue_points (scene_id, character_id, spoken_text, position)
         VALUES ($1, $3, 'Removed', 0), ($2, $4, 'Retained', 0) RETURNING id`,
        [
          removedScene.id,
          retainedScene.id,
          removedCharacter.id,
          retainedCharacter.id,
        ],
      );

      await expect(
        client.query("DELETE FROM projects WHERE id = $1", [removedProject.id]),
      ).resolves.toMatchObject({ rowCount: 1 });
      await expect(client.query("COMMIT")).resolves.toMatchObject({
        command: "COMMIT",
      });
      for (const [table, removedId, retainedId] of [
        ["projects", removedProject.id, retainedProject.id],
        ["characters", removedCharacter.id, retainedCharacter.id],
        ["episodes", removedEpisode.id, retainedEpisode.id],
        ["scenes", removedScene.id, retainedScene.id],
        ["cue_points", removedPoint.id, retainedPoint.id],
      ]) {
        const { rows } = await client.query(
          `SELECT id FROM ${table} WHERE id IN ($1, $2)`,
          [removedId, retainedId],
        );
        expect(rows).toEqual([{ id: retainedId }]);
      }
    } finally {
      try {
        await client.query("ROLLBACK");
        if (projectIds.length) {
          await client.query(
            "DELETE FROM projects WHERE id = ANY($1::uuid[])",
            [projectIds],
          );
        }
      } finally {
        client.release();
      }
    }
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "directly deleting a referenced character fails at COMMIT",
  async () => {
    const { db, close } = createDatabase(parseConfig(process.env));
    onTestFinished(close);
    const client = await db.$client.connect();
    let projectId;
    try {
      const {
        rows: [project],
      } = await client.query(
        "INSERT INTO projects (title, genre, description) VALUES ('Direct delete', 'Mystery', 'Intro') RETURNING id",
      );
      projectId = project.id;
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
        rows: [point],
      } = await client.query(
        "INSERT INTO cue_points (scene_id, character_id, spoken_text, position) VALUES ($1, $2, 'Line', 0) RETURNING id",
        [scene.id, character.id],
      );

      await client.query("BEGIN");
      await expect(
        client.query("DELETE FROM characters WHERE id = $1", [character.id]),
      ).resolves.toMatchObject({ rowCount: 1 });
      await expect(client.query("COMMIT")).rejects.toMatchObject({
        code: "23503",
      });
      const { rows: characters } = await client.query(
        "SELECT id FROM characters WHERE id = $1",
        [character.id],
      );
      const { rows: points } = await client.query(
        "SELECT id FROM cue_points WHERE id = $1",
        [point.id],
      );
      expect(characters).toEqual([{ id: character.id }]);
      expect(points).toEqual([{ id: point.id }]);
    } finally {
      await client.query("ROLLBACK");
      if (projectId) {
        await client.query("DELETE FROM projects WHERE id = $1", [projectId]);
      }
      client.release();
    }
  },
);
