import { expect, onTestFinished, test } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { createProjectSchema } from "../packages/shared/src/index.ts";

function testApp() {
  const app = createApp();
  onTestFinished(() => app.close());
  return app;
}

function expectError(response, statusCode, code, message) {
  expect(response.statusCode).toBe(statusCode);
  expect(response.headers["content-type"]).toMatch(/application\/json/);
  expect(response.json()).toStrictEqual({
    error: { code, message, details: [] },
  });
}

test("health remains unaffected by global error handling", async () => {
  const response = await testApp().inject({ method: "GET", url: "/health" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toStrictEqual({ status: "ok" });
});

test("Zod input errors return a safe validation response", async () => {
  const app = testApp();
  app.post("/probe", async (request) =>
    createProjectSchema.parse(request.body),
  );
  const response = await app.inject({
    method: "POST",
    url: "/probe",
    payload: { title: "", genre: "Drama", description: "/tmp/private" },
  });
  expectError(
    response,
    400,
    "VALIDATION_ERROR",
    "The request contains invalid data.",
  );
  expect(response.body).not.toContain("/tmp/private");
});

test("Fastify request validation and malformed JSON use the same format", async () => {
  const app = testApp();
  app.post(
    "/probe",
    { schema: { body: { type: "object", required: ["title"] } } },
    async () => ({ ok: true }),
  );
  for (const payload of [{}, '{"title":']) {
    const response = await app.inject({
      method: "POST",
      url: "/probe",
      payload,
      headers: { "content-type": "application/json" },
    });
    expectError(
      response,
      400,
      "VALIDATION_ERROR",
      "The request contains invalid data.",
    );
  }
});

test("missing routes and explicit not-found errors are standardized", async () => {
  const app = testApp();
  app.get("/missing-resource", async () => {
    throw Object.assign(new Error("private resource ID"), { statusCode: 404 });
  });
  for (const url of ["/unknown-route", "/missing-resource"]) {
    const response = await app.inject({ method: "GET", url });
    expectError(response, 404, "NOT_FOUND", "Resource not found.");
    expect(response.body).not.toContain("private resource ID");
  }
});

test("conflicts return HTTP 409 without exposing the underlying message", async () => {
  const app = testApp();
  app.get("/conflict", async () => {
    throw Object.assign(new Error("duplicate key on /private/table"), {
      statusCode: 409,
    });
  });
  const response = await app.inject({ method: "GET", url: "/conflict" });
  expectError(response, 409, "CONFLICT", "Resource conflict.");
  expect(response.body).not.toContain("/private/table");
});

test("unexpected errors hide internals and stack traces", async () => {
  const app = testApp();
  app.get("/failure", async () => {
    throw new Error("database password at /tmp/secret");
  });
  const response = await app.inject({ method: "GET", url: "/failure" });
  expectError(response, 500, "INTERNAL_ERROR", "An unexpected error occurred.");
  expect(response.body).not.toMatch(
    /database|password|\/tmp\/secret|stack|at .*\.ts:/,
  );
});

test("other client errors preserve their status but do not expose parser internals", async () => {
  const app = testApp();
  app.post("/probe", async () => ({ ok: true }));
  const response = await app.inject({
    method: "POST",
    url: "/probe",
    payload: "not JSON",
    headers: { "content-type": "application/x-private" },
  });
  expectError(
    response,
    415,
    "REQUEST_ERROR",
    "The request could not be processed.",
  );
  expect(response.body).not.toContain("application/x-private");
});
