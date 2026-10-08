import { afterEach, expect, test, vi } from "vitest";
import {
  movedSceneIds,
  projectKeys,
  projectsApi,
  scenesByPosition,
  validateScene,
} from "../apps/web/src/projects.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("scene form trims titles, permits no music and rejects invalid IDs", () => {
  expect(validateScene({ title: "  ", backgroundMusicId: null })).toEqual({
    errors: { title: "Title is required." },
  });
  expect(
    validateScene({ title: "  Arrival  ", backgroundMusicId: null }),
  ).toEqual({
    value: { title: "Arrival", backgroundMusicId: null },
    errors: {},
  });
  expect(validateScene({ title: "Arrival", backgroundMusicId: "bad" })).toEqual(
    {
      errors: { backgroundMusicId: "Select background music or none." },
    },
  );
});

test("scenes display by position and adjacent controls submit the complete new order", () => {
  const scenes = scenesByPosition([
    { id: "third", position: 2 },
    { id: "first", position: 0 },
    { id: "second", position: 1 },
  ]);
  expect(scenes.map(({ id }) => id)).toEqual(["first", "second", "third"]);
  expect(movedSceneIds(scenes, 1, -1)).toEqual(["second", "first", "third"]);
  expect(movedSceneIds(scenes, 1, 1)).toEqual(["first", "third", "second"]);
  expect(movedSceneIds(scenes, 0, -1)).toBeUndefined();
  expect(movedSceneIds(scenes, 2, 1)).toBeUndefined();
  expect(movedSceneIds(scenes, 3, -1)).toBeUndefined();
});

test("scene list, filtered music, create, edit, delete and reorder use their endpoints", async () => {
  const fetchMock = vi.fn(async (_url, options) =>
    options.method === "DELETE" || options.method === "PUT"
      ? new Response(null, { status: 204 })
      : Response.json(
          !options.method || options.method === "GET"
            ? []
            : { id: "scene-id", episodeId: "episode-id" },
        ),
  );
  globalThis.fetch = fetchMock;
  const input = { title: "Arrival", backgroundMusicId: null };
  await expect(projectsApi.scenes("episode/id")).resolves.toEqual([]);
  await expect(projectsApi.backgroundMusic()).resolves.toEqual([]);
  await expect(
    projectsApi.createScene("episode/id", input),
  ).resolves.toMatchObject({ id: "scene-id" });
  await expect(
    projectsApi.updateScene("scene/id", input),
  ).resolves.toMatchObject({ id: "scene-id" });
  await expect(
    projectsApi.reorderScenes("episode/id", { sceneIds: ["second", "first"] }),
  ).resolves.toBeUndefined();
  await expect(projectsApi.deleteScene("scene/id")).resolves.toBeUndefined();
  expect(
    fetchMock.mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.body,
    ]),
  ).toEqual([
    ["/api/episodes/episode%2Fid/scenes", undefined, undefined],
    ["/api/media?type=background_music", undefined, undefined],
    ["/api/episodes/episode%2Fid/scenes", "POST", JSON.stringify(input)],
    ["/api/scenes/scene%2Fid", "PATCH", JSON.stringify(input)],
    [
      "/api/episodes/episode%2Fid/scenes/order",
      "PUT",
      JSON.stringify({ sceneIds: ["second", "first"] }),
    ],
    ["/api/scenes/scene%2Fid", "DELETE", undefined],
  ]);
  expect(projectKeys.scenes("episode-id")).toEqual([
    "episodes",
    "episode-id",
    "scenes",
  ]);
});

test("scene writes reject missing bodies and propagate API errors", async () => {
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));
  await expect(
    projectsApi.createScene("episode-id", { title: "Arrival" }),
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
    projectsApi.reorderScenes("episode-id", { sceneIds: [] }),
  ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
});
