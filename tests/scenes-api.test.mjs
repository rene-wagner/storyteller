import { randomUUID } from "node:crypto";
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";
import { expect, onTestFinished, test, vi } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";
import {
  characters,
  cuePoints,
  episodes,
  mediaItems,
  projects,
  scenes,
} from "../apps/api/src/db/schema.ts";
import { createEpisodeRepository } from "../apps/api/src/episodes/repository.ts";
import {
  SceneBackgroundMusicError,
  ScenePositionConflictError,
  createSceneRepository,
} from "../apps/api/src/scenes/repository.ts";
import { createSceneService } from "../apps/api/src/scenes/service.ts";

const episodeId = randomUUID();
const sceneId = randomUUID();
const musicId = randomUUID();
const missing = {
  error: { code: "NOT_FOUND", message: "Resource not found.", details: [] },
};
const invalid = {
  error: {
    code: "VALIDATION_ERROR",
    message: "The request contains invalid data.",
    details: [],
  },
};
const conflict = {
  error: { code: "CONFLICT", message: "Resource conflict.", details: [] },
};

function stubApp() {
  const sceneService = {
    list: vi.fn(),
    create: vi.fn(),
    reorder: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const app = createApp({ scenes: sceneService });
  onTestFinished(() => app.close());
  return { app, sceneService };
}

test("scene routes validate IDs and payloads before calling the service", async () => {
  const { app, sceneService } = stubApp();
  for (const method of ["GET", "POST", "PUT"]) {
    const response = await app.inject({
      method,
      url: `/episodes/bad/scenes${method === "PUT" ? "/order" : ""}`,
      ...(method === "POST"
        ? { payload: { title: "Scene" } }
        : method === "PUT"
          ? { payload: { sceneIds: [] } }
          : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const response = await app.inject({
      method,
      url: "/scenes/bad",
      ...(method === "PATCH" ? { payload: { title: "New" } } : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { title: "" },
    { title: "Scene", backgroundMusicId: "bad" },
    { title: "Scene", position: 1 },
    { title: "Scene", episodeId },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: `/episodes/${episodeId}/scenes`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { title: "" },
    { position: 1 },
    { episodeId },
    { backgroundMusicId: "bad" },
  ]) {
    const response = await app.inject({
      method: "PATCH",
      url: `/scenes/${sceneId}`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { sceneIds: ["bad"] },
    { sceneIds: [sceneId, sceneId] },
    { sceneIds: [], extra: true },
  ]) {
    const response = await app.inject({
      method: "PUT",
      url: `/episodes/${episodeId}/scenes/order`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const operation of Object.values(sceneService))
    expect(operation).not.toHaveBeenCalled();
});

test("scene routes expose CRUD, reorder and standard missing/invalid/conflict responses", async () => {
  const { app, sceneService } = stubApp();
  const record = {
    id: sceneId,
    episodeId,
    title: "Scene",
    backgroundMusicId: null,
    position: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  for (const [method, url, payload] of [
    ["GET", `/episodes/${episodeId}/scenes`],
    ["POST", `/episodes/${episodeId}/scenes`, { title: "Scene" }],
    ["GET", `/scenes/${sceneId}`],
    ["PATCH", `/scenes/${sceneId}`, { title: "New" }],
    ["DELETE", `/scenes/${sceneId}`],
  ]) {
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toStrictEqual(missing);
  }
  sceneService.list.mockResolvedValue([record]);
  sceneService.create.mockResolvedValue(record);
  sceneService.find.mockResolvedValue(record);
  sceneService.update.mockResolvedValue({
    ...record,
    backgroundMusicId: musicId,
  });
  sceneService.delete.mockResolvedValue(true);
  expect(
    (await app.inject({ url: `/episodes/${episodeId}/scenes` })).json(),
  ).toStrictEqual([record]);
  expect(sceneService.list).toHaveBeenCalledWith(episodeId);
  const created = await app.inject({
    method: "POST",
    url: `/episodes/${episodeId}/scenes`,
    payload: { title: "Scene", backgroundMusicId: null },
  });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toStrictEqual(record);
  expect(sceneService.create).toHaveBeenCalledWith(episodeId, {
    title: "Scene",
    backgroundMusicId: null,
  });
  expect(
    (await app.inject({ url: `/scenes/${sceneId}` })).json(),
  ).toStrictEqual(record);
  const updated = await app.inject({
    method: "PATCH",
    url: `/scenes/${sceneId}`,
    payload: { backgroundMusicId: musicId },
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json().backgroundMusicId).toBe(musicId);
  expect(sceneService.update).toHaveBeenCalledWith(sceneId, {
    backgroundMusicId: musicId,
  });
  const deleted = await app.inject({
    method: "DELETE",
    url: `/scenes/${sceneId}`,
  });
  expect(deleted.statusCode).toBe(204);
  expect(deleted.body).toBe("");
  expect(sceneService.delete).toHaveBeenCalledWith(sceneId);
  const orderUrl = `/episodes/${episodeId}/scenes/order`;
  sceneService.reorder
    .mockResolvedValueOnce("not_found")
    .mockResolvedValueOnce("invalid")
    .mockResolvedValueOnce("ok");
  for (const [status, body] of [
    [404, missing],
    [400, invalid],
  ]) {
    const response = await app.inject({
      method: "PUT",
      url: orderUrl,
      payload: { sceneIds: [sceneId] },
    });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toStrictEqual(body);
  }
  const reordered = await app.inject({
    method: "PUT",
    url: orderUrl,
    payload: { sceneIds: [] },
  });
  expect(reordered.statusCode).toBe(204);
  expect(reordered.body).toBe("");
  expect(sceneService.reorder).toHaveBeenLastCalledWith(episodeId, []);
  sceneService.create
    .mockRejectedValueOnce(new SceneBackgroundMusicError())
    .mockRejectedValueOnce(new ScenePositionConflictError());
  for (const [status, body] of [
    [400, invalid],
    [409, conflict],
  ]) {
    const response = await app.inject({
      method: "POST",
      url: `/episodes/${episodeId}/scenes`,
      payload: { title: "Scene" },
    });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toStrictEqual(body);
  }
});

test("scene list checks the parent before querying its children", async () => {
  const repository = { list: vi.fn() };
  const parents = { find: vi.fn().mockResolvedValue(undefined) };
  const service = createSceneService(repository, parents);
  expect(await service.list(episodeId)).toBeUndefined();
  expect(parents.find).toHaveBeenCalledWith(episodeId);
  expect(repository.list).not.toHaveBeenCalled();
});

test.skipIf(!process.env.DATABASE_URL)(
  "scene HTTP CRUD validates music references, appends positions and cascades cue points",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const app = createApp({
      scenes: createSceneService(
        createSceneRepository(database.db),
        createEpisodeRepository(database.db),
      ),
    });
    const projectIds = [];
    const mediaIds = [];
    onTestFinished(async () => {
      try {
        await app.close();
        for (const id of projectIds.reverse())
          await database.db.delete(projects).where(eq(projects.id, id));
        for (const id of mediaIds)
          await database.db.delete(mediaItems).where(eq(mediaItems.id, id));
      } finally {
        await database.close();
      }
    });
    const [owner, other] = await database.db
      .insert(projects)
      .values([
        { title: "Owner", genre: "Drama", description: "" },
        { title: "Other", genre: "Drama", description: "" },
      ])
      .returning();
    projectIds.push(owner.id, other.id);
    const [episode, outsiderEpisode] = await database.db
      .insert(episodes)
      .values([
        { projectId: owner.id, title: "Pilot", description: "", position: 0 },
        { projectId: other.id, title: "Other", description: "", position: 0 },
      ])
      .returning();
    const [music, effect] = await database.db
      .insert(mediaItems)
      .values([
        {
          name: "Theme",
          type: "background_music",
          fileName: "theme.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 1n,
        },
        {
          name: "Effect",
          type: "sound_effect",
          fileName: "effect.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 1n,
        },
      ])
      .returning();
    mediaIds.push(music.id, effect.id);
    const create = async (id, payload) =>
      app.inject({ method: "POST", url: `/episodes/${id}/scenes`, payload });
    for (const method of ["GET", "POST"]) {
      const response = await app.inject({
        method,
        url: `/episodes/${randomUUID()}/scenes`,
        ...(method === "POST" ? { payload: { title: "A" } } : {}),
      });
      expect(response.statusCode).toBe(404);
    }
    expect(
      (await app.inject({ url: `/episodes/${episode.id}/scenes` })).json(),
    ).toEqual([]);
    for (const id of [randomUUID(), effect.id]) {
      const response = await create(episode.id, {
        title: "Invalid music",
        backgroundMusicId: id,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toStrictEqual(invalid);
    }
    const [firstResponse, secondResponse] = await Promise.all([
      create(episode.id, { title: "First", backgroundMusicId: music.id }),
      create(episode.id, { title: "Second" }),
    ]);
    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(201);
    const [first, second] = [firstResponse.json(), secondResponse.json()];
    expect([first.position, second.position].sort()).toEqual([0, 1]);
    expect(first).toMatchObject({
      episodeId: episode.id,
      backgroundMusicId: music.id,
      title: "First",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(second.backgroundMusicId).toBeNull();
    const outsider = (
      await create(outsiderEpisode.id, { title: "Outsider" })
    ).json();
    expect(outsider.position).toBe(0);
    const list = async (id) =>
      (await app.inject({ url: `/episodes/${id}/scenes` })).json();
    expect((await list(episode.id)).map(({ position }) => position)).toEqual([
      0, 1,
    ]);
    // Legacy equal positions sort deterministically and append uses the maximum.
    await database.db
      .update(scenes)
      .set({ position: 0 })
      .where(eq(scenes.id, second.id));
    expect((await list(episode.id)).map(({ id }) => id)).toEqual(
      [first.id, second.id].sort(),
    );
    const thirdResponse = await create(episode.id, { title: "Third" });
    expect(thirdResponse.statusCode).toBe(201);
    expect(thirdResponse.json().position).toBe(1);
    const found = await app.inject({ url: `/scenes/${first.id}` });
    expect(found.json()).toStrictEqual(first);
    const invalidUpdate = await app.inject({
      method: "PATCH",
      url: `/scenes/${first.id}`,
      payload: { backgroundMusicId: effect.id },
    });
    expect(invalidUpdate.statusCode).toBe(400);
    expect(invalidUpdate.json()).toStrictEqual(invalid);
    const updated = await app.inject({
      method: "PATCH",
      url: `/scenes/${first.id}`,
      payload: { title: "Updated", backgroundMusicId: null },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: first.id,
      title: "Updated",
      backgroundMusicId: null,
      episodeId: episode.id,
      position: 0,
    });
    expect(Date.parse(updated.json().updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(first.updatedAt),
    );
    const relinked = await app.inject({
      method: "PATCH",
      url: `/scenes/${second.id}`,
      payload: { backgroundMusicId: music.id },
    });
    expect(relinked.statusCode).toBe(200);
    expect(relinked.json().backgroundMusicId).toBe(music.id);
    await expect(
      database.db.delete(mediaItems).where(eq(mediaItems.id, music.id)),
    ).rejects.toThrow();
    const [character] = await database.db
      .insert(characters)
      .values({ projectId: owner.id, name: "Voice", type: "main" })
      .returning();
    const [point] = await database.db
      .insert(cuePoints)
      .values({
        sceneId: first.id,
        characterId: character.id,
        spokenText: "Line",
        position: 0,
      })
      .returning();
    expect(
      (await app.inject({ method: "DELETE", url: `/scenes/${first.id}` }))
        .statusCode,
    ).toBe(204);
    expect(
      await database.db
        .select()
        .from(cuePoints)
        .where(eq(cuePoints.id, point.id)),
    ).toEqual([]);
    expect((await app.inject({ url: `/scenes/${first.id}` })).statusCode).toBe(
      404,
    );
    expect((await list(episode.id)).map(({ id }) => id)).toEqual([
      second.id,
      thirdResponse.json().id,
    ]);
    expect((await list(outsiderEpisode.id)).map(({ id }) => id)).toEqual([
      outsider.id,
    ]);
    await database.db
      .update(scenes)
      .set({ position: 2147483647 })
      .where(eq(scenes.id, second.id));
    const exhausted = await create(episode.id, { title: "Overflow" });
    expect(exhausted.statusCode).toBe(409);
    expect(exhausted.json()).toStrictEqual(conflict);
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "scene reorder validates complete episode membership and persists order across requests",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const app = createApp({
      scenes: createSceneService(
        createSceneRepository(database.db),
        createEpisodeRepository(database.db),
      ),
    });
    const projectIds = [];
    onTestFinished(async () => {
      try {
        await app.close();
        for (const id of projectIds.reverse())
          await database.db.delete(projects).where(eq(projects.id, id));
      } finally {
        await database.close();
      }
    });
    const [project] = await database.db
      .insert(projects)
      .values({ title: "Order", genre: "Drama", description: "" })
      .returning();
    projectIds.push(project.id);
    const [episode, other, empty] = await database.db
      .insert(episodes)
      .values([
        { projectId: project.id, title: "One", description: "", position: 0 },
        { projectId: project.id, title: "Two", description: "", position: 1 },
        { projectId: project.id, title: "Empty", description: "", position: 2 },
      ])
      .returning();
    const create = async (id, title) =>
      (
        await app.inject({
          method: "POST",
          url: `/episodes/${id}/scenes`,
          payload: { title },
        })
      ).json();
    const first = await create(episode.id, "First");
    const second = await create(episode.id, "Second");
    const third = await create(episode.id, "Third");
    const outsider = await create(other.id, "Outsider");
    const list = async (id) =>
      (await app.inject({ url: `/episodes/${id}/scenes` })).json();
    const put = (id, sceneIds) =>
      app.inject({
        method: "PUT",
        url: `/episodes/${id}/scenes/order`,
        payload: { sceneIds },
      });
    expect((await put(randomUUID(), [])).statusCode).toBe(404);
    expect((await put(empty.id, [])).statusCode).toBe(204);
    for (const ids of [
      [],
      [first.id, second.id],
      [first.id, second.id, outsider.id],
      [first.id, second.id, second.id],
      [first.id, second.id, third.id, outsider.id],
    ]) {
      const response = await put(episode.id, ids);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toStrictEqual(invalid);
      expect((await list(episode.id)).map(({ id }) => id)).toEqual([
        first.id,
        second.id,
        third.id,
      ]);
    }
    const response = await put(episode.id, [third.id, first.id, second.id]);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(
      (await list(episode.id)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ]);
    expect(
      (await list(other.id)).map(({ id, position }) => [id, position]),
    ).toEqual([[outsider.id, 0]]);
  },
);
