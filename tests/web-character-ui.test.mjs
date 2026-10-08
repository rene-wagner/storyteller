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

test("character form displays selected type and labelled fields", async () => {
  const Form = (await server.ssrLoadModule("/src/components/CharacterForm.vue"))
    .default;
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(Form, {
          initial: { name: "Alex", type: "supporting" },
          submitLabel: "Save character",
        }),
    }),
  );
  expect(html).toContain('id="character-name"');
  expect(html).toContain('value="Alex"');
  expect(html).toContain('value="supporting" selected');
  expect(html).toContain("Save character");
});
