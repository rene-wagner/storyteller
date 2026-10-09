import { randomUUID } from "node:crypto";
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";
import { expect, onTestFinished, test, vi } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { parseConfig } from "../apps/api/src/config.ts";
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
import { createMediaRepository } from "../apps/api/src/media/repository.ts";
import { createMediaService } from "../apps/api/src/media/service.ts";

function multipart(type) {
  const boundary = "media-test";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="theme.wav"\r\nContent-Type: audio/wav\r\n\r\nabc\r\n--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nTheme\r\n--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${type}\r\n--${boundary}--\r\n`,
  };
}

test.skipIf(!process.env.DATABASE_URL)(
  "media HTTP persists, filters, updates, protects scene and cue references and deletes bytes",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const bytes = new Map();
    const storage = {
      save: vi.fn(async (stream) => {
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const key = randomUUID();
        bytes.set(key, Buffer.concat(chunks));
        return key;
      }),
      delete: vi.fn(async (key) => {
        if (!bytes.delete(key)) throw new Error("missing bytes");
      }),
      get: vi.fn(),
    };
    const app = createApp({
      media: createMediaService(createMediaRepository(database.db), storage),
    });
    const mediaIds = [];
    let projectId;
    onTestFinished(async () => {
      try {
        await app.close();
        if (projectId)
          await database.db.delete(projects).where(eq(projects.id, projectId));
        for (const id of mediaIds)
          await database.db.delete(mediaItems).where(eq(mediaItems.id, id));
      } finally {
        await database.close();
      }
    });
    const upload = async (type) => {
      const response = await app.inject({
        method: "POST",
        url: "/media",
        ...multipart(type),
      });
      expect(response.statusCode).toBe(201);
      mediaIds.push(response.json().id);
      return response.json();
    };
    const music = await upload("background_music");
    const effect = await upload("sound_effect");
    expect(music).toMatchObject({
      name: "Theme",
      fileName: "theme.wav",
      mimeType: "audio/wav",
      fileSize: "3",
    });
    expect(music).not.toHaveProperty("storageKey");
    expect(
      (await app.inject({ url: "/media?type=background_music" }))
        .json()
        .map(({ id }) => id),
    ).toContain(music.id);
    expect(
      (await app.inject({ url: "/media?type=sound_effect" }))
        .json()
        .map(({ id }) => id),
    ).toContain(effect.id);
    const updated = await app.inject({
      method: "PATCH",
      url: `/media/${effect.id}`,
      payload: { name: "Crash" },
    });
    expect(updated.json().name).toBe("Crash");
    expect((await app.inject({ url: `/media/${effect.id}` })).json().name).toBe(
      "Crash",
    );
    const [project] = await database.db
      .insert(projects)
      .values({ title: "Pilot", genre: "Drama", description: "" })
      .returning();
    projectId = project.id;
    const [episode] = await database.db
      .insert(episodes)
      .values({ projectId, title: "One", description: "", position: 0 })
      .returning();
    const [scene] = await database.db
      .insert(scenes)
      .values({
        episodeId: episode.id,
        title: "Scene",
        position: 0,
        backgroundMusicId: music.id,
      })
      .returning();
    const [character] = await database.db
      .insert(characters)
      .values({ projectId, name: "Actor", type: "main" })
      .returning();
    const [point] = await database.db
      .insert(cuePoints)
      .values({
        sceneId: scene.id,
        characterId: character.id,
        spokenText: "Hi",
        position: 0,
      })
      .returning();
    await database.db
      .insert(cuePointSoundEffects)
      .values({ cuePointId: point.id, mediaItemId: effect.id });
    for (const [item, usage] of [
      [
        music,
        {
          sceneIds: [scene.id],
          cuePointIds: [],
          scenes: [
            {
              id: scene.id,
              projectTitle: "Pilot",
              episodeTitle: "One",
              sceneTitle: "Scene",
            },
          ],
          cuePoints: [],
        },
      ],
      [
        effect,
        {
          sceneIds: [],
          cuePointIds: [point.id],
          scenes: [],
          cuePoints: [
            {
              id: point.id,
              projectTitle: "Pilot",
              episodeTitle: "One",
              sceneTitle: "Scene",
              position: 0,
            },
          ],
        },
      ],
    ]) {
      const response = await app.inject({
        method: "DELETE",
        url: `/media/${item.id}`,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.usage).toStrictEqual(usage);
    }
    expect(storage.delete).not.toHaveBeenCalled();
    await database.db.delete(projects).where(eq(projects.id, projectId));
    projectId = undefined;
    for (const item of [music, effect]) {
      expect(
        (await app.inject({ method: "DELETE", url: `/media/${item.id}` }))
          .statusCode,
      ).toBe(204);
      expect((await app.inject({ url: `/media/${item.id}` })).statusCode).toBe(
        404,
      );
    }
    expect(bytes.size).toBe(0);
    expect(storage.delete).toHaveBeenCalledTimes(2);
  },
);
