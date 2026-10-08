import { randomUUID } from "node:crypto";
import { expect, onTestFinished, test, vi } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { CharacterDeletionConflictError } from "../apps/api/src/characters/repository.ts";
import { createCharacterRepository } from "../apps/api/src/characters/repository.ts";
import { createCharacterService } from "../apps/api/src/characters/service.ts";
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
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";

const projectId = randomUUID();
const characterId = randomUUID();
const input = { name: "Alex", type: "main" };
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
  const characters = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const app = createApp({ characters });
  onTestFinished(() => app.close());
  return { app, characters };
}

test("character routes reject invalid IDs and input without calling the service", async () => {
  const { app, characters } = stubApp();
  for (const method of ["GET", "POST"]) {
    const response = await app.inject({
      method,
      url: "/projects/not-a-uuid/characters",
      ...(method === "POST" ? { payload: input } : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const method of ["PATCH", "DELETE"]) {
    const response = await app.inject({
      method,
      url: "/characters/not-a-uuid",
      ...(method === "PATCH" ? { payload: { name: "New" } } : {}),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { name: "", type: "main" },
    { name: "Alex", type: "other" },
    { name: "Alex" },
    { ...input, projectId },
  ]) {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/characters`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const payload of [
    {},
    { name: "" },
    { type: "other" },
    { projectId },
    { name: "New", projectId },
  ]) {
    const response = await app.inject({
      method: "PATCH",
      url: `/characters/${characterId}`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual(invalid);
  }
  for (const operation of Object.values(characters))
    expect(operation).not.toHaveBeenCalled();
});

test("character routes return list, create, update and delete responses", async () => {
  const { app, characters } = stubApp();
  const record = {
    id: characterId,
    projectId,
    ...input,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  characters.list.mockResolvedValue([record]);
  characters.create.mockResolvedValue(record);
  characters.update.mockResolvedValue({ ...record, type: "supporting" });
  characters.delete.mockResolvedValue(true);
  const list = await app.inject({
    method: "GET",
    url: `/projects/${projectId}/characters`,
  });
  expect(list.statusCode).toBe(200);
  expect(list.json()).toStrictEqual([record]);
  expect(characters.list).toHaveBeenCalledWith(projectId);
  const created = await app.inject({
    method: "POST",
    url: `/projects/${projectId}/characters`,
    payload: input,
  });
  expect(created.statusCode).toBe(201);
  expect(created.json()).toStrictEqual(record);
  expect(characters.create).toHaveBeenCalledWith(projectId, input);
  const updated = await app.inject({
    method: "PATCH",
    url: `/characters/${characterId}`,
    payload: { type: "supporting" },
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json()).toStrictEqual({ ...record, type: "supporting" });
  expect(characters.update).toHaveBeenCalledWith(characterId, {
    type: "supporting",
  });
  const deleted = await app.inject({
    method: "DELETE",
    url: `/characters/${characterId}`,
  });
  expect(deleted.statusCode).toBe(204);
  expect(deleted.body).toBe("");
  expect(characters.delete).toHaveBeenCalledWith(characterId);
});

test("unknown projects and characters return 404; referenced character deletion returns 409", async () => {
  const { app, characters } = stubApp();
  for (const [method, url, payload] of [
    ["GET", `/projects/${projectId}/characters`],
    ["POST", `/projects/${projectId}/characters`, input],
    ["PATCH", `/characters/${characterId}`, { name: "New" }],
    ["DELETE", `/characters/${characterId}`],
  ]) {
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toStrictEqual(missing);
  }
  characters.delete.mockRejectedValue(new CharacterDeletionConflictError());
  const response = await app.inject({
    method: "DELETE",
    url: `/characters/${characterId}`,
  });
  expect(response.statusCode).toBe(409);
  expect(response.json()).toStrictEqual(conflict);
});

test("character service checks project existence before listing or creating", async () => {
  const repository = { list: vi.fn(), create: vi.fn() };
  const projectRepository = { find: vi.fn().mockResolvedValue(undefined) };
  const service = createCharacterService(repository, projectRepository);
  expect(await service.list(projectId)).toBeUndefined();
  expect(await service.create(projectId, input)).toBeUndefined();
  expect(projectRepository.find).toHaveBeenCalledTimes(2);
  expect(repository.list).not.toHaveBeenCalled();
  expect(repository.create).not.toHaveBeenCalled();
});

test("unexpected character database failures do not expose internals", async () => {
  const { app, characters } = stubApp();
  characters.delete.mockRejectedValue(new Error("private database path"));
  const response = await app.inject({
    method: "DELETE",
    url: `/characters/${characterId}`,
  });
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
  "character HTTP operations persist, stay within their project and protect referenced characters",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const projectRepository = createProjectRepository(database.db);
    const app = createApp({
      characters: createCharacterService(
        createCharacterRepository(database.db),
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
    const missingProjectId = randomUUID();
    for (const method of ["GET", "POST"]) {
      const response = await app.inject({
        method,
        url: `/projects/${missingProjectId}/characters`,
        ...(method === "POST" ? { payload: input } : {}),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toStrictEqual(missing);
    }
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/projects/${owner.id}/characters`,
        })
      ).json(),
    ).toEqual([]);
    const create = async (project, name, type) => {
      const response = await app.inject({
        method: "POST",
        url: `/projects/${project.id}/characters`,
        payload: { name, type },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        id: expect.any(String),
        projectId: project.id,
        name,
        type,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      return response.json();
    };
    const main = await create(owner, "Zed", "main");
    const supporting = await create(owner, "Amy", "supporting");
    const outsider = await create(other, "Other", "main");
    const list = await app.inject({
      method: "GET",
      url: `/projects/${owner.id}/characters`,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((item) => item.id)).toEqual([
      supporting.id,
      main.id,
    ]);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/projects/${other.id}/characters`,
        })
      ).json(),
    ).toEqual([outsider]);
    const timestamp = new Date("2020-01-01T00:00:00Z");
    await database.db
      .update(characters)
      .set({ updatedAt: timestamp })
      .where(eq(characters.id, main.id));
    const update = await app.inject({
      method: "PATCH",
      url: `/characters/${main.id}`,
      payload: { name: "Ben", type: "supporting" },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({
      id: main.id,
      projectId: owner.id,
      name: "Ben",
      type: "supporting",
      createdAt: main.createdAt,
    });
    expect(Date.parse(update.json().updatedAt)).toBeGreaterThan(
      timestamp.getTime(),
    );
    expect(
      (
        await database.db
          .select()
          .from(characters)
          .where(eq(characters.id, main.id))
      )[0],
    ).toMatchObject({ projectId: owner.id, name: "Ben", type: "supporting" });
    const [episode] = await database.db
      .insert(episodes)
      .values({
        projectId: other.id,
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
        characterId: main.id,
        spokenText: "Line",
        position: 0,
      })
      .returning();
    const blocked = await app.inject({
      method: "DELETE",
      url: `/characters/${main.id}`,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toStrictEqual(conflict);
    expect(
      await database.db
        .select()
        .from(characters)
        .where(eq(characters.id, main.id)),
    ).toHaveLength(1);
    expect(
      await database.db
        .select()
        .from(cuePoints)
        .where(eq(cuePoints.id, point.id)),
    ).toHaveLength(1);
    const deleted = await app.inject({
      method: "DELETE",
      url: `/characters/${supporting.id}`,
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    expect(
      await database.db
        .select()
        .from(characters)
        .where(eq(characters.id, supporting.id)),
    ).toEqual([]);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/characters/${supporting.id}`,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/characters/${supporting.id}`,
          payload: { name: "Again" },
        })
      ).statusCode,
    ).toBe(404);
  },
);
