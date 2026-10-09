import { expect, test } from "vitest";
import { projects } from "../../apps/api/src/db/schema.ts";
import {
  createBackendTest,
  createMemoryMediaStorage,
  createTestApp,
  testDatabaseUrl,
} from "./helpers.mjs";

const url = "postgresql://localhost:5432/storyteller_test";

test("test database must be explicitly configured and separate from the application database", () => {
  expect(() => testDatabaseUrl({})).toThrow(/TEST_DATABASE_URL is required/);
  for (const invalid of [
    "postgresql://localhost/storyteller",
    "https://localhost/storyteller_test",
    "not a URL",
  ]) {
    expect(() => testDatabaseUrl({ TEST_DATABASE_URL: invalid })).toThrow(
      /TEST_DATABASE_URL/,
    );
  }
  for (const applicationUrl of [url, "postgres://127.0.0.1/storyteller_test"]) {
    expect(() =>
      testDatabaseUrl({ TEST_DATABASE_URL: url, DATABASE_URL: applicationUrl }),
    ).toThrow(/must not point to DATABASE_URL/);
  }
  expect(
    testDatabaseUrl({
      TEST_DATABASE_URL: url,
      DATABASE_URL: "postgresql://localhost/storyteller",
    }),
  ).toBe(url);
});

test("Fastify injection and in-memory media storage work without a database", async () => {
  const app = createTestApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toStrictEqual({ status: "ok" });

  const storage = createMemoryMediaStorage();
  const key = await storage.save(
    (async function* () {
      yield Buffer.from("audio");
    })(),
  );
  const bytes = await storage.get(key);
  const chunks = [];
  for await (const chunk of bytes) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe("audio");
  await storage.delete(key);
  await expect(storage.get(key)).rejects.toThrow(/Missing media file/);
});

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "backend fixture migrates and isolates real Fastify API tests",
  async () => {
    const { app, db } = await createBackendTest();
    const response = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { title: "Fixture", genre: "Drama", description: "Test" },
    });
    expect(response.statusCode).toBe(201);
    expect(
      (await app.inject({ url: `/projects/${response.json().id}` })).statusCode,
    ).toBe(200);
    expect(await db.select().from(projects)).toHaveLength(1);
  },
);

test.skipIf(!process.env.TEST_DATABASE_URL)(
  "a subsequent backend fixture starts with no domain rows",
  async () => {
    const { app, db } = await createBackendTest();
    expect(await db.select().from(projects)).toEqual([]);
    expect((await app.inject({ url: "/projects" })).json()).toEqual([]);
  },
);
