import { randomUUID } from "node:crypto";
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";
import { expect, onTestFinished, test } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { parseConfig } from "../apps/api/src/config.ts";
import { createCuePointRepository } from "../apps/api/src/cue-points/repository.ts";
import { createCuePointService } from "../apps/api/src/cue-points/service.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";
import {
  characters,
  cuePoints,
  cuePointSoundEffects,
  episodes,
  mediaItems,
  projects,
  scenes,
} from "../apps/api/src/db/schema.ts";
import { createSceneRepository } from "../apps/api/src/scenes/repository.ts";

const invalid = {
  error: {
    code: "VALIDATION_ERROR",
    message: "The request contains invalid data.",
    details: [],
  },
};

test.skipIf(!process.env.DATABASE_URL)(
  "cue point HTTP creation and replacement persist only distinct sound effects atomically",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const app = createApp({
      cuePoints: createCuePointService(
        createCuePointRepository(database.db),
        createSceneRepository(database.db),
      ),
    });
    const projectIds = [];
    let mediaIds = [];
    onTestFinished(async () => {
      try {
        await app.close();
        for (const id of projectIds)
          await database.db.delete(projects).where(eq(projects.id, id));
        for (const id of mediaIds)
          await database.db.delete(mediaItems).where(eq(mediaItems.id, id));
      } finally {
        await database.close();
      }
    });
    const [project] = await database.db
      .insert(projects)
      .values({
        title: "Effects",
        genre: "Drama",
        description: "",
      })
      .returning();
    projectIds.push(project.id);
    const projectId = project.id;
    const [character] = await database.db
      .insert(characters)
      .values({
        projectId,
        name: "Voice",
        type: "main",
      })
      .returning();
    const [episode] = await database.db
      .insert(episodes)
      .values({
        projectId,
        title: "Episode",
        description: "",
        position: 0,
      })
      .returning();
    const [scene] = await database.db
      .insert(scenes)
      .values({
        episodeId: episode.id,
        title: "Scene",
        position: 0,
      })
      .returning();
    const media = await database.db
      .insert(mediaItems)
      .values([
        {
          name: "Rain",
          type: "sound_effect",
          fileName: "rain.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 1n,
        },
        {
          name: "Wind",
          type: "sound_effect",
          fileName: "wind.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 1n,
        },
        {
          name: "Theme",
          type: "background_music",
          fileName: "theme.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 1n,
        },
      ])
      .returning();
    mediaIds = media.map(({ id }) => id);
    const post = (soundEffectIds) =>
      app.inject({
        method: "POST",
        url: `/scenes/${scene.id}/cue-points`,
        payload: {
          characterId: character.id,
          spokenText: "Line",
          ...(soundEffectIds === undefined ? {} : { soundEffectIds }),
        },
      });
    const patch = (id, payload) =>
      app.inject({ method: "PATCH", url: `/cue-points/${id}`, payload });
    const read = (id) => app.inject({ url: `/cue-points/${id}` });
    for (const ids of [
      [media[0].id, media[0].id],
      [randomUUID()],
      [media[2].id],
      [media[0].id, media[2].id],
    ]) {
      const response = await post(ids);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(invalid);
    }
    expect(
      await database.db
        .select()
        .from(cuePoints)
        .where(eq(cuePoints.sceneId, scene.id)),
    ).toEqual([]);
    const empty = await post();
    expect(empty.statusCode).toBe(201);
    expect(empty.json().soundEffectIds).toEqual([]);
    const created = await post([media[1].id, media[0].id]);
    expect(created.statusCode).toBe(201);
    const point = created.json();
    const both = [media[0].id, media[1].id].sort();
    expect(point.soundEffectIds).toEqual(both);
    expect((await read(point.id)).json().soundEffectIds).toEqual(both);
    expect(
      (await app.inject({ url: `/scenes/${scene.id}/cue-points` }))
        .json()
        .map(({ soundEffectIds }) => soundEffectIds),
    ).toEqual([[], both]);
    const links = () =>
      database.db
        .select()
        .from(cuePointSoundEffects)
        .where(eq(cuePointSoundEffects.cuePointId, point.id));
    expect(
      (await links()).map(({ mediaItemId }) => mediaItemId).sort(),
    ).toEqual(both);
    for (const ids of [
      [media[0].id, media[0].id],
      [randomUUID()],
      [media[2].id],
      [media[1].id, media[2].id],
    ]) {
      const response = await patch(point.id, {
        spokenText: "Should roll back",
        soundEffectIds: ids,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(invalid);
      expect((await read(point.id)).json()).toEqual(point);
      expect(
        (await links()).map(({ mediaItemId }) => mediaItemId).sort(),
      ).toEqual(both);
    }
    const textOnly = await patch(point.id, { spokenText: "Changed" });
    expect(textOnly.statusCode).toBe(200);
    expect(textOnly.json().soundEffectIds).toEqual(both);
    const replaced = await patch(point.id, { soundEffectIds: [media[0].id] });
    expect(replaced.json().soundEffectIds).toEqual([media[0].id]);
    expect((await links()).map(({ mediaItemId }) => mediaItemId)).toEqual([
      media[0].id,
    ]);
    const concurrent = await Promise.all([
      patch(point.id, { soundEffectIds: [media[0].id] }),
      patch(point.id, { soundEffectIds: [media[1].id] }),
    ]);
    expect(concurrent.map(({ statusCode }) => statusCode)).toEqual([200, 200]);
    const persistedIds = (await links()).map(({ mediaItemId }) => mediaItemId);
    expect([[media[0].id], [media[1].id]]).toContainEqual(persistedIds);
    expect((await read(point.id)).json().soundEffectIds).toEqual(persistedIds);
    const cleared = await patch(point.id, { soundEffectIds: [] });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().soundEffectIds).toEqual([]);
    expect(await links()).toEqual([]);
    expect((await read(point.id)).json().soundEffectIds).toEqual([]);
    expect((await patch(point.id, { soundEffectIds: both })).statusCode).toBe(
      200,
    );
    expect(
      (await app.inject({ method: "DELETE", url: `/cue-points/${point.id}` }))
        .statusCode,
    ).toBe(204);
    expect(await links()).toEqual([]);
  },
);
