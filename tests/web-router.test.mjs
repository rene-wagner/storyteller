import { createRequire } from "node:module";
import { expect, test } from "vitest";
import { routes } from "../apps/web/src/router.ts";

const requireFromWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createMemoryHistory, createRouter } = requireFromWeb("vue-router");
const router = createRouter({ history: createMemoryHistory(), routes });

test.each([
  ["/", "home"],
  ["/projects", "projects"],
  ["/projects/new", "new-project"],
  ["/projects/example-id", "project"],
  ["/media", "media"],
])("%s resolves to the %s view", (path, name) => {
  expect(router.resolve(path).name).toBe(name);
});

test("the project detail route retains its project identifier", () => {
  expect(router.resolve("/projects/example-id").params.projectId).toBe(
    "example-id",
  );
});
