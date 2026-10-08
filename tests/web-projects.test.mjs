import { afterEach, expect, test, vi } from "vitest";
import {
  projectsApi,
  projectKeys,
  validateProject,
  projectError,
} from "../apps/web/src/projects.ts";
import { ApiError } from "../apps/web/src/api-client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("project form rejects whitespace-only required fields and accepts a blank description", () => {
  expect(validateProject({ title: "  ", genre: " ", description: "" })).toEqual(
    {
      errors: { title: "Title is required.", genre: "Genre is required." },
    },
  );
  expect(
    validateProject({ title: "  Story  ", genre: " Drama ", description: "" }),
  ).toEqual({
    value: { title: "Story", genre: "Drama", description: "" },
    errors: {},
  });
});

test("project list, detail, and child lists use their own endpoints", async () => {
  const fetchMock = vi.fn(async () => Response.json([]));
  globalThis.fetch = fetchMock;
  await projectsApi.list();
  await projectsApi.get("project-id");
  await projectsApi.characters("project-id");
  await projectsApi.episodes("project-id");
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "/api/projects",
    "/api/projects/project-id",
    "/api/projects/project-id/characters",
    "/api/projects/project-id/episodes",
  ]);
  expect(projectKeys.detail("project-id")).toEqual(["projects", "project-id"]);
});

test("project writes send JSON, delete accepts 204 and API errors remain visible", async () => {
  const fetchMock = vi.fn(async (_url, options) =>
    options.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ id: "created" }),
  );
  globalThis.fetch = fetchMock;
  const input = { title: "Story", genre: "Drama", description: "" };
  await expect(projectsApi.create(input)).resolves.toEqual({ id: "created" });
  await expect(projectsApi.update("project-id", input)).resolves.toEqual({
    id: "created",
  });
  await expect(projectsApi.delete("project-id")).resolves.toBeUndefined();
  expect(
    fetchMock.mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.body,
    ]),
  ).toEqual([
    ["/api/projects", "POST", JSON.stringify(input)],
    ["/api/projects/project-id", "PATCH", JSON.stringify(input)],
    ["/api/projects/project-id", "DELETE", undefined],
  ]);

  globalThis.fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project.",
          details: [],
        },
      },
      { status: 400 },
    ),
  );
  await expect(projectsApi.create(input)).rejects.toMatchObject({
    status: 400,
    code: "VALIDATION_ERROR",
  });
  expect(
    projectError(new ApiError(400, "VALIDATION_ERROR", "Invalid project.")),
  ).toBe("Invalid project.");
  expect(projectError(new TypeError("network details"))).toBe(
    "Unable to complete the request. Please try again.",
  );
});

test("project reads reject an empty success body", async () => {
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 }));
  await expect(projectsApi.list()).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});
