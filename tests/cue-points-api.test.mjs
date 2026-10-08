import { randomUUID } from "node:crypto";
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";
import { expect, onTestFinished, test, vi } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { parseConfig } from "../apps/api/src/config.ts";
import {
  createCuePointRepository,
  CuePointPositionConflictError,
} from "../apps/api/src/cue-points/repository.ts";
import { createCuePointService } from "../apps/api/src/cue-points/service.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";
import {
  characters,
  cuePoints,
  episodes,
  projects,
  scenes,
} from "../apps/api/src/db/schema.ts";
import { createSceneRepository } from "../apps/api/src/scenes/repository.ts";

const sceneId = randomUUID();
const pointId = randomUUID();
const characterId = randomUUID();
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

function stubApp() {
  const points = {
    list: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const app = createApp({ cuePoints: points });
  onTestFinished(() => app.close());
  return { app, points };
}

test("cue point routes reject invalid IDs and noneditable or invalid fields", async () => {
  const { app, points } = stubApp();
  for (const method of ["GET", "POST"]) {
    const response = await app.inject({
      method,
      url: "/scenes/bad/cue-points",
      ...(method === "POST"
        ? { payload: { characterId, spokenText: "Line" } }
        : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const response = await app.inject({
      method,
      url: "/cue-points/bad",
      ...(method === "PATCH" ? { payload: { spokenText: "Line" } } : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { spokenText: "Line" },
    { characterId: "bad", spokenText: "Line" },
    { characterId, spokenText: null },
    { characterId, spokenText: "Line", position: 0 },
    { characterId, spokenText: "Line", sceneId },
    { characterId, spokenText: "Line", soundEffectIds: ["bad"] },
    { characterId, spokenText: "Line", soundEffectIds: [pointId, pointId] },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: `/scenes/${sceneId}/cue-points`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { characterId: "bad" },
    { spokenText: null },
    { position: 1 },
    { sceneId },
    { soundEffectIds: ["bad"] },
    { soundEffectIds: [pointId, pointId] },
  ]) {
    const response = await app.inject({
      method: "PATCH",
      url: `/cue-points/${pointId}`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const operation of Object.values(points))
    expect(operation).not.toHaveBeenCalled();
});

test("cue point routes expose CRUD with standard missing, invalid and conflict responses", async () => {
  const { app, points } = stubApp();
  const record = {
    id: pointId,
    sceneId,
    characterId,
    spokenText: "Line",
    soundEffectIds: [],
    position: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  for (const [method, url, payload] of [
    ["GET", `/scenes/${sceneId}/cue-points`],
    [
      "POST",
      `/scenes/${sceneId}/cue-points`,
      { characterId, spokenText: "Line" },
    ],
    ["GET", `/cue-points/${pointId}`],
    ["PATCH", `/cue-points/${pointId}`, { spokenText: "Changed" }],
    ["DELETE", `/cue-points/${pointId}`],
  ]) {
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toStrictEqual(missing);
  }
  points.list.mockResolvedValue([record]);
  points.create.mockResolvedValue(record);
  points.find.mockResolvedValue(record);
  points.update.mockResolvedValue({ ...record, spokenText: "Changed" });
  points.delete.mockResolvedValue(true);
  expect(
    (await app.inject({ url: `/scenes/${sceneId}/cue-points` })).json(),
  ).toEqual([record]);
  expect(points.list).toHaveBeenCalledWith(sceneId);
  const created = await app.inject({
    method: "POST",
    url: `/scenes/${sceneId}/cue-points`,
    payload: { characterId, spokenText: "Line" },
  });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toEqual(record);
  expect(points.create).toHaveBeenCalledWith(sceneId, {
    characterId,
    spokenText: "Line",
  });
  expect((await app.inject({ url: `/cue-points/${pointId}` })).json()).toEqual(
    record,
  );
  const updated = await app.inject({
    method: "PATCH",
    url: `/cue-points/${pointId}`,
    payload: { spokenText: "Changed" },
  });
  expect(updated.json().spokenText).toBe("Changed");
  expect(points.update).toHaveBeenCalledWith(pointId, {
    spokenText: "Changed",
  });
  const deleted = await app.inject({
    method: "DELETE",
    url: `/cue-points/${pointId}`,
  });
  expect(deleted.statusCode).toBe(204);
  expect(deleted.body).toBe("");
  points.create
    .mockResolvedValueOnce("invalid")
    .mockRejectedValueOnce(new CuePointPositionConflictError());
  const invalidReference = await app.inject({
    method: "POST",
    url: `/scenes/${sceneId}/cue-points`,
    payload: { characterId, spokenText: "Line" },
  });
  expect(invalidReference.statusCode).toBe(400);
  expect(invalidReference.json()).toEqual(invalid);
  const overflow = await app.inject({
    method: "POST",
    url: `/scenes/${sceneId}/cue-points`,
    payload: { characterId, spokenText: "Line" },
  });
  expect(overflow.statusCode).toBe(409);
  expect(overflow.json().error.code).toBe("CONFLICT");
  points.update.mockResolvedValueOnce("invalid");
  const invalidUpdate = await app.inject({
    method: "PATCH",
    url: `/cue-points/${pointId}`,
    payload: { characterId },
  });
  expect(invalidUpdate.statusCode).toBe(400);
  expect(invalidUpdate.json()).toEqual(invalid);
});

test("cue point service checks scene existence before listing", async () => {
  const repository = { list: vi.fn() };
  const scenes = { find: vi.fn().mockResolvedValue(undefined) };
  const service = createCuePointService(repository, scenes);
  expect(await service.list(sceneId)).toBeUndefined();
  expect(repository.list).not.toHaveBeenCalled();
});

test.skipIf(!process.env.DATABASE_URL)(
  "cue point HTTP CRUD enforces scene project character ownership and stable positions",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const sceneRepository = createSceneRepository(database.db);
    const app = createApp({
      cuePoints: createCuePointService(
        createCuePointRepository(database.db),
        sceneRepository,
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
    const [owner, other] = await database.db
      .insert(projects)
      .values([
        { title: "Owner", genre: "Drama", description: "" },
        { title: "Other", genre: "Drama", description: "" },
      ])
      .returning();
    projectIds.push(owner.id, other.id);
    const [episode] = await database.db
      .insert(episodes)
      .values({
        projectId: owner.id,
        title: "One",
        description: "",
        position: 0,
      })
      .returning();
    const [scene, anotherScene] = await database.db
      .insert(scenes)
      .values([
        { episodeId: episode.id, title: "First", position: 0 },
        { episodeId: episode.id, title: "Second", position: 1 },
      ])
      .returning();
    const [voice, replacement, outsider] = await database.db
      .insert(characters)
      .values([
        { projectId: owner.id, name: "Voice", type: "main" },
        { projectId: owner.id, name: "Replacement", type: "supporting" },
        { projectId: other.id, name: "Outsider", type: "main" },
      ])
      .returning();
    const post = (id, characterId, spokenText) =>
      app.inject({
        method: "POST",
        url: `/scenes/${id}/cue-points`,
        payload: { characterId, spokenText },
      });
    for (const method of ["GET", "POST"]) {
      const response = await app.inject({
        method,
        url: `/scenes/${randomUUID()}/cue-points`,
        ...(method === "POST"
          ? { payload: { characterId: voice.id, spokenText: "Line" } }
          : {}),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(missing);
    }
    expect(
      (await app.inject({ url: `/scenes/${scene.id}/cue-points` })).json(),
    ).toEqual([]);
    for (const id of [randomUUID(), outsider.id]) {
      const response = await post(scene.id, id, "Invalid");
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(invalid);
    }
    const [firstResponse, secondResponse] = await Promise.all([
      post(scene.id, voice.id, "First"),
      post(scene.id, voice.id, "Second"),
    ]);
    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(201);
    const [first, second] = [firstResponse.json(), secondResponse.json()];
    expect([first.position, second.position].sort()).toEqual([0, 1]);
    expect(first).toMatchObject({
      sceneId: scene.id,
      characterId: voice.id,
      spokenText: "First",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(first.soundEffectIds).toEqual([]);
    const otherPoint = (
      await post(anotherScene.id, voice.id, "Other scene")
    ).json();
    expect(otherPoint.position).toBe(0);
    const list = async (id) =>
      (await app.inject({ url: `/scenes/${id}/cue-points` })).json();
    expect((await list(scene.id)).map(({ position }) => position)).toEqual([
      0, 1,
    ]);
    await database.db
      .update(cuePoints)
      .set({ position: 0 })
      .where(eq(cuePoints.id, second.id));
    expect((await list(scene.id)).map(({ id }) => id)).toEqual(
      [first.id, second.id].sort(),
    );
    const third = await post(scene.id, voice.id, "Third");
    expect(third.statusCode).toBe(201);
    expect(third.json().position).toBe(1);
    expect(
      (await app.inject({ url: `/cue-points/${first.id}` })).json(),
    ).toEqual(first);
    const patch = (id, payload) =>
      app.inject({ method: "PATCH", url: `/cue-points/${id}`, payload });
    for (const id of [outsider.id, randomUUID()]) {
      const response = await patch(first.id, { characterId: id });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(invalid);
      expect(
        (await app.inject({ url: `/cue-points/${first.id}` })).json(),
      ).toEqual(first);
    }
    const updated = await patch(first.id, {
      spokenText: "Updated",
      characterId: replacement.id,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      sceneId: scene.id,
      characterId: replacement.id,
      spokenText: "Updated",
      position: first.position,
    });
    expect(Date.parse(updated.json().updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(first.updatedAt),
    );
    expect(
      (
        await database.db
          .select()
          .from(cuePoints)
          .where(eq(cuePoints.id, first.id))
      )[0].spokenText,
    ).toBe("Updated");
    expect(
      (await app.inject({ method: "DELETE", url: `/cue-points/${first.id}` }))
        .statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ url: `/cue-points/${first.id}` })).statusCode,
    ).toBe(404);
    expect((await patch(first.id, { spokenText: "Again" })).statusCode).toBe(
      404,
    );
    expect(
      (await app.inject({ method: "DELETE", url: `/cue-points/${first.id}` }))
        .statusCode,
    ).toBe(404);
    expect((await list(anotherScene.id)).map(({ id }) => id)).toEqual([
      otherPoint.id,
    ]);
    await database.db
      .update(cuePoints)
      .set({ position: 2147483647 })
      .where(eq(cuePoints.id, second.id));
    const exhausted = await post(scene.id, voice.id, "Overflow");
    expect(exhausted.statusCode).toBe(409);
    expect(exhausted.json().error.code).toBe("CONFLICT");
  },
);
