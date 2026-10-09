import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { onTestFinished } from "vitest";
import { migrate } from "../../apps/api/node_modules/drizzle-orm/node-postgres/migrator.js";
import { createApp } from "../../apps/api/src/app.ts";
import { createCharacterRepository } from "../../apps/api/src/characters/repository.ts";
import { createCharacterService } from "../../apps/api/src/characters/service.ts";
import { createCuePointRepository } from "../../apps/api/src/cue-points/repository.ts";
import { createCuePointService } from "../../apps/api/src/cue-points/service.ts";
import { createDatabase } from "../../apps/api/src/db/connection.ts";
import { createEpisodeRepository } from "../../apps/api/src/episodes/repository.ts";
import { createEpisodeService } from "../../apps/api/src/episodes/service.ts";
import { createMediaRepository } from "../../apps/api/src/media/repository.ts";
import { createMediaService } from "../../apps/api/src/media/service.ts";
import { createProjectRepository } from "../../apps/api/src/projects/repository.ts";
import { createProjectService } from "../../apps/api/src/projects/service.ts";
import { createSceneRepository } from "../../apps/api/src/scenes/repository.ts";
import { createSceneService } from "../../apps/api/src/scenes/service.ts";

const migrationsFolder = fileURLToPath(
  new URL("../../apps/api/drizzle/", import.meta.url),
);
// This lock is held across migrations, test requests, and cleanup, including across Vitest workers.
const testDatabaseLock = [1937012084, 64];
const resetTables = `TRUNCATE TABLE ${[
  "cue_point_sound_effects",
  "cue_points",
  "scenes",
  "episodes",
  "characters",
  "projects",
  "media_items",
]
  .map((table) => `"${table}"`)
  .join(", ")}`;

export function testDatabaseUrl(environment = process.env) {
  const value = environment.TEST_DATABASE_URL;
  if (!value)
    throw new Error("TEST_DATABASE_URL is required for database tests.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "TEST_DATABASE_URL must be a PostgreSQL URL for a dedicated *_test database.",
    );
  }
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !/^[a-zA-Z0-9_]+_test$/.test(databaseName)
  ) {
    throw new Error(
      "TEST_DATABASE_URL must point to a dedicated *_test database.",
    );
  }
  if (environment.DATABASE_URL) {
    const applicationUrl = new URL(environment.DATABASE_URL);
    const localHosts = ["localhost", "127.0.0.1", "[::1]"];
    const sameHost =
      applicationUrl.hostname === url.hostname ||
      (localHosts.includes(applicationUrl.hostname) &&
        localHosts.includes(url.hostname));
    if (
      sameHost &&
      (applicationUrl.port || "5432") === (url.port || "5432") &&
      decodeURIComponent(applicationUrl.pathname) ===
        decodeURIComponent(url.pathname)
    ) {
      throw new Error(
        "TEST_DATABASE_URL must not point to DATABASE_URL's database.",
      );
    }
  }
  return value;
}

export function createTestApp(dependencies = {}) {
  const app = createApp(dependencies);
  onTestFinished(() => app.close());
  return app;
}

export function createMemoryMediaStorage() {
  const files = new Map();
  return {
    files,
    async save(data) {
      const chunks = [];
      for await (const chunk of data) chunks.push(chunk);
      const key = randomUUID();
      files.set(key, Buffer.concat(chunks));
      return key;
    },
    async get(key) {
      const bytes = files.get(key);
      if (!bytes) throw new Error("Missing media file.");
      return (async function* () {
        yield bytes;
      })();
    },
    async delete(key) {
      if (!files.delete(key)) throw new Error("Missing media file.");
    },
  };
}

/** Requires a dedicated migrated test DB; each fixture owns the DB lock until its test finishes. */
export async function createBackendTest() {
  const database = createDatabase({ DATABASE_URL: testDatabaseUrl() });
  let lock;
  let app;
  try {
    lock = await database.db.$client.connect();
    await lock.query("SELECT pg_advisory_lock($1, $2)", testDatabaseLock);
    await migrate(database.db, { migrationsFolder });
    await database.db.$client.query(resetTables);
    const storage = createMemoryMediaStorage();
    const projects = createProjectRepository(database.db);
    const episodes = createEpisodeRepository(database.db);
    const scenes = createSceneRepository(database.db);
    app = createApp({
      projects: createProjectService(projects),
      characters: createCharacterService(
        createCharacterRepository(database.db),
        projects,
      ),
      episodes: createEpisodeService(episodes, projects),
      scenes: createSceneService(scenes, episodes),
      cuePoints: createCuePointService(
        createCuePointRepository(database.db),
        scenes,
      ),
      media: createMediaService(createMediaRepository(database.db), storage),
    });
    onTestFinished(async () => {
      try {
        await app.close();
      } finally {
        try {
          await database.db.$client.query(resetTables);
        } finally {
          lock.release();
          await database.close();
        }
      }
    });
    return { app, db: database.db, storage };
  } catch (error) {
    try {
      if (app) await app.close();
    } finally {
      lock?.release();
      await database.close();
    }
    throw error;
  }
}
