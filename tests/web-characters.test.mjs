import { afterEach, expect, test, vi } from "vitest";
import {
  projectsApi,
  projectKeys,
  validateCharacter,
} from "../apps/web/src/projects.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("character form trims names and validates both required fields using the shared schema", () => {
  expect(validateCharacter({ name: "  ", type: "main" })).toEqual({
    errors: { name: "Name is required." },
  });
  expect(validateCharacter({ name: "Alex", type: "other" })).toEqual({
    errors: { type: "Select a character type." },
  });
  expect(validateCharacter({ name: "  Alex  ", type: "supporting" })).toEqual({
    value: { name: "Alex", type: "supporting" },
    errors: {},
  });
});

test("character create, edit and delete use their endpoints and preserve server errors", async () => {
  const fetchMock = vi.fn(async (_url, options) =>
    options.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ id: "character-id", projectId: "project-id" }),
  );
  globalThis.fetch = fetchMock;
  const input = { name: "Alex", type: "main" };
  await expect(
    projectsApi.createCharacter("project/id", input),
  ).resolves.toMatchObject({ id: "character-id" });
  await expect(
    projectsApi.updateCharacter("character/id", input),
  ).resolves.toMatchObject({ id: "character-id" });
  await expect(
    projectsApi.deleteCharacter("character/id"),
  ).resolves.toBeUndefined();
  expect(
    fetchMock.mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.body,
    ]),
  ).toEqual([
    ["/api/projects/project%2Fid/characters", "POST", JSON.stringify(input)],
    ["/api/characters/character%2Fid", "PATCH", JSON.stringify(input)],
    ["/api/characters/character%2Fid", "DELETE", undefined],
  ]);
  expect(projectKeys.characters("project-id")).toEqual([
    "projects",
    "project-id",
    "characters",
  ]);

  globalThis.fetch = vi.fn(async () =>
    Response.json(
      {
        error: { code: "CONFLICT", message: "Resource conflict.", details: [] },
      },
      { status: 409 },
    ),
  );
  await expect(
    projectsApi.deleteCharacter("character-id"),
  ).rejects.toMatchObject({
    status: 409,
    code: "CONFLICT",
  });
});

test("character writes reject missing response bodies", async () => {
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 200 }));
  await expect(
    projectsApi.createCharacter("project-id", { name: "Alex", type: "main" }),
  ).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});
