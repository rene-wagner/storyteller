import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import {
  CHARACTER_TYPES,
  MEDIA_TYPES,
  characterSchema,
  createCharacterSchema,
  createCuePointSchema,
  createEpisodeSchema,
  createProjectSchema,
  createSceneSchema,
  cuePointSchema,
  episodeSchema,
  mediaItemSchema,
  projectSchema,
  sceneSchema,
} from "../packages/shared/src/index.ts";

const id = randomUUID();
const anotherId = randomUUID();
const dates = {
  createdAt: "2025-01-01T10:00:00.000Z",
  updatedAt: "2025-01-02T10:00:00.000Z",
};

const entities = [
  {
    name: "project",
    create: createProjectSchema,
    response: projectSchema,
    request: { title: "Pilot", genre: "Mystery", description: "" },
    record: { id, ...dates },
  },
  {
    name: "character",
    create: createCharacterSchema,
    response: characterSchema,
    request: { name: "Alex", type: "main" },
    record: { id, projectId: anotherId, ...dates },
  },
  {
    name: "episode",
    create: createEpisodeSchema,
    response: episodeSchema,
    request: { title: "Episode 1", description: "Intro" },
    record: { id, projectId: anotherId, position: 0, ...dates },
  },
  {
    name: "scene",
    create: createSceneSchema,
    response: sceneSchema,
    request: { title: "Opening" },
    record: {
      id,
      episodeId: anotherId,
      backgroundMusicId: null,
      position: 0,
      ...dates,
    },
  },
  {
    name: "cue point",
    create: createCuePointSchema,
    response: cuePointSchema,
    request: { characterId: anotherId, spokenText: "Hello" },
    record: { id, sceneId: anotherId, position: 0, ...dates },
  },
];

test.each(entities)(
  "$name validates create data and response fields",
  ({ create, response, request, record }) => {
    expect(create.parse(request)).toEqual(request);
    expect(response.parse({ ...record, ...request })).toEqual({
      ...record,
      ...request,
    });
    expect(create.safeParse({ ...record, ...request }).success).toBe(false);
    expect(response.safeParse({ ...request }).success).toBe(false);
    expect(
      response.safeParse({ ...record, ...request, id: "not-an-id" }).success,
    ).toBe(false);
    expect(
      response.safeParse({ ...record, ...request, createdAt: "yesterday" })
        .success,
    ).toBe(false);
    expect(
      response.safeParse({ ...record, ...request, unexpected: true }).success,
    ).toBe(false);
  },
);

test("create inputs reject invalid enum values, references and missing required fields", () => {
  expect(CHARACTER_TYPES).toEqual(["main", "supporting"]);
  expect(MEDIA_TYPES).toEqual(["background_music", "sound_effect"]);
  expect(
    createProjectSchema.safeParse({ genre: "Mystery", description: "" })
      .success,
  ).toBe(false);
  expect(
    createProjectSchema.safeParse({
      title: "",
      genre: "Mystery",
      description: "",
    }).success,
  ).toBe(false);
  expect(
    createCharacterSchema.safeParse({ name: "Alex", type: "other" }).success,
  ).toBe(false);
  expect(createEpisodeSchema.safeParse({ title: "Episode 1" }).success).toBe(
    false,
  );
  expect(
    createSceneSchema.parse({ title: "Opening", backgroundMusicId: null }),
  ).toEqual({
    title: "Opening",
    backgroundMusicId: null,
  });
  expect(
    createSceneSchema.safeParse({
      title: "Opening",
      backgroundMusicId: "other",
    }).success,
  ).toBe(false);
  expect(
    createCuePointSchema.safeParse({
      characterId: "other",
      spokenText: "Hello",
    }).success,
  ).toBe(false);
});

test("ordered responses require nonnegative integer positions and scenes allow no music", () => {
  for (const { response, request, record } of entities.slice(2)) {
    expect(
      response.safeParse({ ...record, ...request, position: -1 }).success,
    ).toBe(false);
    expect(
      response.safeParse({ ...record, ...request, position: 1.5 }).success,
    ).toBe(false);
  }
  expect(
    sceneSchema.safeParse({ ...entities[3].record, title: "Opening" }).success,
  ).toBe(true);
});

test("media response validates safe JSON metadata without storage keys", () => {
  const media = {
    id,
    ...dates,
    name: "Theme",
    type: "background_music",
    fileName: "theme.mp3",
    mimeType: "audio/mpeg",
    fileSize: "9223372036854775807",
  };
  expect(mediaItemSchema.parse(media)).toEqual(media);
  expect(
    mediaItemSchema.parse({ ...media, type: "sound_effect", fileSize: "0" }),
  ).toEqual({
    ...media,
    type: "sound_effect",
    fileSize: "0",
  });
  for (const fileSize of [-1, 123, "-1", "1.5", "01", " 1", ""]) {
    expect(mediaItemSchema.safeParse({ ...media, fileSize }).success).toBe(
      false,
    );
  }
  expect(mediaItemSchema.safeParse({ ...media, type: "video" }).success).toBe(
    false,
  );
  expect(
    mediaItemSchema.safeParse({ ...media, storageKey: "internal/key" }).success,
  ).toBe(false);
});
