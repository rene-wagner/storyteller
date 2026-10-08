import { afterEach, expect, test, vi } from "vitest";
import {
  episodesByPosition,
  movedEpisodeIds,
  projectsApi,
  projectKeys,
  validateEpisode,
} from "../apps/web/src/projects.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("episode form trims required titles and allows empty descriptions", () => {
  expect(validateEpisode({ title: "  ", description: "" })).toEqual({
    errors: { title: "Title is required." },
  });
  expect(validateEpisode({ title: "  Pilot  ", description: "" })).toEqual({
    value: { title: "Pilot", description: "" },
    errors: {},
  });
  expect(validateEpisode({ title: "Pilot", description: 12 })).toEqual({
    errors: { description: "Description is required." },
  });
});

test("episodes display by position and adjacent controls submit the complete new order", () => {
  const episodes = episodesByPosition([
    { id: "third", position: 2 },
    { id: "first", position: 0 },
    { id: "second", position: 1 },
  ]);
  expect(episodes.map(({ id }) => id)).toEqual(["first", "second", "third"]);
  expect(movedEpisodeIds(episodes, 1, -1)).toEqual([
    "second",
    "first",
    "third",
  ]);
  expect(movedEpisodeIds(episodes, 1, 1)).toEqual(["first", "third", "second"]);
  expect(movedEpisodeIds(episodes, 0, -1)).toBeUndefined();
  expect(movedEpisodeIds(episodes, 2, 1)).toBeUndefined();
  expect(movedEpisodeIds(episodes, 3, -1)).toBeUndefined();
});

test("episode creation, editing, deletion and ordering use their endpoints", async () => {
  const fetchMock = vi.fn(async (_url, options) =>
    options.method === "DELETE" || options.method === "PUT"
      ? new Response(null, { status: 204 })
      : Response.json({ id: "episode-id", projectId: "project-id" }),
  );
  globalThis.fetch = fetchMock;
  const input = { title: "Pilot", description: "An opening." };
  await expect(
    projectsApi.createEpisode("project/id", input),
  ).resolves.toMatchObject({
    id: "episode-id",
  });
  await expect(
    projectsApi.updateEpisode("episode/id", input),
  ).resolves.toMatchObject({
    id: "episode-id",
  });
  await expect(
    projectsApi.reorderEpisodes("project/id", {
      episodeIds: ["second", "first"],
    }),
  ).resolves.toBeUndefined();
  await expect(
    projectsApi.deleteEpisode("episode/id"),
  ).resolves.toBeUndefined();
  expect(
    fetchMock.mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.body,
    ]),
  ).toEqual([
    ["/api/projects/project%2Fid/episodes", "POST", JSON.stringify(input)],
    ["/api/episodes/episode%2Fid", "PATCH", JSON.stringify(input)],
    [
      "/api/projects/project%2Fid/episodes/order",
      "PUT",
      JSON.stringify({ episodeIds: ["second", "first"] }),
    ],
    ["/api/episodes/episode%2Fid", "DELETE", undefined],
  ]);
  expect(projectKeys.episodes("project-id")).toEqual([
    "projects",
    "project-id",
    "episodes",
  ]);
});

test("episode writes reject missing bodies and preserve API validation errors", async () => {
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));
  await expect(
    projectsApi.createEpisode("project-id", {
      title: "Pilot",
      description: "",
    }),
  ).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
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
    projectsApi.reorderEpisodes("project-id", { episodeIds: [] }),
  ).rejects.toMatchObject({
    status: 400,
    code: "VALIDATION_ERROR",
  });
});
