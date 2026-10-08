import { afterEach, expect, test, vi } from "vitest";
import {
  cuePointsByPosition,
  movedCuePointIds,
  projectKeys,
  projectsApi,
  validateCuePoint,
} from "../apps/web/src/projects.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const characterId = "00000000-0000-4000-8000-000000000001";
const effectId = "00000000-0000-4000-8000-000000000002";

test("cue point input validates references and allows multiple effects and empty spoken text", () => {
  const input = {
    characterId,
    spokenText: "",
    soundEffectIds: [effectId, characterId],
  };
  expect(validateCuePoint(input)).toEqual({ value: input, errors: {} });
  expect(
    validateCuePoint({
      ...input,
      characterId: "bad",
      soundEffectIds: [effectId, effectId],
    }),
  ).toEqual({
    errors: {
      characterId: "Select a character.",
      soundEffectIds: "Select valid sound effects.",
    },
  });
});

test("cue points sort by position and adjacent moves produce complete ID lists", () => {
  const points = cuePointsByPosition([
    { id: "third", position: 2 },
    { id: "first", position: 0 },
    { id: "second", position: 1 },
  ]);
  expect(points.map(({ id }) => id)).toEqual(["first", "second", "third"]);
  expect(movedCuePointIds(points, 1, -1)).toEqual(["second", "first", "third"]);
  expect(movedCuePointIds(points, 1, 1)).toEqual(["first", "third", "second"]);
  expect(movedCuePointIds(points, 0, -1)).toBeUndefined();
  expect(movedCuePointIds(points, 2, 1)).toBeUndefined();
});

test("cue point CRUD, effects listing and order use encoded API endpoints", async () => {
  const fetchMock = vi.fn(async (_url, options) =>
    options.method === "DELETE" || options.method === "PUT"
      ? new Response(null, { status: 204 })
      : Response.json(
          !options.method ? [] : { id: "point-id", sceneId: "scene-id" },
        ),
  );
  globalThis.fetch = fetchMock;
  const input = {
    characterId,
    spokenText: "Hello",
    soundEffectIds: [effectId],
  };
  await expect(projectsApi.cuePoints("scene/id")).resolves.toEqual([]);
  await expect(projectsApi.soundEffects()).resolves.toEqual([]);
  await expect(
    projectsApi.createCuePoint("scene/id", input),
  ).resolves.toMatchObject({ id: "point-id" });
  await expect(
    projectsApi.updateCuePoint("point/id", input),
  ).resolves.toMatchObject({ id: "point-id" });
  await expect(
    projectsApi.reorderCuePoints("scene/id", { cuePointIds: ["b", "a"] }),
  ).resolves.toBeUndefined();
  await expect(projectsApi.deleteCuePoint("point/id")).resolves.toBeUndefined();
  expect(
    fetchMock.mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.body,
    ]),
  ).toEqual([
    ["/api/scenes/scene%2Fid/cue-points", undefined, undefined],
    ["/api/media?type=sound_effect", undefined, undefined],
    ["/api/scenes/scene%2Fid/cue-points", "POST", JSON.stringify(input)],
    ["/api/cue-points/point%2Fid", "PATCH", JSON.stringify(input)],
    [
      "/api/scenes/scene%2Fid/cue-points/order",
      "PUT",
      JSON.stringify({ cuePointIds: ["b", "a"] }),
    ],
    ["/api/cue-points/point%2Fid", "DELETE", undefined],
  ]);
  expect(projectKeys.cuePoints("scene-id")).toEqual([
    "scenes",
    "scene-id",
    "cue-points",
  ]);
});

test("cue point writes reject missing bodies and surface API errors", async () => {
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));
  await expect(
    projectsApi.createCuePoint("scene-id", { characterId, spokenText: "" }),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  globalThis.fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid order.",
          details: [],
        },
      },
      { status: 400 },
    ),
  );
  await expect(
    projectsApi.reorderCuePoints("scene-id", { cuePointIds: [] }),
  ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
});
