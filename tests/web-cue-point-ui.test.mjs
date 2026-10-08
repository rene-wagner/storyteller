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

const character = { id: "character-id", projectId: "project-id", name: "Ada" };
const effects = [
  { id: "effect-id", name: "Thunder", type: "sound_effect" },
  { id: "second-effect-id", name: "Rain", type: "sound_effect" },
  { id: "music-id", name: "Theme", type: "background_music" },
];

test("cue point form renders project characters and selected sound effects, excludes music", async () => {
  const Form = (await server.ssrLoadModule("/src/components/CuePointForm.vue"))
    .default;
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(Form, {
          initial: {
            characterId: character.id,
            spokenText: "Hello",
            soundEffectIds: ["effect-id", "second-effect-id"],
          },
          characters: [character],
          effects,
          submitLabel: "Save cue point",
        }),
    }),
  );
  expect(html).toMatch(
    /<label for="([^"]+)-character"[^>]*>Character<\/label>/,
  );
  expect(html).toContain('value="character-id" selected');
  expect(html).toContain("Ada");
  expect(html).toContain("Hello");
  expect(html).toContain("Thunder");
  expect(html).toContain("Rain");
  expect(html.match(/checked/g)).toHaveLength(2);
  expect(html).not.toContain("Theme");
  expect(html).toContain("Save cue point");
});

test("scenes nest cue points with the owning project characters", async () => {
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
        id: "scene-id",
        episodeId: "episode-id",
        title: "Opening",
        position: 0,
        backgroundMusicId: null,
      },
    ],
  );
  queryClient.setQueryData(
    ["scenes", "scene-id", "cue-points"],
    [
      {
        id: "point-id",
        sceneId: "scene-id",
        position: 0,
        characterId: character.id,
        spokenText: "Welcome",
        soundEffectIds: [],
      },
    ],
  );
  queryClient.setQueryData(
    ["projects", "project-id", "characters"],
    [character],
  );
  queryClient.setQueryData(["media", "sound_effect"], []);
  queryClient.setQueryData(["media", "background_music"], []);
  const app = createSSRApp({
    render: () =>
      h(Scenes, { episodeId: "episode-id", projectId: "project-id" }),
  });
  app.use(VueQueryPlugin, { queryClient });
  const html = await renderToString(app);
  expect(html).toContain("Opening");
  expect(html).toContain("Cue points");
  expect(html).toContain("Welcome");
  expect(html).toContain("Ada");
});

test("scene cue points show positioned list, edit/delete and adjacent move controls", async () => {
  const Points = (
    await server.ssrLoadModule("/src/components/SceneCuePoints.vue")
  ).default;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    ["scenes", "scene-id", "cue-points"],
    [
      {
        id: "second",
        sceneId: "scene-id",
        position: 1,
        characterId: character.id,
        spokenText: "After",
        soundEffectIds: [],
      },
      {
        id: "first",
        sceneId: "scene-id",
        position: 0,
        characterId: character.id,
        spokenText: "Before",
        soundEffectIds: ["effect-id"],
      },
    ],
  );
  queryClient.setQueryData(
    ["projects", "project-id", "characters"],
    [character],
  );
  queryClient.setQueryData(["media", "sound_effect"], effects);
  const app = createSSRApp({
    render: () => h(Points, { sceneId: "scene-id", projectId: "project-id" }),
  });
  app.use(VueQueryPlugin, { queryClient });
  const html = await renderToString(app);
  expect(html).toContain("Add cue point");
  expect(html.indexOf("Before")).toBeLessThan(html.indexOf("After"));
  expect(html).toContain("Ada");
  expect(html).toContain("Thunder");
  expect(html).not.toContain("Theme");
  expect(html).toContain("Move cue point 1 up");
  expect(html).toContain("Move cue point 2 down");
  expect(html).toContain("Edit cue point 1");
  expect(html).toContain("Delete cue point 1");
});
