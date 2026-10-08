import { asc, desc, eq } from "drizzle-orm";
import type {
  CreateEpisodeRequest,
  UpdateEpisodeRequest,
} from "@storyteller/shared";
import type { createDatabase } from "../db/connection.ts";
import { episodes, projects } from "../db/schema.ts";

type Database = ReturnType<typeof createDatabase>["db"];
export type EpisodeRow = typeof episodes.$inferSelect;

export class EpisodePositionConflictError extends Error {}

export function createEpisodeRepository(db: Database) {
  return {
    list(projectId: string): Promise<EpisodeRow[]> {
      return db
        .select()
        .from(episodes)
        .where(eq(episodes.projectId, projectId))
        .orderBy(asc(episodes.position), asc(episodes.id));
    },
    async create(
      projectId: string,
      input: CreateEpisodeRequest,
    ): Promise<EpisodeRow | undefined> {
      return db.transaction(async (tx) => {
        // Serialize appends per project and prevent its deletion during the insert.
        const [project] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, projectId))
          .for("update");
        if (!project) return undefined;
        const [last] = await tx
          .select({ position: episodes.position })
          .from(episodes)
          .where(eq(episodes.projectId, projectId))
          .orderBy(desc(episodes.position), desc(episodes.id))
          .limit(1);
        const position = last ? last.position + 1 : 0;
        if (position > 2147483647) throw new EpisodePositionConflictError();
        const [episode] = await tx
          .insert(episodes)
          .values({ ...input, projectId, position })
          .returning();
        return episode;
      });
    },
    async reorder(
      projectId: string,
      episodeIds: string[],
    ): Promise<"ok" | "not_found" | "invalid"> {
      return db.transaction(async (tx) => {
        // Serialize with appends and other reorders; lock existing rows against deletion.
        const [project] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, projectId))
          .for("update");
        if (!project) return "not_found";
        const members = await tx
          .select({ id: episodes.id })
          .from(episodes)
          .where(eq(episodes.projectId, projectId))
          .for("update");
        const memberIds = new Set(members.map((episode) => episode.id));
        if (
          episodeIds.length !== members.length ||
          new Set(episodeIds).size !== members.length ||
          episodeIds.some((id) => !memberIds.has(id))
        )
          return "invalid";
        for (const [position, id] of episodeIds.entries()) {
          await tx
            .update(episodes)
            .set({ position, updatedAt: new Date() })
            .where(eq(episodes.id, id));
        }
        return "ok";
      });
    },
    async find(id: string): Promise<EpisodeRow | undefined> {
      const [episode] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, id));
      return episode;
    },
    async update(
      id: string,
      input: UpdateEpisodeRequest,
    ): Promise<EpisodeRow | undefined> {
      const [episode] = await db
        .update(episodes)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(episodes.id, id))
        .returning();
      return episode;
    },
    async delete(id: string): Promise<boolean> {
      const removed = await db
        .delete(episodes)
        .where(eq(episodes.id, id))
        .returning({ id: episodes.id });
      return removed.length > 0;
    },
  };
}

export type EpisodeRepository = ReturnType<typeof createEpisodeRepository>;
