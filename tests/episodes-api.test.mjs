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
  projects,
  scenes,
} from "../apps/api/src/db/schema.ts";
import {
  EpisodePositionConflictError,
  createEpisodeRepository,
} from "../apps/api/src/episodes/repository.ts";
import { createEpisodeService } from "../apps/api/src/episodes/service.ts";
import { createProjectRepository } from "../apps/api/src/projects/repository.ts";

const projectId = randomUUID();
const episodeId = randomUUID();
const input = { title: "Pilot", description: "First episode" };
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

function stubApp() {
  const episodes = {
    list: vi.fn(),
    create: vi.fn(),
    reorder: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const app = createApp({ episodes });
  onTestFinished(() => app.close());
  return { app, episodes };
}

test("episode routes validate IDs and payloads before calling the service", async () => {
  const { app, episodes } = stubApp();
  for (const method of ["GET", "POST"]) {
    const response = await app.inject({
      method,
      url: "/projects/bad/episodes",
      ...(method === "POST" ? { payload: input } : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const response = await app.inject({
      method,
      url: "/episodes/bad",
      ...(method === "PATCH" ? { payload: { title: "New" } } : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { title: "", description: "" },
    { title: "Pilot" },
    { ...input, position: 7 },
    { ...input, projectId },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/episodes`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { title: "" },
    { position: 1 },
    { projectId },
    { description: 5 },
  ]) {
    const response = await app.inject({
      method: "PATCH",
      url: `/episodes/${episodeId}`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const operation of Object.values(episodes))
    expect(operation).not.toHaveBeenCalled();
});

test("episode routes return CRUD responses and 404 for unknown resources", async () => {
  const { app, episodes } = stubApp();
  const record = {
    id: episodeId,
    projectId,
    ...input,
    position: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  for (const [method, url, payload] of [
    ["GET", `/projects/${projectId}/episodes`],
    ["POST", `/projects/${projectId}/episodes`, input],
    ["GET", `/episodes/${episodeId}`],
    ["PATCH", `/episodes/${episodeId}`, { title: "New" }],
    ["DELETE", `/episodes/${episodeId}`],
  ]) {
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toStrictEqual(missing);
  }
  episodes.list.mockResolvedValue([record]);
  episodes.create.mockResolvedValue(record);
  episodes.find.mockResolvedValue(record);
  episodes.update.mockResolvedValue({ ...record, title: "New" });
  episodes.delete.mockResolvedValue(true);
  const list = await app.inject({
    method: "GET",
    url: `/projects/${projectId}/episodes`,
  });
  expect(list.statusCode).toBe(200);
  expect(list.json()).toStrictEqual([record]);
  expect(episodes.list).toHaveBeenCalledWith(projectId);
  const created = await app.inject({
    method: "POST",
    url: `/projects/${projectId}/episodes`,
    payload: input,
  });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toStrictEqual(record);
  expect(episodes.create).toHaveBeenCalledWith(projectId, input);
  const found = await app.inject({
    method: "GET",
    url: `/episodes/${episodeId}`,
  });
  expect(found.statusCode).toBe(200);
  expect(found.json()).toStrictEqual(record);
  const updated = await app.inject({
    method: "PATCH",
    url: `/episodes/${episodeId}`,
    payload: { title: "New" },
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json()).toStrictEqual({ ...record, title: "New" });
  expect(episodes.update).toHaveBeenCalledWith(episodeId, { title: "New" });
  const deleted = await app.inject({
    method: "DELETE",
    url: `/episodes/${episodeId}`,
  });
  expect(deleted.statusCode).toBe(204);
  expect(deleted.body).toBe("");
  expect(episodes.delete).toHaveBeenCalledWith(episodeId);
});

test("episode reorder validates the project and ordered IDs", async () => {
  const { app, episodes } = stubApp();
  const url = `/projects/${projectId}/episodes/order`;
  for (const [path, payload] of [
    ["/projects/bad/episodes/order", { episodeIds: [] }],
    [url, {}],
    [url, { episodeIds: ["bad"] }],
    [url, { episodeIds: [episodeId, episodeId] }],
    [url, { episodeIds: [], extra: true }],
    [url, { episodeIds: "wrong" }],
  ]) {
    const response = await app.inject({ method: "PUT", url: path, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  expect(episodes.reorder).not.toHaveBeenCalled();
  for (const [result, status, body] of [
    ["not_found", 404, missing],
    ["invalid", 400, invalid],
  ]) {
    episodes.reorder.mockResolvedValueOnce(result);
    const response = await app.inject({
      method: "PUT",
      url,
      payload: { episodeIds: [episodeId] },
    });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toStrictEqual(body);
  }
  episodes.reorder.mockResolvedValue("ok");
  const response = await app.inject({
    method: "PUT",
    url,
    payload: { episodeIds: [] },
  });
  expect(response.statusCode).toBe(204);
  expect(response.body).toBe("");
  expect(episodes.reorder).toHaveBeenLastCalledWith(projectId, []);
});

test("episode list checks the parent before querying its children", async () => {
  const repository = { list: vi.fn() };
  const parents = { find: vi.fn().mockResolvedValue(undefined) };
  const service = createEpisodeService(repository, parents);
  expect(await service.list(projectId)).toBeUndefined();
  expect(parents.find).toHaveBeenCalledWith(projectId);
  expect(repository.list).not.toHaveBeenCalled();
});

test("episode append exhaustion returns conflict without exposing internals", async () => {
  const { app, episodes } = stubApp();
  episodes.create.mockRejectedValue(new EpisodePositionConflictError());
  const response = await app.inject({
    method: "POST",
    url: `/projects/${projectId}/episodes`,
    payload: input,
  });
  expect(response.statusCode).toBe(409);
  expect(response.json()).toStrictEqual({
    error: { code: "CONFLICT", message: "Resource conflict.", details: [] },
  });
});

test.skipIf(!process.env.DATABASE_URL)(
  "episode HTTP CRUD persists per-project positions, stable ordering and cascading deletion",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const projectRepository = createProjectRepository(database.db);
    const app = createApp({
      episodes: createEpisodeService(
        createEpisodeRepository(database.db),
        projectRepository,
      ),
    });
    const ids = [];
    onTestFinished(async () => {
      try {
        await app.close();
        for (const id of ids.reverse())
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
    ids.push(owner.id, other.id);
    const absent = randomUUID();
    for (const method of ["GET", "POST"]) {
      const response = await app.inject({
        method,
        url: `/projects/${absent}/episodes`,
        ...(method === "POST" ? { payload: input } : {}),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toStrictEqual(missing);
    }
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/projects/${owner.id}/episodes`,
        })
      ).json(),
    ).toEqual([]);
    const create = async (id, title) => {
      const response = await app.inject({
        method: "POST",
        url: `/projects/${id}/episodes`,
        payload: { title, description: "" },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        id: expect.any(String),
        projectId: id,
        title,
        description: "",
        position: expect.any(Number),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      return response.json();
    };
    const [first, second] = await Promise.all([
      create(owner.id, "First"),
      create(owner.id, "Second"),
    ]);
    expect([first.position, second.position].sort()).toEqual([0, 1]);
    const outsider = await create(other.id, "Outsider");
    expect(outsider.position).toBe(0);
    const list = await app.inject({
      method: "GET",
      url: `/projects/${owner.id}/episodes`,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((episode) => episode.position)).toEqual([0, 1]);
    // Legacy/equal positions remain deterministic; append still uses the maximum.
    await database.db
      .update(episodes)
      .set({ position: 0 })
      .where(eq(episodes.id, second.id));
    const ties = (
      await app.inject({ method: "GET", url: `/projects/${owner.id}/episodes` })
    ).json();
    expect(ties.map((episode) => episode.id)).toEqual(
      [first.id, second.id].sort(),
    );
    const third = await create(owner.id, "Third");
    expect(third.position).toBe(1);
    const fetched = await app.inject({
      method: "GET",
      url: `/episodes/${third.id}`,
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toStrictEqual(third);
    const timestamp = new Date("2020-01-01T00:00:00Z");
    await database.db
      .update(episodes)
      .set({ updatedAt: timestamp })
      .where(eq(episodes.id, third.id));
    const updated = await app.inject({
      method: "PATCH",
      url: `/episodes/${third.id}`,
      payload: { title: "Revised", description: "Changed" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: third.id,
      projectId: owner.id,
      title: "Revised",
      description: "Changed",
      position: 1,
      createdAt: third.createdAt,
    });
    expect(Date.parse(updated.json().updatedAt)).toBeGreaterThan(
      timestamp.getTime(),
    );
    const [scene] = await database.db
      .insert(scenes)
      .values({ episodeId: third.id, title: "Scene", position: 0 })
      .returning();
    const [character] = await database.db
      .insert(characters)
      .values({ projectId: owner.id, name: "Voice", type: "main" })
      .returning();
    const [point] = await database.db
      .insert(cuePoints)
      .values({
        sceneId: scene.id,
        characterId: character.id,
        spokenText: "Line",
        position: 0,
      })
      .returning();
    const removed = await app.inject({
      method: "DELETE",
      url: `/episodes/${third.id}`,
    });
    expect(removed.statusCode).toBe(204);
    expect(removed.body).toBe("");
    expect(
      await database.db.select().from(scenes).where(eq(scenes.id, scene.id)),
    ).toEqual([]);
    expect(
      await database.db
        .select()
        .from(cuePoints)
        .where(eq(cuePoints.id, point.id)),
    ).toEqual([]);
    for (const method of ["GET", "DELETE"]) {
      const response = await app.inject({
        method,
        url: `/episodes/${third.id}`,
      });
      expect(response.statusCode).toBe(404);
    }
    const gone = await app.inject({
      method: "PATCH",
      url: `/episodes/${third.id}`,
      payload: { title: "Again" },
    });
    expect(gone.statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/projects/${other.id}/episodes`,
        })
      ).json(),
    ).toEqual([outsider]);
    await database.db
      .update(episodes)
      .set({ position: 2147483647 })
      .where(eq(episodes.id, first.id));
    const exhausted = await app.inject({
      method: "POST",
      url: `/projects/${owner.id}/episodes`,
      payload: input,
    });
    expect(exhausted.statusCode).toBe(409);
    expect(
      await database.db
        .select()
        .from(episodes)
        .where(eq(episodes.projectId, owner.id)),
    ).toHaveLength(2);
  },
);

test.skipIf(!process.env.DATABASE_URL)(
  "episode reorder atomically validates membership and persists a complete order",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const app = createApp({
      episodes: createEpisodeService(
        createEpisodeRepository(database.db),
        createProjectRepository(database.db),
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
    const [owner, other, empty] = await database.db
      .insert(projects)
      .values([
        { title: "Order owner", genre: "Drama", description: "" },
        { title: "Order other", genre: "Drama", description: "" },
        { title: "Order empty", genre: "Drama", description: "" },
      ])
      .returning();
    projectIds.push(owner.id, other.id, empty.id);
    const create = async (project, title) => {
      const response = await app.inject({
        method: "POST",
        url: `/projects/${project}/episodes`,
        payload: { title, description: "" },
      });
      expect(response.statusCode).toBe(201);
      return response.json();
    };
    const first = await create(owner.id, "First");
    const second = await create(owner.id, "Second");
    const third = await create(owner.id, "Third");
    const outsider = await create(other.id, "Outsider");
    const put = (project, episodeIds) =>
      app.inject({
        method: "PUT",
        url: `/projects/${project}/episodes/order`,
        payload: { episodeIds },
      });
    const list = async (project) =>
      (await app.inject({ url: `/projects/${project}/episodes` })).json();
    expect((await put(randomUUID(), [])).statusCode).toBe(404);
    const emptyResult = await put(empty.id, []);
    expect(emptyResult.statusCode).toBe(204);
    expect(emptyResult.body).toBe("");
    expect(await list(empty.id)).toEqual([]);
    for (const ids of [
      [],
      [first.id, second.id],
      [first.id, second.id, outsider.id],
      [first.id, second.id, second.id],
      [first.id, second.id, third.id, outsider.id],
    ]) {
      const response = await put(owner.id, ids);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toStrictEqual(invalid);
      expect((await list(owner.id)).map((episode) => episode.id)).toEqual([
        first.id,
        second.id,
        third.id,
      ]);
    }
    const response = await put(owner.id, [third.id, first.id, second.id]);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(
      (await list(owner.id)).map(({ id, position }) => [id, position]),
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
