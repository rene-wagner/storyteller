import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { eq } from "../../apps/api/node_modules/drizzle-orm/index.js";
import { cuePoints, episodes, scenes } from "../../apps/api/src/db/schema.ts";
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

async function assertError(app, method, url, payload, status, body) {
  const response = await app.inject({ method, url, payload });
  expect(response.statusCode).toBe(status);
  expect(response.json()).toStrictEqual(body);
}

async function list(app, url) {
  const response = await app.inject({ url });
  expect(response.statusCode).toBe(200);
  return response.json();
}

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "episode and scene CRUD validates parents, input and music relations through real persistence",
  async () => {
    const { app, db } = await createBackendTest();
    const absent = randomUUID();
    const project = await create(app, "/projects", {
      title: "Owner",
      genre: "Drama",
      description: "Opening",
    });
    const other = await create(app, "/projects", {
      title: "Other",
      genre: "Drama",
      description: "",
    });
    const episodeUrl = `/projects/${project.id}/episodes`;
    await assertError(
      app,
      "GET",
      `/projects/${absent}/episodes`,
      undefined,
      404,
      missing,
    );
    await assertError(
      app,
      "POST",
      `/projects/${absent}/episodes`,
      { title: "Lost", description: "" },
      404,
      missing,
    );
    await assertError(
      app,
      "POST",
      episodeUrl,
      { title: "Missing description" },
      400,
      invalid,
    );
    await assertError(
      app,
      "POST",
      episodeUrl,
      { title: "Bad", description: "", projectId: other.id },
      400,
      invalid,
    );
    expect(await db.select().from(episodes)).toEqual([]);
    const first = await create(app, episodeUrl, {
      title: "Pilot",
      description: "Beginning",
    });
    const sibling = await create(app, episodeUrl, {
      title: "Second",
      description: "",
    });
    const outsider = await create(app, `/projects/${other.id}/episodes`, {
      title: "Other",
      description: "",
    });
    expect([first.position, sibling.position, outsider.position]).toEqual([
      0, 1, 0,
    ]);
    expect(first).toMatchObject({
      id: expect.any(String),
      projectId: project.id,
      createdAt: expect.any(String),
    });
    expect(await list(app, episodeUrl)).toStrictEqual([first, sibling]);
    expect(
      (await app.inject({ url: `/episodes/${first.id}` })).json(),
    ).toStrictEqual(first);
    const patched = await app.inject({
      method: "PATCH",
      url: `/episodes/${first.id}`,
      payload: { title: "Revised", description: "Changed" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      id: first.id,
      projectId: project.id,
      position: 0,
      title: "Revised",
      description: "Changed",
    });
    expect(
      (await app.inject({ url: `/episodes/${first.id}` })).json(),
    ).toStrictEqual(patched.json());
    await assertError(
      app,
      "PATCH",
      `/episodes/${first.id}`,
      { projectId: other.id },
      400,
      invalid,
    );
    expect(
      (await app.inject({ url: `/episodes/${first.id}` })).json(),
    ).toStrictEqual(patched.json());

    const sceneUrl = `/episodes/${first.id}/scenes`;
    await assertError(
      app,
      "GET",
      `/episodes/${absent}/scenes`,
      undefined,
      404,
      missing,
    );
    await assertError(
      app,
      "POST",
      `/episodes/${absent}/scenes`,
      { title: "Lost" },
      404,
      missing,
    );
    await assertError(app, "POST", sceneUrl, { title: "" }, 400, invalid);
    await assertError(
      app,
      "POST",
      sceneUrl,
      { title: "Bad", episodeId: outsider.id },
      400,
      invalid,
    );
    await assertError(
      app,
      "POST",
      sceneUrl,
      { title: "Bad", backgroundMusicId: absent },
      400,
      invalid,
    );
    expect(await db.select().from(scenes)).toEqual([]);
    const scene = await create(app, sceneUrl, { title: "Opening" });
    const next = await create(app, sceneUrl, {
      title: "Next",
      backgroundMusicId: null,
    });
    const separate = await create(app, `/episodes/${sibling.id}/scenes`, {
      title: "Separate",
    });
    expect([scene.position, next.position, separate.position]).toEqual([
      0, 1, 0,
    ]);
    expect(scene).toMatchObject({
      id: expect.any(String),
      episodeId: first.id,
      backgroundMusicId: null,
      createdAt: expect.any(String),
    });
    expect(await list(app, sceneUrl)).toStrictEqual([scene, next]);
    expect(
      (await app.inject({ url: `/scenes/${scene.id}` })).json(),
    ).toStrictEqual(scene);
    const updated = await app.inject({
      method: "PATCH",
      url: `/scenes/${scene.id}`,
      payload: { title: "New opening" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: scene.id,
      episodeId: first.id,
      position: 0,
      title: "New opening",
      backgroundMusicId: null,
    });
    await assertError(
      app,
      "PATCH",
      `/scenes/${scene.id}`,
      { episodeId: sibling.id },
      400,
      invalid,
    );
    await assertError(
      app,
      "PATCH",
      `/scenes/${scene.id}`,
      { backgroundMusicId: absent },
      400,
      invalid,
    );
    expect(
      (await app.inject({ url: `/scenes/${scene.id}` })).json(),
    ).toStrictEqual(updated.json());
    for (const [method, url, payload] of [
      ["GET", `/episodes/${absent}`],
      ["PATCH", `/episodes/${absent}`, { title: "Lost" }],
      ["DELETE", `/episodes/${absent}`],
      ["GET", `/scenes/${absent}`],
      ["PATCH", `/scenes/${absent}`, { title: "Lost" }],
      ["DELETE", `/scenes/${absent}`],
    ])
      await assertError(app, method, url, payload, 404, missing);
  },
);

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "episode and scene order persists, rejects foreign members atomically, and deletions cascade only to descendants",
  async () => {
    const { app, db } = await createBackendTest();
    const owner = await create(app, "/projects", {
      title: "Owner",
      genre: "Drama",
      description: "",
    });
    const other = await create(app, "/projects", {
      title: "Other",
      genre: "Drama",
      description: "",
    });
    const episodeUrl = `/projects/${owner.id}/episodes`;
    const first = await create(app, episodeUrl, {
      title: "First",
      description: "",
    });
    const second = await create(app, episodeUrl, {
      title: "Second",
      description: "",
    });
    const foreign = await create(app, `/projects/${other.id}/episodes`, {
      title: "Foreign",
      description: "",
    });
    const sceneUrl = `/episodes/${first.id}/scenes`;
    const a = await create(app, sceneUrl, { title: "A" });
    const b = await create(app, sceneUrl, { title: "B" });
    const foreignScene = await create(app, `/episodes/${second.id}/scenes`, {
      title: "Unrelated",
    });
    const character = await create(app, `/projects/${owner.id}/characters`, {
      name: "Voice",
      type: "main",
    });
    const point = await create(app, `/scenes/${a.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Line",
    });
    const episodeOrder = `/projects/${owner.id}/episodes/order`;
    const sceneOrder = `/episodes/${first.id}/scenes/order`;
    for (const [url, payload] of [
      [episodeOrder, { episodeIds: [first.id, foreign.id] }],
      [episodeOrder, { episodeIds: [first.id] }],
      [sceneOrder, { sceneIds: [a.id, foreignScene.id] }],
      [sceneOrder, { sceneIds: [a.id] }],
    ])
      await assertError(app, "PUT", url, payload, 400, invalid);
    expect(
      (await list(app, episodeUrl)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [first.id, 0],
      [second.id, 1],
    ]);
    expect(
      (await list(app, sceneUrl)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [a.id, 0],
      [b.id, 1],
    ]);
    for (const [url, payload] of [
      [episodeOrder, { episodeIds: [second.id, first.id] }],
      [sceneOrder, { sceneIds: [b.id, a.id] }],
    ]) {
      const response = await app.inject({ method: "PUT", url, payload });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
    }
    expect(
      (await list(app, episodeUrl)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [second.id, 0],
      [first.id, 1],
    ]);
    expect(
      (await list(app, sceneUrl)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [b.id, 0],
      [a.id, 1],
    ]);
    const episodeRows = await db
      .select({ id: episodes.id, position: episodes.position })
      .from(episodes)
      .where(eq(episodes.projectId, owner.id));
    const sceneRows = await db
      .select({ id: scenes.id, position: scenes.position })
      .from(scenes)
      .where(eq(scenes.episodeId, first.id));
    expect(
      new Map(episodeRows.map(({ id, position }) => [id, position])),
    ).toEqual(
      new Map([
        [second.id, 0],
        [first.id, 1],
      ]),
    );
    expect(
      new Map(sceneRows.map(({ id, position }) => [id, position])),
    ).toEqual(
      new Map([
        [b.id, 0],
        [a.id, 1],
      ]),
    );
    expect(
      (await list(app, `/projects/${other.id}/episodes`)).map(
        ({ id, position }) => [id, position],
      ),
    ).toEqual([[foreign.id, 0]]);

    const deletedScene = await app.inject({
      method: "DELETE",
      url: `/scenes/${a.id}`,
    });
    expect(deletedScene.statusCode).toBe(204);
    expect(deletedScene.body).toBe("");
    await assertError(app, "GET", `/scenes/${a.id}`, undefined, 404, missing);
    await assertError(
      app,
      "GET",
      `/cue-points/${point.id}`,
      undefined,
      404,
      missing,
    );
    expect(
      await db.select().from(cuePoints).where(eq(cuePoints.id, point.id)),
    ).toEqual([]);
    expect((await list(app, sceneUrl)).map(({ id }) => id)).toEqual([b.id]);
    const deletedEpisode = await app.inject({
      method: "DELETE",
      url: `/episodes/${first.id}`,
    });
    expect(deletedEpisode.statusCode).toBe(204);
    expect(deletedEpisode.body).toBe("");
    await assertError(
      app,
      "GET",
      `/episodes/${first.id}`,
      undefined,
      404,
      missing,
    );
    await assertError(app, "GET", `/scenes/${b.id}`, undefined, 404, missing);
    expect(
      await db.select().from(scenes).where(eq(scenes.episodeId, first.id)),
    ).toEqual([]);
    expect((await list(app, episodeUrl)).map(({ id }) => id)).toEqual([
      second.id,
    ]);
    expect(
      (await list(app, `/episodes/${second.id}/scenes`)).map(({ id }) => id),
    ).toEqual([foreignScene.id]);
    expect(
      (await list(app, `/projects/${other.id}/episodes`)).map(({ id }) => id),
    ).toEqual([foreign.id]);
  },
);
