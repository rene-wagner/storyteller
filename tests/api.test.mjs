import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, onTestFinished, test } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { ConfigurationError, parseConfig } from "../apps/api/src/config.ts";

const apiRoot = fileURLToPath(new URL("../apps/api/", import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));
const apiPackage = JSON.parse(
  readFileSync(new URL("../apps/api/package.json", import.meta.url), "utf8"),
);
const databaseUrl = "postgresql://localhost:5432/storyteller";
const missingEnvNotice = ".env not found. Continuing without it.\n";

beforeAll(() => {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "-p",
      "apps/api/tsconfig.json",
      "--noEmit",
      "false",
    ],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 30_000);

test("health returns HTTP 200 and the expected JSON without starting a listener", async () => {
  const app = createApp();
  onTestFinished(() => app.close());
  const response = await app.inject({ method: "GET", url: "/health" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toStrictEqual({ status: "ok" });
  expect(response.headers["content-type"]).toMatch(/application\/json/);
});

test("configuration requires a database URL and supplies small local defaults", () => {
  expect(parseConfig({ DATABASE_URL: databaseUrl })).toStrictEqual({
    PORT: 3000,
    DATABASE_URL: databaseUrl,
    MEDIA_STORAGE_DIRECTORY: "./media",
  });
  expect(() => parseConfig({})).toThrow(ConfigurationError);
  expect(() => parseConfig({})).toThrow(/DATABASE_URL/);
});

test.each([
  "postgres://localhost/storyteller",
  "postgresql://user:placeholder@localhost:5432/storyteller?sslmode=disable",
])("configuration accepts PostgreSQL URL %s and explicit values", (url) => {
  expect(
    parseConfig({
      PORT: "65535",
      DATABASE_URL: url,
      MEDIA_STORAGE_DIRECTORY: " /tmp/storyteller-media ",
    }),
  ).toStrictEqual({
    PORT: 65535,
    DATABASE_URL: url,
    MEDIA_STORAGE_DIRECTORY: "/tmp/storyteller-media",
  });
  expect(parseConfig({ PORT: "1", DATABASE_URL: url }).PORT).toBe(1);
});

for (const [field, values] of Object.entries({
  PORT: ["", " ", "0", "-1", "65536", "1.5", "NaN", "3000x", "1e3", "0x10"],
  DATABASE_URL: [
    "",
    "not-a-url",
    "https://user:private-password@localhost/storyteller",
    "postgresql:///storyteller",
    "postgresql://localhost",
    "postgresql://localhost/",
    "postgresql://localhost:0/storyteller",
    "postgresql://localhost:65536/storyteller",
    "postgresql://local host/storyteller",
  ],
  MEDIA_STORAGE_DIRECTORY: [
    "",
    "  ",
    "private-directory\0",
    "\nprivate-directory",
    "private-directory\r",
  ],
})) {
  test.each(values)(
    `configuration rejects invalid ${field}: %j without echoing values`,
    (value) => {
      const environment = { DATABASE_URL: databaseUrl, [field]: value };
      expect(() => parseConfig(environment)).toThrow(ConfigurationError);
      try {
        parseConfig(environment);
        expect.unreachable("Invalid configuration was accepted");
      } catch (error) {
        expect(error.message).toContain(`${field}:`);
        expect(error.message).not.toMatch(
          /private-password|private-directory|https:\/\//,
        );
      }
    },
  );
}

test("configuration reports every invalid field, discards unrelated environment values", () => {
  expect(() =>
    parseConfig({
      PORT: "bad",
      DATABASE_URL: "secret",
      MEDIA_STORAGE_DIRECTORY: " ",
    }),
  ).toThrow(/PORT:[\s\S]*DATABASE_URL:[\s\S]*MEDIA_STORAGE_DIRECTORY:/);
  expect(
    parseConfig({ DATABASE_URL: databaseUrl, EXTRA_SECRET: "secret" }),
  ).not.toHaveProperty("EXTRA_SECRET");
});

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function launch(script, environment) {
  // Execute the actual package script with Node directly, so signals reach the
  // server (not a PNPM/shell wrapper). No platform-specific shell is required.
  const [command, ...args] = apiPackage.scripts[script].split(" ");
  expect(command).toBe("node");
  const child = spawn(process.execPath, args, {
    cwd: apiRoot,
    env: {
      ...process.env,
      PORT: "3000",
      DATABASE_URL: databaseUrl,
      MEDIA_STORAGE_DIRECTORY: "./media",
      ...environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => {
    output.stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output.stderr += chunk;
  });
  const exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  onTestFinished(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 3000);
    try {
      await exited;
    } finally {
      clearTimeout(timeout);
    }
  });
  return { child, output, exited };
}

for (const [script, signal] of [
  ["start", "SIGINT"],
  ["start", "SIGTERM"],
  ["dev", "SIGINT"],
  ["dev", "SIGTERM"],
]) {
  test(`${script} script serves health locally and closes cleanly on ${signal}`, async () => {
    const port = await unusedPort();
    const { child, output, exited } = launch(script, { PORT: String(port) });
    await expect
      .poll(() => output.stdout, { timeout: 10_000 })
      .toContain(`API listening at http://127.0.0.1:${port}`);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ status: "ok" });
    child.kill(signal);
    expect(await exited).toStrictEqual({ code: 0, signal: null });
    expect(output.stdout).toContain("API shut down.");
    expect(["", missingEnvNotice]).toContain(output.stderr);
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });
}

test.each([
  [{ PORT: "bad" }, "PORT"],
  [{ DATABASE_URL: "" }, "DATABASE_URL"],
  [{ DATABASE_URL: undefined }, "DATABASE_URL"],
  [
    { DATABASE_URL: "https://user:private-password@localhost/storyteller" },
    "DATABASE_URL",
  ],
  [
    { MEDIA_STORAGE_DIRECTORY: "\nprivate-directory" },
    "MEDIA_STORAGE_DIRECTORY",
  ],
])("invalid environment refuses startup (%j)", async (environment, field) => {
  const port = await unusedPort();
  const { output, exited } = launch("start", {
    PORT: String(port),
    ...environment,
  });
  expect(await exited).toStrictEqual({ code: 1, signal: null });
  expect(output.stdout).toBe("");
  expect(output.stderr).toContain("Invalid API configuration:");
  expect(output.stderr).toContain(`${field}:`);
  expect(output.stderr).not.toMatch(
    /private-password|private-directory|https:\/\/|\bat .*\.js:/,
  );
  await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
});

test("occupied port refuses startup without exposing configuration or stack traces", async () => {
  const port = await unusedPort();
  const first = launch("start", { PORT: String(port) });
  await expect
    .poll(() => first.output.stdout, { timeout: 10_000 })
    .toContain("API listening");
  const second = launch("start", {
    PORT: String(port),
    DATABASE_URL: "postgresql://user:private-password@localhost/storyteller",
  });
  expect(await second.exited).toStrictEqual({ code: 1, signal: null });
  expect([
    "API startup failed.\n",
    `${missingEnvNotice}API startup failed.\n`,
  ]).toContain(second.output.stderr);
  expect(second.output.stdout).toBe("");
});
