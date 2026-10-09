import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import {
  characters,
  cuePoints,
  episodes,
  projects,
  scenes,
} from "../../apps/api/src/db/schema.ts";
import { createBackendTest } from "./helpers.mjs";

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

async function create(app, url, payload) {
  const response = await app.inject({ method: "POST", url, payload });
  expect(response.statusCode).toBe(201);
  return response.json();
}

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "project and character API validates, persists and isolates CRUD by project",
  async () => {
    const { app, db } = await createBackendTest();
    const unknownId = randomUUID();
    for (const [url, payload] of [
      ["/projects", { title: "", genre: "Drama", description: "Intro" }],
      ["/projects", { title: "Incomplete", genre: "Drama" }],
      [`/projects/${unknownId}/characters`, { name: "Someone", type: "main" }],
    ]) {
      const response = await app.inject({ method: "POST", url, payload });
      expect(response.statusCode).toBe(url === "/projects" ? 400 : 404);
      expect(response.json()).toStrictEqual(
        url === "/projects" ? invalid : missing,
      );
    }
    expect(await db.select().from(projects)).toEqual([]);
    expect(await db.select().from(characters)).toEqual([]);

    const owner = await create(app, "/projects", {
      title: "Pilot",
      genre: "Mystery",
      description: "Intro",
    });
    const other = await create(app, "/projects", {
      title: "Other",
      genre: "Drama",
      description: "Different story",
    });
    expect(owner).toMatchObject({
      id: expect.any(String),
      title: "Pilot",
      genre: "Mystery",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(
      (await app.inject({ url: `/projects/${owner.id}` })).json(),
    ).toStrictEqual(owner);
    expect((await app.inject({ url: "/projects" })).json()).toEqual(
      expect.arrayContaining([owner, other]),
    );

    const main = await create(app, `/projects/${owner.id}/characters`, {
      name: "Zed",
      type: "main",
    });
    const supporting = await create(app, `/projects/${owner.id}/characters`, {
      name: "Amy",
      type: "supporting",
    });
    const outsider = await create(app, `/projects/${other.id}/characters`, {
      name: "Other",
      type: "main",
    });
    expect(main).toMatchObject({
      id: expect.any(String),
      projectId: owner.id,
      name: "Zed",
      type: "main",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(
      (await app.inject({ url: `/projects/${owner.id}/characters` })).json(),
    ).toStrictEqual([supporting, main]);
    expect(
      (await app.inject({ url: `/projects/${other.id}/characters` })).json(),
    ).toStrictEqual([outsider]);
    const invalidCharacter = await app.inject({
      method: "POST",
      url: `/projects/${owner.id}/characters`,
      payload: { name: "Invalid", type: "guest" },
    });
    expect(invalidCharacter.statusCode).toBe(400);
    expect(invalidCharacter.json()).toStrictEqual(invalid);
    expect(
      (await app.inject({ url: `/projects/${owner.id}/characters` })).json(),
    ).toHaveLength(2);

    const updatedProject = await app.inject({
      method: "PATCH",
      url: `/projects/${owner.id}`,
      payload: { genre: "Thriller" },
    });
    expect(updatedProject.statusCode).toBe(200);
    expect(updatedProject.json()).toMatchObject({
      id: owner.id,
      title: owner.title,
      genre: "Thriller",
    });
    expect(
      (await app.inject({ url: `/projects/${owner.id}` })).json(),
    ).toStrictEqual(updatedProject.json());
    const updatedCharacter = await app.inject({
      method: "PATCH",
      url: `/characters/${main.id}`,
      payload: { name: "Ben", type: "supporting" },
    });
    expect(updatedCharacter.statusCode).toBe(200);
    expect(updatedCharacter.json()).toMatchObject({
      id: main.id,
      projectId: owner.id,
      name: "Ben",
      type: "supporting",
    });
    expect(
      (await app.inject({ url: `/projects/${owner.id}/characters` })).json(),
    ).toEqual([supporting, updatedCharacter.json()]);

    for (const [method, url, payload] of [
      ["GET", `/projects/${unknownId}`],
      ["PATCH", `/projects/${unknownId}`, { title: "Missing" }],
      ["DELETE", `/projects/${unknownId}`],
      ["GET", `/projects/${unknownId}/characters`],
      ["PATCH", `/characters/${unknownId}`, { name: "Missing" }],
      ["DELETE", `/characters/${unknownId}`],
    ]) {
      const response = await app.inject({ method, url, payload });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toStrictEqual(missing);
    }
    const removed = await app.inject({
      method: "DELETE",
      url: `/characters/${main.id}`,
    });
    expect(removed.statusCode).toBe(204);
    expect(removed.body).toBe("");
    expect(
      (await app.inject({ url: `/projects/${owner.id}/characters` })).json(),
    ).toEqual([supporting]);
    expect(
      (await app.inject({ url: `/projects/${other.id}/characters` })).json(),
    ).toEqual([outsider]);
  },
);

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "project deletion cascades its character and episode hierarchy but retains other projects",
  async () => {
    const { app, db } = await createBackendTest();
    const removed = await create(app, "/projects", {
      title: "Remove",
      genre: "Drama",
      description: "",
    });
    const retained = await create(app, "/projects", {
      title: "Retain",
      genre: "Drama",
      description: "",
    });
    const character = await create(app, `/projects/${removed.id}/characters`, {
      name: "Narrator",
      type: "main",
    });
    const episode = await create(app, `/projects/${removed.id}/episodes`, {
      title: "Opening",
      description: "",
    });
    const scene = await create(app, `/episodes/${episode.id}/scenes`, {
      title: "Arrival",
    });
    const point = await create(app, `/scenes/${scene.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Hello",
    });
    const blocked = await app.inject({
      method: "DELETE",
      url: `/characters/${character.id}`,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toStrictEqual({
      error: { code: "CONFLICT", message: "Resource conflict.", details: [] },
    });
    expect(
      (await app.inject({ url: `/cue-points/${point.id}` })).statusCode,
    ).toBe(200);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/projects/${removed.id}`,
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    expect(
      (await app.inject({ url: `/projects/${removed.id}` })).json(),
    ).toStrictEqual(missing);
    expect(
      (await app.inject({ url: `/projects/${removed.id}/characters` })).json(),
    ).toStrictEqual(missing);
    expect(
      (await app.inject({ url: `/episodes/${episode.id}` })).json(),
    ).toStrictEqual(missing);
    expect(
      (await app.inject({ url: `/scenes/${scene.id}` })).json(),
    ).toStrictEqual(missing);
    expect(
      (await app.inject({ url: `/cue-points/${point.id}` })).json(),
    ).toStrictEqual(missing);
    expect(await db.select().from(characters)).toEqual([]);
    expect(await db.select().from(episodes)).toEqual([]);
    expect(await db.select().from(scenes)).toEqual([]);
    expect(await db.select().from(cuePoints)).toEqual([]);
    expect((await db.select().from(projects)).map((row) => row.id)).toEqual([
      retained.id,
    ]);
    expect(
      (await app.inject({ url: `/projects/${retained.id}` })).statusCode,
    ).toBe(200);
  },
);
