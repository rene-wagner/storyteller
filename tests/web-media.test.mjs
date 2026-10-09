import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";
import { ApiError, createApiClient } from "../apps/web/src/api-client.ts";

const requireFromWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createServer } = requireFromWeb("vite");
const { createSSRApp, h } = requireFromWeb("vue");
const { renderToString } = requireFromWeb("vue/server-renderer");
const { QueryClient, VueQueryPlugin } = requireFromWeb("@tanstack/vue-query");
const originalFetch = globalThis.fetch;
let server;
beforeAll(async () => {
  server = await createServer({
    root: new URL("../apps/web/", import.meta.url).pathname,
    server: { middlewareMode: true },
    appType: "custom",
  });
});
afterAll(async () => {
  await server?.close();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const item = {
  id: "media-id",
  name: "Theme",
  type: "background_music",
  fileName: "theme.mp3",
  createdAt: "2025-01-20T12:00:00.000Z",
  updatedAt: "2025-01-20T12:00:00.000Z",
  mimeType: "audio/mpeg",
  fileSize: "10",
};

async function renderMedia(queryData, error) {
  const View = (await server.ssrLoadModule("/src/views/MediaView.vue")).default;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false, retryOnMount: false },
    },
  });
  if (queryData !== undefined)
    queryClient.setQueryData(["media", "all"], queryData);
  if (error) {
    queryClient.setQueryData(["media", "all"], []);
    queryClient
      .getQueryCache()
      .find({ queryKey: ["media", "all"] })
      .setState({
        data: undefined,
        error,
        status: "error",
        fetchStatus: "idle",
      });
  }
  const app = createSSRApp({ render: () => h(View) });
  app.use(VueQueryPlugin, { queryClient });
  return renderToString(app);
}

test("media library renders upload, filters, metadata and edit/delete actions", async () => {
  const html = await renderMedia([item]);
  expect(html).toContain("Upload media");
  expect(html).toContain('type="file"');
  expect(html).toContain('accept="audio/*"');
  expect(html).toContain("Background Music");
  expect(html).toContain("Sound Effects");
  expect(html).toContain("All");
  expect(html).toContain("Theme");
  expect(html).toContain("theme.mp3");
  expect(html).toContain("Created:");
  expect(html).toContain(">Edit</button>");
  expect(html).toContain(">Delete</button>");
});

test("media library renders loading and empty states", async () => {
  expect(await renderMedia()).toContain("Loading media…");
  expect(await renderMedia([])).toContain("No media items");
});

test("media library renders failed loading with retry", async () => {
  const html = await renderMedia(
    undefined,
    new ApiError(500, "INTERNAL_ERROR", "Unable to load."),
  );
  expect(html).toContain("Could not load media");
  expect(html).toContain("Unable to complete the request.");
  expect(html).toContain("Try again");
});

test("media client lists filtered items and sends upload, rename and delete requests", async () => {
  const { mediaApi } = await server.ssrLoadModule("/src/media.ts");
  const calls = [];
  globalThis.fetch = vi.fn(async (url, options) => {
    calls.push({ url, options });
    if (options.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json(
      url.includes("?type=") || options.method === undefined ? [item] : item,
    );
  });
  expect(await mediaApi.list()).toEqual([item]);
  expect(await mediaApi.list("sound_effect")).toEqual([item]);
  const file = new File(["audio"], "theme.mp3", { type: "audio/mpeg" });
  await mediaApi.upload({ name: "Theme", type: "background_music" }, file);
  await mediaApi.updateName("media-id", "New name");
  await mediaApi.delete("media-id");
  expect(calls.map(({ url }) => url)).toEqual([
    "/api/media",
    "/api/media?type=sound_effect",
    "/api/media",
    "/api/media/media-id",
    "/api/media/media-id",
  ]);
  const form = calls[2].options.body;
  expect(form).toBeInstanceOf(FormData);
  expect(form.get("name")).toBe("Theme");
  expect(form.get("type")).toBe("background_music");
  expect(form.get("file")).toBe(file);
  expect(calls[2].options.headers.has("Content-Type")).toBe(false);
  expect(calls[3].options.body).toBe('{"name":"New name"}');
  expect(calls[4].options.method).toBe("DELETE");
});

test("media input validates name and audio file before upload", async () => {
  const { validateMediaUpload, validateMediaName } =
    await server.ssrLoadModule("/src/media.ts");
  const audio = new File(["a"], "a.mp3", { type: "audio/mpeg" });
  expect(
    validateMediaUpload(" Theme ", "background_music", audio),
  ).toBeUndefined();
  expect(validateMediaUpload("", "background_music", audio)).toMatch(/name/);
  expect(
    validateMediaUpload("é".repeat(129), "background_music", audio),
  ).toMatch(/256 bytes/);
  expect(
    validateMediaUpload("é".repeat(128), "background_music", audio),
  ).toBeUndefined();
  expect(validateMediaUpload("Theme", "invalid", audio)).toMatch(/type/);
  expect(validateMediaUpload("Theme", "sound_effect", null)).toMatch(
    /audio file/,
  );
  expect(
    validateMediaUpload(
      "Theme",
      "sound_effect",
      new File(["x"], "x.txt", { type: "text/plain" }),
    ),
  ).toMatch(/audio file/);
  expect(validateMediaName(" ")).toMatch(/name/);
  expect(validateMediaName(" New name ")).toBeUndefined();
});

test("media deletion conflict preserves only validated usage without changing standard errors", async () => {
  const client = createApiClient("/api");
  globalThis.fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: "CONFLICT",
          message: "Media item is in use.",
          details: [],
          usage: { sceneIds: ["scene-id"], cuePointIds: ["point-id"] },
        },
      },
      { status: 409 },
    ),
  );
  await expect(
    client.request("/media/media-id", { method: "DELETE" }),
  ).rejects.toMatchObject({
    status: 409,
    code: "CONFLICT",
    usage: { sceneIds: ["scene-id"], cuePointIds: ["point-id"] },
  });
  globalThis.fetch = vi.fn(async () =>
    Response.json(
      {
        error: {
          code: "CONFLICT",
          message: "Conflict",
          details: [],
          usage: { sceneIds: [12], cuePointIds: [] },
        },
      },
      { status: 409 },
    ),
  );
  await expect(client.request("/media/media-id")).rejects.toMatchObject({
    usage: undefined,
  });
  expect(
    new ApiError(400, "VALIDATION_ERROR", "Invalid").usage,
  ).toBeUndefined();
});
