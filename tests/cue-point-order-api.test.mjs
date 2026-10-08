import { randomUUID } from "node:crypto";
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";
import { expect, onTestFinished, test, vi } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { parseConfig } from "../apps/api/src/config.ts";
import { createCuePointRepository } from "../apps/api/src/cue-points/repository.ts";
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
import { reorderCuePointsSchema } from "../packages/shared/src/index.ts";

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
const sceneId = randomUUID();
const pointId = randomUUID();

test("cue point order contract requires a unique UUID list and no extra fields", () => {
  expect(reorderCuePointsSchema.parse({ cuePointIds: [] })).toEqual({
    cuePointIds: [],
  });
  expect(reorderCuePointsSchema.parse({ cuePointIds: [pointId] })).toEqual({
    cuePointIds: [pointId],
  });
  for (const payload of [
    {},
    { cuePointIds: ["bad"] },
    { cuePointIds: [pointId, pointId] },
    { cuePointIds: [], extra: true },
    { cuePointIds: null },
  ]) {
    expect(reorderCuePointsSchema.safeParse(payload).success).toBe(false);
  }
});

test("cue point order route validates requests and maps results without changing CRUD", async () => {
  const points = {
    list: vi.fn(),
    create: vi.fn(),
    reorder: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const app = createApp({ cuePoints: points });
  onTestFinished(() => app.close());
  for (const [id, payload] of [
    ["bad", { cuePointIds: [] }],
    [sceneId, {}],
    [sceneId, { cuePointIds: ["bad"] }],
    [sceneId, { cuePointIds: [pointId, pointId] }],
    [sceneId, { cuePointIds: [], extra: true }],
  ]) {
    const response = await app.inject({
      method: "PUT",
      url: `/scenes/${id}/cue-points/order`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual(invalid);
  }
  expect(points.reorder).not.toHaveBeenCalled();
  points.reorder
    .mockResolvedValueOnce("not_found")
    .mockResolvedValueOnce("invalid")
    .mockResolvedValueOnce("ok");
  for (const [status, body] of [
    [404, missing],
    [400, invalid],
  ]) {
    const response = await app.inject({
      method: "PUT",
      url: `/scenes/${sceneId}/cue-points/order`,
      payload: { cuePointIds: [pointId] },
    });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
  }
  const response = await app.inject({
    method: "PUT",
    url: `/scenes/${sceneId}/cue-points/order`,
    payload: { cuePointIds: [] },
  });
  expect(response.statusCode).toBe(204);
  expect(response.body).toBe("");
  expect(points.reorder).toHaveBeenLastCalledWith(sceneId, []);
  for (const operation of [
    points.list,
    points.create,
    points.find,
    points.update,
    points.delete,
  ])
    expect(operation).not.toHaveBeenCalled();
});

test.skipIf(!process.env.DATABASE_URL)(
  "cue point reorder checks full scene membership atomically and persists after reload",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const app = createApp({
      cuePoints: createCuePointService(
        createCuePointRepository(database.db),
        createSceneRepository(database.db),
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
        { title: "Order owner", genre: "Drama", description: "" },
        { title: "Other owner", genre: "Drama", description: "" },
      ])
      .returning();
    projectIds.push(owner.id, other.id);
    const [episode, otherEpisode] = await database.db
      .insert(episodes)
      .values([
        { projectId: owner.id, title: "One", description: "", position: 0 },
        { projectId: other.id, title: "Two", description: "", position: 0 },
      ])
      .returning();
    const [scene, empty, outsiderScene] = await database.db
      .insert(scenes)
      .values([
        { episodeId: episode.id, title: "One", position: 0 },
        { episodeId: episode.id, title: "Empty", position: 1 },
        { episodeId: otherEpisode.id, title: "Other", position: 0 },
      ])
      .returning();
    const [voice, otherVoice] = await database.db
      .insert(characters)
      .values([
        { projectId: owner.id, name: "Owner", type: "main" },
        { projectId: other.id, name: "Other", type: "main" },
      ])
      .returning();
    const post = async (id, characterId, spokenText) => {
      const response = await app.inject({
        method: "POST",
        url: `/scenes/${id}/cue-points`,
        payload: { characterId, spokenText },
      });
      expect(response.statusCode).toBe(201);
      return response.json();
    };
    const first = await post(scene.id, voice.id, "First");
    const second = await post(scene.id, voice.id, "Second");
    const third = await post(scene.id, voice.id, "Third");
    const outsider = await post(outsiderScene.id, otherVoice.id, "Outsider");
    const list = async (id) => {
      const response = await app.inject({ url: `/scenes/${id}/cue-points` });
      expect(response.statusCode).toBe(200);
      return response.json();
    };
    const put = (id, cuePointIds) =>
      app.inject({
        method: "PUT",
        url: `/scenes/${id}/cue-points/order`,
        payload: { cuePointIds },
      });
    expect((await put(randomUUID(), [])).statusCode).toBe(404);
    expect((await put(empty.id, [])).statusCode).toBe(204);
    for (const ids of [
      [],
      [first.id, second.id],
      [first.id, second.id, randomUUID()],
      [first.id, second.id, outsider.id],
      [first.id, second.id, second.id],
      [first.id, second.id, third.id, outsider.id],
    ]) {
      const response = await put(scene.id, ids);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual(invalid);
      expect(
        (await list(scene.id)).map(({ id, position }) => [id, position]),
      ).toEqual([
        [first.id, 0],
        [second.id, 1],
        [third.id, 2],
      ]);
    }
    const response = await put(scene.id, [third.id, first.id, second.id]);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(
      (await list(scene.id)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ]);
    const rows = await database.db
      .select({ id: cuePoints.id, position: cuePoints.position })
      .from(cuePoints)
      .where(eq(cuePoints.sceneId, scene.id));
    expect(new Map(rows.map(({ id, position }) => [id, position]))).toEqual(
      new Map([
        [third.id, 0],
        [first.id, 1],
        [second.id, 2],
      ]),
    );
    expect(
      (await list(outsiderScene.id)).map(({ id, position }) => [id, position]),
    ).toEqual([[outsider.id, 0]]);
    expect(
      (await app.inject({ url: `/cue-points/${first.id}` })).json(),
    ).toMatchObject({
      id: first.id,
      spokenText: "First",
      position: 1,
      soundEffectIds: [],
    });
  },
);
