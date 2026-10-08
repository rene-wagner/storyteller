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

async function component(name) {
  return (await server.ssrLoadModule(`/src/components/ui/${name}.vue`)).default;
}

async function markup(name, props, slots) {
  return renderToString(
    createSSRApp({ render: () => h(components[name], props, slots) }),
  );
}

const components = {};

beforeAll(async () => {
  for (const name of [
    "FormField",
    "TextInput",
    "TextareaInput",
    "SelectInput",
    "CheckboxInput",
    "BaseButton",
    "BaseAlert",
    "ErrorState",
    "EmptyState",
    "LoadingState",
    "ConfirmationDialog",
    "Accordion",
    "AccordionItem",
    "AccordionHeader",
    "AccordionContent",
  ])
    components[name] = await component(name);
});

test("form field labels its control and exposes error association", async () => {
  const html = await markup(
    "FormField",
    { label: "Name", forId: "name", error: "Required" },
    {
      default: ({ describedBy, invalid }) =>
        h(components.TextInput, {
          id: "name",
          "aria-describedby": describedBy,
          "aria-invalid": invalid,
        }),
    },
  );
  expect(html).toContain('for="name"');
  expect(html).toContain('id="name"');
  expect(html).toContain('aria-describedby="name-error"');
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('id="name-error"');
  expect(html).toContain("Required");
});

test("form field connects help text when there is no error", async () => {
  const html = await markup(
    "FormField",
    { label: "Name", forId: "name", hint: "Your display name" },
    {
      default: ({ describedBy, invalid }) =>
        h(components.TextInput, {
          id: "name",
          "aria-describedby": describedBy,
          "aria-invalid": invalid,
        }),
    },
  );
  expect(html).toContain('aria-describedby="name-hint"');
  expect(html).toContain('id="name-hint"');
  expect(html).not.toContain('aria-invalid="true"');
});

test("form controls preserve native semantics and button defaults to non-submit", async () => {
  expect(await markup("TextareaInput", { id: "story" })).toContain("<textarea");
  expect(
    await markup(
      "SelectInput",
      { id: "choice" },
      { default: () => h("option", { value: "a" }, "A") },
    ),
  ).toContain('<option value="a">A</option>');
  expect(await markup("CheckboxInput", { id: "ok" })).toContain(
    'type="checkbox"',
  );
  expect(await markup("BaseButton", {}, { default: () => "Save" })).toContain(
    'type="button"',
  );
});

test("feedback provides appropriate status and alert semantics", async () => {
  expect(
    await markup(
      "BaseAlert",
      { variant: "error" },
      { default: () => "Failed" },
    ),
  ).toContain('role="alert"');
  expect(
    await markup("ErrorState", { title: "Failed", message: "Retry" }),
  ).toContain('role="alert"');
  expect(
    await markup("EmptyState", { title: "No projects", message: "Create one" }),
  ).toContain("No projects");
  expect(await markup("LoadingState", {})).toContain('role="status"');
  const dialog = await markup("ConfirmationDialog", {
    title: "Delete?",
    message: "Permanent",
  });
  expect(dialog).toContain("<dialog");
  expect(dialog).toMatch(/aria-labelledby="v-[^"]+"/);
  expect(dialog).toContain("Cancel");
  expect(dialog).toContain("Confirm");
});

test("accordion uses native details and summary for keyboard-operable disclosure", async () => {
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(components.Accordion, null, {
          default: () =>
            h(
              components.AccordionItem,
              { defaultOpen: true },
              {
                default: () => [
                  h(components.AccordionHeader, null, {
                    default: () => "Episode",
                  }),
                  h(components.AccordionContent, null, {
                    default: () => "Scenes",
                  }),
                ],
              },
            ),
        }),
    }),
  );
  expect(html).toMatch(/<details[^>]* open>/);
  expect(html).toContain("<summary");
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("Scenes");
  const collapsed = await markup(
    "AccordionItem",
    {},
    {
      default: () =>
        h(components.AccordionHeader, null, { default: () => "Closed" }),
    },
  );
  expect(collapsed).not.toMatch(/<details[^>]* open>/);
});
