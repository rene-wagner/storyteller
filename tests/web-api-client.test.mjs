import { afterEach, expect, test, vi } from "vitest";
import { ApiError, createApiClient } from "../apps/web/src/api-client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const client = createApiClient("/api");

test("JSON requests send typed data and return parsed responses", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ id: "created" }, { status: 201 }),
  );
  globalThis.fetch = fetchMock;

  await expect(
    client.request("/projects", {
      method: "POST",
      json: { title: "Story" },
    }),
  ).resolves.toEqual({ id: "created" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/projects",
    expect.objectContaining({
      method: "POST",
      body: '{"title":"Story"}',
      headers: expect.any(Headers),
    }),
  );
  expect(fetchMock.mock.calls[0][1].headers.get("Content-Type")).toBe(
    "application/json",
  );
});

test("multipart requests leave the content type boundary to fetch", async () => {
  const fetchMock = vi.fn(async () => Response.json({ id: "media" }));
  globalThis.fetch = fetchMock;
  const formData = new FormData();
  formData.set("name", "Music");
  await expect(
    client.request("/media", {
      method: "POST",
      formData,
      headers: { "Content-Type": "application/json" },
    }),
  ).resolves.toEqual({ id: "media" });
  expect(fetchMock.mock.calls[0][1].body).toBe(formData);
  expect(fetchMock.mock.calls[0][1].headers.has("Content-Type")).toBe(false);
});

test("standard errors preserve code, status and details", async () => {
  globalThis.fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid data.",
          details: [{ field: "title" }],
        },
      },
      { status: 400 },
    ),
  );
  await expect(client.request("/projects")).rejects.toMatchObject({
    name: "ApiError",
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Invalid data.",
    details: [{ field: "title" }],
  });
});

test.each([
  ["non-JSON", new Response("Bad gateway", { status: 502 })],
  ["empty", new Response(null, { status: 503 })],
  ["malformed error", Response.json({ error: {} }, { status: 500 })],
])("%s error response uses a safe HTTP fallback", async (_name, response) => {
  globalThis.fetch = vi.fn(async () => response);
  await expect(client.request("/projects")).rejects.toMatchObject({
    status: response.status,
    code: "HTTP_ERROR",
    message: `Request failed with status ${response.status}.`,
  });
});

test("empty success returns undefined, while malformed success is an error", async () => {
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 }));
  await expect(
    client.request("/projects/one", { method: "DELETE" }),
  ).resolves.toBeUndefined();

  globalThis.fetch = vi.fn(
    async () => new Response("not JSON", { status: 200 }),
  );
  await expect(client.request("/projects")).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
    status: 200,
  });
});

test("JSON and multipart are mutually exclusive", async () => {
  await expect(
    client.request("/media", { json: {}, formData: new FormData() }),
  ).rejects.toThrow(TypeError);
});

test("network failures are propagated for query retry handling", async () => {
  globalThis.fetch = vi.fn(async () => {
    throw new TypeError("network error");
  });
  await expect(client.request("/projects")).rejects.toThrow("network error");
});

test("ApiError remains identifiable for UI and query consumers", () => {
  expect(new ApiError(404, "NOT_FOUND", "Missing")).toBeInstanceOf(Error);
});
