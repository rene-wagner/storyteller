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

test("scene form labels fields, selects saved background music and excludes sound effects", async () => {
  const Form = (await server.ssrLoadModule("/src/components/SceneForm.vue"))
    .default;
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(Form, {
          initial: { title: "Arrival", backgroundMusicId: "music-id" },
          music: [
            { id: "music-id", name: "Theme", type: "background_music" },
            { id: "effect-id", name: "Thunder", type: "sound_effect" },
          ],
          submitLabel: "Save scene",
        }),
    }),
  );
  expect(html).toMatch(/<label for="([^"]+)-title"[^>]*>Title<\/label>/);
  expect(html).toContain('value="Arrival"');
  expect(html).toMatch(
    /<label for="([^"]+)-music"[^>]*>Background music<\/label>/,
  );
  expect(html).toContain('value=""');
  expect(html).toContain('value="music-id" selected');
  expect(html).toContain("Theme");
  expect(html).not.toContain("Thunder");
  expect(html).toContain("Save scene");
});

test("episode scenes show ordered nested accordions with create and adjacent move controls", async () => {
  const Scenes = (
    await server.ssrLoadModule("/src/components/EpisodeScenes.vue")
  ).default;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    ["episodes", "episode-id", "scenes"],
    [
      {
        id: "second",
        episodeId: "episode-id",
        title: "After",
        position: 1,
        backgroundMusicId: null,
      },
      {
        id: "first",
        episodeId: "episode-id",
        title: "Before",
        position: 0,
        backgroundMusicId: null,
      },
    ],
  );
  queryClient.setQueryData(["media", "background_music"], []);
  const app = createSSRApp({
    render: () => h(Scenes, { episodeId: "episode-id" }),
  });
  app.use(VueQueryPlugin, { queryClient });
  const html = await renderToString(app);
  expect(html).toContain("Add scene");
  expect(html.indexOf("1. Before")).toBeLessThan(html.indexOf("2. After"));
  expect(html).toContain("<details");
  expect(html).toContain("Move Before up");
  expect(html).toContain("Move After down");
  expect(html).toContain("Edit Before");
  expect(html).toContain("Delete Before");
});
