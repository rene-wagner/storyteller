import { randomUUID } from "node:crypto";
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
import { createProjectRepository } from "../apps/api/src/projects/repository.ts";
import { createProjectService } from "../apps/api/src/projects/service.ts";
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";

const input = { title: "Pilot", genre: "Mystery", description: "Intro" };
const unknownId = randomUUID();
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
  const projects = {
    create: vi.fn(),
    list: vi.fn(async () => []),
    find: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const app = createApp({ projects });
  onTestFinished(() => app.close());
  return { app, projects };
}

test("project routes reject invalid input and IDs without calling the service", async () => {
  const { app, projects } = stubApp();
  for (const body of [
    {},
    { title: "", genre: "Mystery", description: "Intro" },
    { title: "Pilot", genre: "Mystery" },
    { ...input, unexpected: true },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: "/projects",
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const body of [
    {},
    { title: "" },
    { unexpected: "value" },
    { genre: null },
  ]) {
    const response = await app.inject({
      method: "PATCH",
      url: `/projects/${unknownId}`,
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const response = await app.inject({
      method,
      url: "/projects/not-a-uuid",
      ...(method === "PATCH" ? { payload: { title: "New" } } : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  expect(projects.create).not.toHaveBeenCalled();
  expect(projects.find).not.toHaveBeenCalled();
  expect(projects.update).not.toHaveBeenCalled();
  expect(projects.delete).not.toHaveBeenCalled();
});

test("project routes return created, listed, fetched and updated responses", async () => {
  const { app, projects } = stubApp();
  const record = {
    ...input,
    id: unknownId,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  projects.create.mockResolvedValue(record);
  projects.list.mockResolvedValue([record]);
  projects.find.mockResolvedValue(record);
  projects.update.mockResolvedValue({ ...record, genre: "Drama" });

  const created = await app.inject({
    method: "POST",
    url: "/projects",
    payload: input,
  });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toStrictEqual(record);
  expect(projects.create).toHaveBeenCalledWith(input);
  expect(
    (await app.inject({ method: "GET", url: "/projects" })).json(),
  ).toStrictEqual([record]);
  expect(
    (await app.inject({ method: "GET", url: `/projects/${unknownId}` })).json(),
  ).toStrictEqual(record);
  const updated = await app.inject({
    method: "PATCH",
    url: `/projects/${unknownId}`,
    payload: { genre: "Drama" },
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json()).toStrictEqual({ ...record, genre: "Drama" });
  expect(projects.update).toHaveBeenCalledWith(unknownId, { genre: "Drama" });
});

test("unknown projects return 404 and deletion returns an empty 204", async () => {
  const { app, projects } = stubApp();
  projects.delete.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const response = await app.inject({
      method,
      url: `/projects/${unknownId}`,
      ...(method === "PATCH" ? { payload: { genre: "Drama" } } : {}),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toStrictEqual(missing);
  }
  const deleted = await app.inject({
    method: "DELETE",
    url: `/projects/${unknownId}`,
  });
  expect(deleted.statusCode).toBe(204);
  expect(deleted.body).toBe("");
});

test("database failures do not expose internals", async () => {
  const { app, projects } = stubApp();
  projects.list.mockRejectedValue(new Error("private database path"));
  const response = await app.inject({ method: "GET", url: "/projects" });
  expect(response.statusCode).toBe(500);
  expect(response.json()).toStrictEqual({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      details: [],
    },
  });
  expect(response.body).not.toContain("private database path");
});

test.skipIf(!process.env.DATABASE_URL)(
  "project HTTP operations persist, sort deterministically, update timestamps and cascade deletion",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const app = createApp({
      projects: createProjectService(createProjectRepository(database.db)),
    });
    const ids = [];
    onTestFinished(async () => {
      try {
        await app.close();
        for (const id of ids)
          await database.db.delete(projects).where(eq(projects.id, id));
      } finally {
        await database.close();
      }
    });
    const create = async (title) => {
      const response = await app.inject({
        method: "POST",
        url: "/projects",
        payload: { ...input, title },
      });
      const created = response.json();
      if (
        typeof created.id === "string" &&
        /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(created.id)
      ) {
        ids.push(created.id);
      }
      expect(response.statusCode).toBe(201);
      expect(created).toMatchObject({
        ...input,
        title,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      return created;
    };
    const first = await create("First");
    const second = await create("Second");
    expect(
      await database.db
        .select()
        .from(projects)
        .where(eq(projects.id, first.id)),
    ).toHaveLength(1);
    const timestamp = new Date("2020-01-01T00:00:00Z");
    await database.db
      .update(projects)
      .set({ updatedAt: timestamp })
      .where(eq(projects.id, first.id));
    await database.db
      .update(projects)
      .set({ updatedAt: timestamp })
      .where(eq(projects.id, second.id));
    const orderedIds = [first.id, second.id].sort().reverse();
    const list = await app.inject({ method: "GET", url: "/projects" });
    expect(list.statusCode).toBe(200);
    expect(
      list
        .json()
        .filter((item) => orderedIds.includes(item.id))
        .map((item) => item.id),
    ).toEqual(orderedIds);
    const update = await app.inject({
      method: "PATCH",
      url: `/projects/${first.id}`,
      payload: { genre: "Drama" },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({
      id: first.id,
      title: "First",
      genre: "Drama",
      description: input.description,
    });
    expect(Date.parse(update.json().updatedAt)).toBeGreaterThan(
      timestamp.getTime(),
    );
    expect(
      (await app.inject({ method: "GET", url: "/projects" }))
        .json()
        .filter((item) => ids.includes(item.id))
        .map((item) => item.id),
    ).toEqual([first.id, second.id]);
    expect(
      (
        await app.inject({ method: "GET", url: `/projects/${first.id}` })
      ).json(),
    ).toStrictEqual(update.json());

    const [character] = await database.db
      .insert(characters)
      .values({ projectId: first.id, name: "Narrator", type: "main" })
      .returning();
    const [episode] = await database.db
      .insert(episodes)
      .values({
        projectId: first.id,
        title: "Episode",
        description: "",
        position: 0,
      })
      .returning();
    const [scene] = await database.db
      .insert(scenes)
      .values({ episodeId: episode.id, title: "Scene", position: 0 })
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
    const deleted = await app.inject({
      method: "DELETE",
      url: `/projects/${first.id}`,
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    for (const [table, id] of [
      [projects, first.id],
      [characters, character.id],
      [episodes, episode.id],
      [scenes, scene.id],
      [cuePoints, point.id],
    ]) {
      expect(
        await database.db.select().from(table).where(eq(table.id, id)),
      ).toEqual([]);
    }
    expect(
      (await app.inject({ method: "GET", url: `/projects/${first.id}` }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: `/projects/${second.id}` }))
        .statusCode,
    ).toBe(200);
  },
);
