import { expect, test } from "vitest";
import { eq } from "../../apps/api/node_modules/drizzle-orm/index.js";
import {
  characters,
  cuePoints,
  cuePointSoundEffects,
  episodes,
  mediaItems,
  projects,
  scenes,
} from "../../apps/api/src/db/schema.ts";
import { createBackendTest } from "./helpers.mjs";

async function request(app, method, url, payload, status = 200) {
  const response = await app.inject({ method, url, payload });
  expect(response.statusCode).toBe(status);
  return status === 204 ? undefined : response.json();
}

async function create(app, url, payload) {
  return request(app, "POST", url, payload, 201);
}

async function reload(app, url) {
  return request(app, "GET", url);
}

async function upload(app, name, type) {
  const boundary = "authoring-workflow-upload";
  const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.wav"\r\nContent-Type: audio/wav\r\n\r\naudio\r\n--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${type}\r\n--${boundary}--\r\n`;
  const response = await app.inject({
    method: "POST",
    url: "/media",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "TASK-073/075/076: authoring survives fresh reads; referenced media is protected until project cascade removes usage",
  async () => {
    const { app, db, storage } = await createBackendTest();
    const project = await create(app, "/projects", {
      title: "The Signal",
      genre: "Mystery",
      description: "A transmission from the coast",
    });
    const narrator = await create(app, `/projects/${project.id}/characters`, {
      name: "Narrator",
      type: "main",
    });
    const captain = await create(app, `/projects/${project.id}/characters`, {
      name: "Captain",
      type: "main",
    });
    const episode = await create(app, `/projects/${project.id}/episodes`, {
      title: "Arrival",
      description: "The first message",
    });
    const music = await upload(app, "Opening theme", "background_music");
    const effect = await upload(app, "Static", "sound_effect");
    const scene = await create(app, `/episodes/${episode.id}/scenes`, {
      title: "Radio room",
    });
    const assignedScene = await request(app, "PATCH", `/scenes/${scene.id}`, {
      backgroundMusicId: music.id,
    });
    const first = await create(app, `/scenes/${scene.id}/cue-points`, {
      characterId: narrator.id,
      spokenText: "Do you hear that?",
    });
    const second = await create(app, `/scenes/${scene.id}/cue-points`, {
      characterId: captain.id,
      spokenText: "Only static.",
    });
    const assignedPoint = await request(
      app,
      "PATCH",
      `/cue-points/${second.id}`,
      { soundEffectIds: [effect.id] },
    );

    // Each GET is a new request, as after a page reload (no mutation response is reused).
    expect(await reload(app, `/projects/${project.id}`)).toStrictEqual(project);
    expect(await reload(app, `/projects/${project.id}/characters`)).toEqual(
      expect.arrayContaining([narrator, captain]),
    );
    expect(await reload(app, `/projects/${project.id}/episodes`)).toStrictEqual(
      [episode],
    );
    expect(await reload(app, `/episodes/${episode.id}/scenes`)).toStrictEqual([
      assignedScene,
    ]);
    expect(await reload(app, `/scenes/${scene.id}/cue-points`)).toStrictEqual([
      first,
      assignedPoint,
    ]);
    expect(await reload(app, `/media`)).toEqual(
      expect.arrayContaining([music, effect]),
    );
    expect(assignedScene.backgroundMusicId).toBe(music.id);
    expect(assignedPoint.soundEffectIds).toStrictEqual([effect.id]);
    const mediaRows = await db.select().from(mediaItems);
    expect(mediaRows).toHaveLength(2);
    for (const item of [music, effect]) {
      const key = mediaRows.find((row) => row.id === item.id).storageKey;
      expect(storage.files.get(key)).toStrictEqual(Buffer.from("audio"));
    }
    expect(
      (await db.select().from(cuePointSoundEffects)).map((row) => [
        row.cuePointId,
        row.mediaItemId,
      ]),
    ).toStrictEqual([[second.id, effect.id]]);

    for (const [item, usage] of [
      [
        music,
        {
          sceneIds: [scene.id],
          cuePointIds: [],
          scenes: [
            {
              id: scene.id,
              projectTitle: "The Signal",
              episodeTitle: "Arrival",
              sceneTitle: "Radio room",
            },
          ],
          cuePoints: [],
        },
      ],
      [
        effect,
        {
          sceneIds: [],
          cuePointIds: [second.id],
          scenes: [],
          cuePoints: [
            {
              id: second.id,
              projectTitle: "The Signal",
              episodeTitle: "Arrival",
              sceneTitle: "Radio room",
              position: 1,
            },
          ],
        },
      ],
    ]) {
      expect(
        await request(app, "DELETE", `/media/${item.id}`, undefined, 409),
      ).toStrictEqual({
        error: {
          code: "CONFLICT",
          message: "Media item is in use.",
          details: [],
          usage,
        },
      });
      expect(await reload(app, `/media/${item.id}`)).toStrictEqual(item);
      expect(
        storage.files.has(
          mediaRows.find((row) => row.id === item.id).storageKey,
        ),
      ).toBe(true);
    }

    await request(app, "DELETE", `/projects/${project.id}`, undefined, 204);
    for (const url of [
      `/projects/${project.id}`,
      `/episodes/${episode.id}`,
      `/scenes/${scene.id}`,
      `/cue-points/${first.id}`,
      `/cue-points/${second.id}`,
    ]) {
      expect(await request(app, "GET", url, undefined, 404)).toStrictEqual({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found.",
          details: [],
        },
      });
    }
    expect(await db.select().from(projects)).toEqual([]);
    expect(await db.select().from(characters)).toEqual([]);
    expect(await db.select().from(episodes)).toEqual([]);
    expect(await db.select().from(scenes)).toEqual([]);
    expect(await db.select().from(cuePoints)).toEqual([]);
    expect(await db.select().from(cuePointSoundEffects)).toEqual([]);
    expect(await db.select().from(mediaItems)).toHaveLength(2);
    for (const item of [music, effect]) {
      await request(app, "DELETE", `/media/${item.id}`, undefined, 204);
      expect(
        await request(app, "GET", `/media/${item.id}`, undefined, 404),
      ).toMatchObject({
        error: { code: "NOT_FOUND" },
      });
      expect(
        storage.files.has(
          mediaRows.find((row) => row.id === item.id).storageKey,
        ),
      ).toBe(false);
    }
  },
);

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "TASK-075: deleting a cue, then a scene, then an episode removes only their descendants and media links",
  async () => {
    const { app, db } = await createBackendTest();
    const project = await create(app, "/projects", {
      title: "Remaining story",
      genre: "Drama",
      description: "",
    });
    const character = await create(app, `/projects/${project.id}/characters`, {
      name: "Voice",
      type: "main",
    });
    const effect = await upload(app, "Impact", "sound_effect");
    const episodeA = await create(app, `/projects/${project.id}/episodes`, {
      title: "First",
      description: "",
    });
    const episodeB = await create(app, `/projects/${project.id}/episodes`, {
      title: "Second",
      description: "",
    });
    const sceneA = await create(app, `/episodes/${episodeA.id}/scenes`, {
      title: "First scene",
    });
    const sceneB = await create(app, `/episodes/${episodeA.id}/scenes`, {
      title: "Second scene",
    });
    const sceneC = await create(app, `/episodes/${episodeB.id}/scenes`, {
      title: "Retained scene",
    });
    const pointA = await create(app, `/scenes/${sceneA.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Remove cue",
      soundEffectIds: [effect.id],
    });
    const pointB = await create(app, `/scenes/${sceneA.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Remove scene",
      soundEffectIds: [effect.id],
    });
    const pointC = await create(app, `/scenes/${sceneB.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Remove episode",
      soundEffectIds: [effect.id],
    });
    const retained = await create(app, `/scenes/${sceneC.id}/cue-points`, {
      characterId: character.id,
      spokenText: "Keep",
      soundEffectIds: [effect.id],
    });
    for (const [url, survivors] of [
      [`/cue-points/${pointA.id}`, [pointB.id, pointC.id, retained.id]],
      [`/scenes/${sceneA.id}`, [pointC.id, retained.id]],
      [`/episodes/${episodeA.id}`, [retained.id]],
    ]) {
      await request(app, "DELETE", url, undefined, 204);
      expect(
        (await db.select().from(cuePoints)).map((row) => row.id).sort(),
      ).toEqual([...survivors].sort());
      expect(
        (await db.select().from(cuePointSoundEffects))
          .map((row) => row.cuePointId)
          .sort(),
      ).toEqual([...survivors].sort());
      for (const id of survivors)
        expect((await reload(app, `/cue-points/${id}`)).id).toBe(id);
    }
    expect(
      (await reload(app, `/projects/${project.id}/episodes`)).map(
        (row) => row.id,
      ),
    ).toEqual([episodeB.id]);
    expect(
      (await reload(app, `/episodes/${episodeB.id}/scenes`)).map(
        (row) => row.id,
      ),
    ).toEqual([sceneC.id]);
    expect(
      (await request(app, "DELETE", `/media/${effect.id}`, undefined, 409))
        .error.usage.cuePointIds,
    ).toEqual([retained.id]);
    await request(app, "DELETE", `/projects/${project.id}`, undefined, 204);
    expect(await db.select().from(cuePointSoundEffects)).toEqual([]);
    expect(await db.select().from(cuePoints)).toEqual([]);
    expect(await db.select().from(scenes)).toEqual([]);
    expect(await db.select().from(episodes)).toEqual([]);
    await request(app, "DELETE", `/media/${effect.id}`, undefined, 204);
  },
);

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "TASK-074: episode, scene and cue point order remains selected after fresh reads",
  async () => {
    const { app, db } = await createBackendTest();
    const project = await create(app, "/projects", {
      title: "Ordered story",
      genre: "Drama",
      description: "",
    });
    const character = await create(app, `/projects/${project.id}/characters`, {
      name: "Voice",
      type: "main",
    });
    const episodeUrl = `/projects/${project.id}/episodes`;
    const episodeA = await create(app, episodeUrl, {
      title: "A",
      description: "",
    });
    const episodeB = await create(app, episodeUrl, {
      title: "B",
      description: "",
    });
    const episodeC = await create(app, episodeUrl, {
      title: "C",
      description: "",
    });
    const sceneUrl = `/episodes/${episodeA.id}/scenes`;
    const sceneA = await create(app, sceneUrl, { title: "A" });
    const sceneB = await create(app, sceneUrl, { title: "B" });
    const sceneC = await create(app, sceneUrl, { title: "C" });
    const pointUrl = `/scenes/${sceneA.id}/cue-points`;
    const pointA = await create(app, pointUrl, {
      characterId: character.id,
      spokenText: "A",
    });
    const pointB = await create(app, pointUrl, {
      characterId: character.id,
      spokenText: "B",
    });
    const pointC = await create(app, pointUrl, {
      characterId: character.id,
      spokenText: "C",
    });
    await request(
      app,
      "PUT",
      `${episodeUrl}/order`,
      {
        episodeIds: [episodeC.id, episodeA.id, episodeB.id],
      },
      204,
    );
    await request(
      app,
      "PUT",
      `${sceneUrl}/order`,
      {
        sceneIds: [sceneB.id, sceneC.id, sceneA.id],
      },
      204,
    );
    await request(
      app,
      "PUT",
      `${pointUrl}/order`,
      {
        cuePointIds: [pointC.id, pointB.id, pointA.id],
      },
      204,
    );
    for (const [url, expected] of [
      [episodeUrl, [episodeC.id, episodeA.id, episodeB.id]],
      [sceneUrl, [sceneB.id, sceneC.id, sceneA.id]],
      [pointUrl, [pointC.id, pointB.id, pointA.id]],
    ]) {
      const entries = await reload(app, url);
      expect(entries.map(({ id }) => id)).toStrictEqual(expected);
      expect(entries.map(({ position }) => position)).toStrictEqual([0, 1, 2]);
    }
    for (const [table, expected] of [
      [episodes, [episodeC.id, episodeA.id, episodeB.id]],
      [scenes, [sceneB.id, sceneC.id, sceneA.id]],
      [cuePoints, [pointC.id, pointB.id, pointA.id]],
    ]) {
      const rows = await db.select().from(table);
      expect(
        rows
          .filter((row) => expected.includes(row.id))
          .sort((a, b) => a.position - b.position)
          .map((row) => row.id),
      ).toStrictEqual(expected);
    }
    expect(
      await db
        .select()
        .from(episodes)
        .where(eq(episodes.projectId, project.id)),
    ).toHaveLength(3);
  },
);
