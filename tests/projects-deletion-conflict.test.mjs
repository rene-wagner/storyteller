import { expect, onTestFinished, test } from "vitest";
import { createApp } from "../apps/api/src/app.ts";
import { parseConfig } from "../apps/api/src/config.ts";
import { createDatabase } from "../apps/api/src/db/connection.ts";
import {
  characters,
  cuePoints,
  episodes,
  projects,
  scenes,
} from "../apps/api/src/db/schema.ts";
import { createProjectRepository } from "../apps/api/src/projects/repository.ts";
import { createProjectService } from "../apps/api/src/projects/service.ts";
import { eq } from "../apps/api/node_modules/drizzle-orm/index.js";

test.skipIf(!process.env.DATABASE_URL)(
  "deleting a project with a character referenced by another project's cue point returns 409 without deleting data",
  async () => {
    const database = createDatabase(parseConfig(process.env));
    const app = createApp({
      projects: createProjectService(createProjectRepository(database.db)),
    });
    const projectIds = [];
    onTestFinished(async () => {
      try {
        await app.close();
        // Delete the cue point's project first to release its character reference.
        for (const id of projectIds.reverse()) {
          await database.db.delete(projects).where(eq(projects.id, id));
        }
      } finally {
        await database.close();
      }
    });

    const [characterProject] = await database.db
      .insert(projects)
      .values({ title: "Character owner", genre: "Drama", description: "" })
      .returning();
    projectIds.push(characterProject.id);
    const [sceneProject] = await database.db
      .insert(projects)
      .values({ title: "Scene owner", genre: "Drama", description: "" })
      .returning();
    projectIds.push(sceneProject.id);
    const [character] = await database.db
      .insert(characters)
      .values({
        projectId: characterProject.id,
        name: "Narrator",
        type: "main",
      })
      .returning();
    const [episode] = await database.db
      .insert(episodes)
      .values({
        projectId: sceneProject.id,
        title: "Episode",
        description: "",
        position: 0,
      })
      .returning();
    const [scene] = await database.db
      .insert(scenes)
      .values({ episodeId: episode.id, title: "Scene", position: 0 })
      .returning();
    const [point] = await database.db
      .insert(cuePoints)
      .values({
        sceneId: scene.id,
        characterId: character.id,
        spokenText: "Line",
        position: 0,
      })
      .returning();

    const response = await app.inject({
      method: "DELETE",
      url: `/projects/${characterProject.id}`,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toStrictEqual({
      error: { code: "CONFLICT", message: "Resource conflict.", details: [] },
    });
    for (const id of projectIds) {
      expect(
        (await app.inject({ method: "GET", url: `/projects/${id}` }))
          .statusCode,
      ).toBe(200);
    }
    expect(
      await database.db
        .select()
        .from(characters)
        .where(eq(characters.id, character.id)),
    ).toHaveLength(1);
    expect(
      await database.db
        .select()
        .from(cuePoints)
        .where(eq(cuePoints.id, point.id)),
    ).toHaveLength(1);
  },
);
