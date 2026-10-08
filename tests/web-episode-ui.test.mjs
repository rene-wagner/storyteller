import { createRequire } from "node:module";
import { afterAll, beforeAll, expect, test } from "vitest";

const requireFromWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createServer } = requireFromWeb("vite");
const { createSSRApp, h } = requireFromWeb("vue");
const { renderToString } = requireFromWeb("vue/server-renderer");
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

test("episode form displays initial title and description with labelled fields", async () => {
  const Form = (await server.ssrLoadModule("/src/components/EpisodeForm.vue"))
    .default;
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(Form, {
          initial: { title: "Pilot", description: "An opening." },
          submitLabel: "Save episode",
        }),
    }),
  );
  expect(html).toContain('id="episode-title"');
  expect(html).toContain('value="Pilot"');
  expect(html).toContain('id="episode-description"');
  expect(html).toContain("An opening.");
  expect(html).toContain("Save episode");
});
