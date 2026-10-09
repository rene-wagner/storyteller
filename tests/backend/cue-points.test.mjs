import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { eq } from "../../apps/api/node_modules/drizzle-orm/index.js";
import {
  cuePoints,
  cuePointSoundEffects,
  mediaItems,
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

async function setup(app) {
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
  const character = await create(app, `/projects/${owner.id}/characters`, {
    name: "Narrator",
    type: "main",
  });
  const nextCharacter = await create(app, `/projects/${owner.id}/characters`, {
    name: "Second voice",
    type: "supporting",
  });
  const otherCharacter = await create(app, `/projects/${other.id}/characters`, {
    name: "Outsider",
    type: "supporting",
  });
  const episode = await create(app, `/projects/${owner.id}/episodes`, {
    title: "Pilot",
    description: "",
  });
  const scene = await create(app, `/episodes/${episode.id}/scenes`, {
    title: "First",
  });
  const otherScene = await create(app, `/episodes/${episode.id}/scenes`, {
    title: "Second",
  });
  return { character, nextCharacter, otherCharacter, scene, otherScene };
}

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "cue point CRUD validates scene, project character and sound effect references",
  async () => {
    const { app, db } = await createBackendTest();
    const { character, nextCharacter, otherCharacter, scene } =
      await setup(app);
    const absent = randomUUID();
    const pointUrl = `/scenes/${scene.id}/cue-points`;
    const [effectA, effectB, music] = await db
      .insert(mediaItems)
      .values([
        {
          name: "Impact",
          type: "sound_effect",
          fileName: "impact.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 3n,
        },
        {
          name: "Step",
          type: "sound_effect",
          fileName: "step.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 3n,
        },
        {
          name: "Score",
          type: "background_music",
          fileName: "score.wav",
          storageKey: randomUUID(),
          mimeType: "audio/wav",
          fileSize: 3n,
        },
      ])
      .returning();
    await assertError(
      app,
      "GET",
      `/scenes/${absent}/cue-points`,
      undefined,
      404,
      missing,
    );
    await assertError(
      app,
      "POST",
      `/scenes/${absent}/cue-points`,
      {
        characterId: character.id,
        spokenText: "Lost",
      },
      404,
      missing,
    );
    for (const payload of [
      { characterId: absent, spokenText: "Unknown" },
      { characterId: otherCharacter.id, spokenText: "Wrong project" },
      {
        characterId: character.id,
        spokenText: "Unknown effect",
        soundEffectIds: [absent],
      },
      {
        characterId: character.id,
        spokenText: "Music",
        soundEffectIds: [music.id],
      },
      {
        characterId: character.id,
        spokenText: "Mixed",
        soundEffectIds: [effectA.id, absent],
      },
      {
        characterId: character.id,
        spokenText: "Duplicate",
        soundEffectIds: [effectA.id, effectA.id],
      },
      { characterId: character.id },
    ])
      await assertError(app, "POST", pointUrl, payload, 400, invalid);
    expect(await db.select().from(cuePoints)).toEqual([]);
    expect(await db.select().from(cuePointSoundEffects)).toEqual([]);

    const point = await create(app, pointUrl, {
      characterId: character.id,
      spokenText: "Hello",
      soundEffectIds: [effectB.id, effectA.id],
    });
    expect(point).toMatchObject({
      id: expect.any(String),
      sceneId: scene.id,
      characterId: character.id,
      spokenText: "Hello",
      position: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(point.soundEffectIds).toEqual([effectA.id, effectB.id].sort());
    expect(await list(app, pointUrl)).toStrictEqual([point]);
    expect(
      (await app.inject({ url: `/cue-points/${point.id}` })).json(),
    ).toStrictEqual(point);
    for (const payload of [
      { characterId: absent },
      { characterId: otherCharacter.id },
      { soundEffectIds: [music.id] },
      { soundEffectIds: [absent] },
      { soundEffectIds: [effectA.id, absent] },
      { soundEffectIds: [effectA.id, effectA.id] },
      { sceneId: absent },
      {},
    ])
      await assertError(
        app,
        "PATCH",
        `/cue-points/${point.id}`,
        payload,
        400,
        invalid,
      );
    expect(
      (await app.inject({ url: `/cue-points/${point.id}` })).json(),
    ).toStrictEqual(point);
    const updated = await app.inject({
      method: "PATCH",
      url: `/cue-points/${point.id}`,
      payload: { characterId: nextCharacter.id, spokenText: "Revised" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: point.id,
      sceneId: scene.id,
      characterId: nextCharacter.id,
      spokenText: "Revised",
      position: 0,
      soundEffectIds: [effectA.id, effectB.id].sort(),
    });
    const replaced = await app.inject({
      method: "PATCH",
      url: `/cue-points/${point.id}`,
      payload: { soundEffectIds: [effectB.id] },
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json()).toMatchObject({
      characterId: nextCharacter.id,
      spokenText: "Revised",
      soundEffectIds: [effectB.id],
    });
    expect(
      await db
        .select()
        .from(cuePointSoundEffects)
        .where(eq(cuePointSoundEffects.cuePointId, point.id)),
    ).toMatchObject([{ cuePointId: point.id, mediaItemId: effectB.id }]);
    const cleared = await app.inject({
      method: "PATCH",
      url: `/cue-points/${point.id}`,
      payload: { soundEffectIds: [] },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().soundEffectIds).toEqual([]);
    expect(
      (await app.inject({ url: `/cue-points/${point.id}` })).json(),
    ).toStrictEqual(cleared.json());
    expect(await db.select().from(cuePointSoundEffects)).toEqual([]);
    for (const [method, payload] of [
      ["GET", undefined],
      ["PATCH", { spokenText: "Lost" }],
      ["DELETE", undefined],
    ])
      await assertError(
        app,
        method,
        `/cue-points/${absent}`,
        payload,
        404,
        missing,
      );
    const deleted = await app.inject({
      method: "DELETE",
      url: `/cue-points/${point.id}`,
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    await assertError(
      app,
      "GET",
      `/cue-points/${point.id}`,
      undefined,
      404,
      missing,
    );
    expect(await list(app, pointUrl)).toEqual([]);
    expect(await db.select().from(cuePoints)).toEqual([]);
  },
);

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "cue point order persists within its scene and invalid order requests leave positions unchanged",
  async () => {
    const { app, db } = await createBackendTest();
    const { character, scene, otherScene } = await setup(app);
    const absent = randomUUID();
    const pointUrl = `/scenes/${scene.id}/cue-points`;
    const first = await create(app, pointUrl, {
      characterId: character.id,
      spokenText: "First",
    });
    const second = await create(app, pointUrl, {
      characterId: character.id,
      spokenText: "Second",
      soundEffectIds: [],
    });
    const third = await create(app, pointUrl, {
      characterId: character.id,
      spokenText: "Third",
    });
    const outsider = await create(app, `/scenes/${otherScene.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Other scene",
    });
    expect([
      first.position,
      second.position,
      third.position,
      outsider.position,
    ]).toEqual([0, 1, 2, 0]);
    expect(first.soundEffectIds).toEqual([]);
    const orderUrl = `/scenes/${scene.id}/cue-points/order`;
    await assertError(
      app,
      "PUT",
      `/scenes/${absent}/cue-points/order`,
      { cuePointIds: [] },
      404,
      missing,
    );
    for (const cuePointIds of [
      [first.id, second.id],
      [first.id, first.id, third.id],
      [first.id, second.id, absent],
      [first.id, second.id, outsider.id],
    ])
      await assertError(app, "PUT", orderUrl, { cuePointIds }, 400, invalid);
    expect(
      (await list(app, pointUrl)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [first.id, 0],
      [second.id, 1],
      [third.id, 2],
    ]);
    const reordered = await app.inject({
      method: "PUT",
      url: orderUrl,
      payload: { cuePointIds: [third.id, first.id, second.id] },
    });
    expect(reordered.statusCode).toBe(204);
    expect(reordered.body).toBe("");
    expect(
      (await list(app, pointUrl)).map(({ id, position }) => [id, position]),
    ).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ]);
    const rows = await db
      .select({ id: cuePoints.id, position: cuePoints.position })
      .from(cuePoints);
    expect(new Map(rows.map(({ id, position }) => [id, position]))).toEqual(
      new Map([
        [third.id, 0],
        [first.id, 1],
        [second.id, 2],
        [outsider.id, 0],
      ]),
    );
    expect(
      (await list(app, `/scenes/${otherScene.id}/cue-points`)).map(
        ({ id }) => id,
      ),
    ).toEqual([outsider.id]);
  },
);
