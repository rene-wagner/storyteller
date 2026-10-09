import { createRequire } from "node:module";
import { afterAll, beforeAll, expect, test } from "vitest";

const requireFromWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createServer } = requireFromWeb("vite");
const { createSSRApp, h } = requireFromWeb("vue");
const { renderToString } = requireFromWeb("vue/server-renderer");
const { QueryClient, VueQueryPlugin } = requireFromWeb("@tanstack/vue-query");
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

async function render(path, data, props) {
  const Component = (await server.ssrLoadModule(path)).default;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  for (const [key, value] of data) queryClient.setQueryData(key, value);
  const app = createSSRApp({ render: () => h(Component, props) });
  app.use(VueQueryPlugin, { queryClient });
  return renderToString(app);
}

test("nested screens distinguish loading and empty scenes and cue points and confirm their deletion", async () => {
  const loadingScenes = await render("/src/components/EpisodeScenes.vue", [], {
    episodeId: "episode-id",
    projectId: "id",
  });
  expect(loadingScenes).toContain("Loading scenes…");
  const sceneHtml = await render(
    "/src/components/EpisodeScenes.vue",
    [
      [["episodes", "episode-id", "scenes"], []],
      [["media", "background_music"], []],
    ],
    { episodeId: "episode-id", projectId: "id" },
  );
  expect(sceneHtml).toContain("No scenes");
  expect(sceneHtml).toContain("Delete scene?");

  const loadingPoints = await render("/src/components/SceneCuePoints.vue", [], {
    sceneId: "scene-id",
    projectId: "id",
  });
  expect(loadingPoints).toContain("Loading cue points…");
  const pointHtml = await render(
    "/src/components/SceneCuePoints.vue",
    [
      [["scenes", "scene-id", "cue-points"], []],
      [["projects", "id", "characters"], []],
      [["media", "sound_effect"], []],
    ],
    { sceneId: "scene-id", projectId: "id" },
  );
  expect(pointHtml).toContain("No cue points");
  expect(pointHtml).toContain("Delete cue point?");

  const mediaHtml = await render("/src/views/MediaView.vue", [
    [["media", "all"], []],
  ]);
  expect(mediaHtml).toContain("No media items");
  expect(mediaHtml).toContain("Upload an audio file to get started.");
  expect(mediaHtml).toContain("Delete media?");
});
