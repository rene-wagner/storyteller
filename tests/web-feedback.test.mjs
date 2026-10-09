import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { ApiError } from "../apps/web/src/api-client.ts";
import { useFeedbackStore } from "../apps/web/src/feedback.ts";
import { pinia } from "../apps/web/src/pinia.ts";
import { queryClient } from "../apps/web/src/query-client.ts";

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
beforeEach(() => {
  useFeedbackStore(pinia).$reset();
});

async function mutate(meta, mutationFn) {
  return queryClient
    .getMutationCache()
    .build(queryClient, {
      mutationFn,
      meta,
    })
    .execute();
}

test("global feedback reports write successes and request failures without duplicating contextual conflicts", async () => {
  const feedback = useFeedbackStore(pinia);
  await mutate({ successMessage: "Project created." }, async () => ({}));
  await mutate({ successMessage: "Media uploaded." }, async () => ({}));
  expect(feedback.notices.map(({ message }) => message)).toEqual([
    "Project created.",
    "Media uploaded.",
  ]);

  await expect(
    mutate({}, async () => {
      throw new ApiError(500, "SERVER_ERROR", "Please try again.");
    }),
  ).rejects.toThrow("Please try again.");
  expect(feedback.notices.at(-1)).toMatchObject({
    variant: "error",
    message: "Please try again.",
  });

  await expect(
    mutate({ contextualConflict: true }, async () => {
      throw new ApiError(409, "CONFLICT", "Item is in use.");
    }),
  ).rejects.toThrow("Item is in use.");
  expect(feedback.notices).toHaveLength(3);

  await expect(
    mutate({}, async () => {
      throw new TypeError("network unavailable");
    }),
  ).rejects.toThrow("network unavailable");
  expect(feedback.notices.at(-1).message).toBe(
    "Unable to complete the request. Please try again.",
  );
});

test("notices render with status/alert semantics and can be dismissed", async () => {
  const feedback = useFeedbackStore(pinia);
  feedback.notify("success", "Project created.");
  feedback.notify("error", "Request failed.");
  const Notices = (
    await server.ssrLoadModule("/src/components/ui/FeedbackNotices.vue")
  ).default;
  const app = createSSRApp({ render: () => h(Notices) });
  app.use(pinia);
  const html = await renderToString(app);
  expect(html).toContain('role="status"');
  expect(html).toContain('role="alert"');
  expect(html).toContain("Project created.");
  expect(html).toContain("Request failed.");
  expect(html).toContain('aria-label="Dismiss error notification"');
  const id = feedback.notices[0].id;
  feedback.dismiss(id);
  expect(feedback.notices.map(({ message }) => message)).toEqual([
    "Request failed.",
  ]);
});
