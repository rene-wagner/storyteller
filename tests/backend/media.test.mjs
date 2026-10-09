import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { eq } from "../../apps/api/node_modules/drizzle-orm/index.js";
import { mediaItems } from "../../apps/api/src/db/schema.ts";
import { createBackendTest } from "./helpers.mjs";

const invalid = {
  error: {
    code: "VALIDATION_ERROR",
    message: "The request contains invalid data.",
    details: [],
  },
};
const missing = {
  error: { code: "NOT_FOUND", message: "Resource not found.", details: [] },
};

function multipart(type, name = "Theme") {
  const boundary = "backend-media-test";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="theme.wav"\r\nContent-Type: audio/wav\r\n\r\nabc\r\n--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${type}\r\n--${boundary}--\r\n`,
  };
}

async function create(app, url, payload) {
  const response = await app.inject({ method: "POST", url, payload });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function upload(app, type, name) {
  const response = await app.inject({
    method: "POST",
    url: "/media",
    ...multipart(type, name),
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

async function assertError(app, method, url, payload, status, body) {
  const response = await app.inject({ method, url, payload });
  expect(response.statusCode).toBe(status);
  expect(response.json()).toStrictEqual(body);
}

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "media upload persists metadata and bytes; filtering, editing and deletion preserve storage consistency",
  async () => {
    const { app, db, storage } = await createBackendTest();
    const music = await upload(app, "background_music", "Score");
    const effect = await upload(app, "sound_effect", "Impact");
    expect(music).toMatchObject({
      id: expect.any(String),
      name: "Score",
      type: "background_music",
      fileName: "theme.wav",
      mimeType: "audio/wav",
      fileSize: "3",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(music).not.toHaveProperty("storageKey");
    const rows = await db.select().from(mediaItems);
    expect(rows).toHaveLength(2);
    for (const item of [music, effect]) {
      const row = rows.find(({ id }) => id === item.id);
      expect(row).toMatchObject({
        name: item.name,
        type: item.type,
        fileName: item.fileName,
        mimeType: item.mimeType,
        fileSize: 3n,
        storageKey: expect.any(String),
      });
      expect(storage.files.get(row.storageKey)).toStrictEqual(
        Buffer.from("abc"),
      );
      expect(
        (await app.inject({ url: `/media/${item.id}` })).json(),
      ).toStrictEqual(item);
    }
    expect((await app.inject({ url: "/media" })).json()).toEqual(
      expect.arrayContaining([music, effect]),
    );
    expect(
      (await app.inject({ url: "/media?type=background_music" })).json(),
    ).toStrictEqual([music]);
    expect(
      (await app.inject({ url: "/media?type=sound_effect" })).json(),
    ).toStrictEqual([effect]);

    const updated = await app.inject({
      method: "PATCH",
      url: `/media/${effect.id}`,
      payload: { name: "New impact" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: effect.id,
      name: "New impact",
      type: "sound_effect",
    });
    expect(
      (await app.inject({ url: `/media/${effect.id}` })).json(),
    ).toStrictEqual(updated.json());
    expect(
      (
        await db.select().from(mediaItems).where(eq(mediaItems.id, effect.id))
      )[0].name,
    ).toBe("New impact");
    expect(storage.files.size).toBe(2);

    for (const item of [music, effect]) {
      const key = rows.find(({ id }) => id === item.id).storageKey;
      const deleted = await app.inject({
        method: "DELETE",
        url: `/media/${item.id}`,
      });
      expect(deleted.statusCode).toBe(204);
      expect(deleted.body).toBe("");
      expect(storage.files.has(key)).toBe(false);
      expect(
        await db.select().from(mediaItems).where(eq(mediaItems.id, item.id)),
      ).toEqual([]);
      await assertError(
        app,
        "GET",
        `/media/${item.id}`,
        undefined,
        404,
        missing,
      );
    }
    expect(storage.files.size).toBe(0);
  },
);

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "media rejects invalid types and protects scene music and cue sound effects from deletion",
  async () => {
    const { app, db, storage } = await createBackendTest();
    const rejected = await app.inject({
      method: "POST",
      url: "/media",
      ...multipart("video"),
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toStrictEqual(invalid);
    expect(storage.files.size).toBe(0);
    expect(await db.select().from(mediaItems)).toEqual([]);
    await assertError(app, "GET", "/media?type=video", undefined, 400, invalid);

    const music = await upload(app, "background_music", "Score");
    const effect = await upload(app, "sound_effect", "Impact");
    for (const payload of [{ type: "video" }, { type: "sound_effect" }]) {
      await assertError(
        app,
        "PATCH",
        `/media/${music.id}`,
        payload,
        400,
        invalid,
      );
    }
    const project = await create(app, "/projects", {
      title: "Pilot",
      genre: "Drama",
      description: "",
    });
    const character = await create(app, `/projects/${project.id}/characters`, {
      name: "Narrator",
      type: "main",
    });
    const episode = await create(app, `/projects/${project.id}/episodes`, {
      title: "First",
      description: "",
    });
    const scene = await create(app, `/episodes/${episode.id}/scenes`, {
      title: "Opening",
      backgroundMusicId: music.id,
    });
    const point = await create(app, `/scenes/${scene.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Hello",
      soundEffectIds: [effect.id],
    });
    const rows = await db.select().from(mediaItems);
    for (const [item, usage] of [
      [music, { sceneIds: [scene.id], cuePointIds: [] }],
      [effect, { sceneIds: [], cuePointIds: [point.id] }],
    ]) {
      const blocked = await app.inject({
        method: "DELETE",
        url: `/media/${item.id}`,
      });
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json()).toStrictEqual({
        error: {
          code: "CONFLICT",
          message: "Media item is in use.",
          details: [],
          usage,
        },
      });
      const key = rows.find(({ id }) => id === item.id).storageKey;
      expect(storage.files.get(key)).toStrictEqual(Buffer.from("abc"));
      expect(
        await db.select().from(mediaItems).where(eq(mediaItems.id, item.id)),
      ).toHaveLength(1);
    }
    const removed = await app.inject({
      method: "DELETE",
      url: `/projects/${project.id}`,
    });
    expect(removed.statusCode).toBe(204);
    for (const item of [music, effect]) {
      const key = rows.find(({ id }) => id === item.id).storageKey;
      expect(
        (await app.inject({ method: "DELETE", url: `/media/${item.id}` }))
          .statusCode,
      ).toBe(204);
      expect(storage.files.has(key)).toBe(false);
    }
    expect(await db.select().from(mediaItems)).toEqual([]);
    expect(storage.files.size).toBe(0);
    await assertError(
      app,
      "DELETE",
      `/media/${randomUUID()}`,
      undefined,
      404,
      missing,
    );
  },
);
