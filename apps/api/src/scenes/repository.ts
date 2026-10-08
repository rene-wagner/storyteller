import { asc, desc, DrizzleQueryError, eq } from "drizzle-orm";
import type {
  CreateSceneRequest,
  UpdateSceneRequest,
} from "@storyteller/shared";
import type { createDatabase } from "../db/connection.ts";
import { episodes, scenes } from "../db/schema.ts";

type Database = ReturnType<typeof createDatabase>["db"];
export type SceneRow = typeof scenes.$inferSelect;

export class ScenePositionConflictError extends Error {}
export class SceneBackgroundMusicError extends Error {}

function isInvalidBackgroundMusic(error: unknown): boolean {
  if (!(error instanceof DrizzleQueryError)) return false;
  const cause = error.cause;
  return (
    cause instanceof Error &&
    "code" in cause &&
    cause.code === "23503" &&
    "constraint" in cause &&
    // PostgreSQL truncates identifiers to 63 bytes, including this generated FK name.
    cause.constraint ===
      "scenes_background_music_id_background_music_type_media_items_id_type_fk".slice(
        0,
        63,
      )
  );
}

export function createSceneRepository(db: Database) {
  return {
    list(episodeId: string): Promise<SceneRow[]> {
      return db
        .select()
        .from(scenes)
        .where(eq(scenes.episodeId, episodeId))
        .orderBy(asc(scenes.position), asc(scenes.id));
    },
    async create(
      episodeId: string,
      input: CreateSceneRequest,
    ): Promise<SceneRow | undefined> {
      try {
        return await db.transaction(async (tx) => {
          // Serialize appends per episode and prevent its deletion during the insert.
          const [episode] = await tx
            .select({ id: episodes.id })
            .from(episodes)
            .where(eq(episodes.id, episodeId))
            .for("update");
          if (!episode) return undefined;
          const [last] = await tx
            .select({ position: scenes.position })
            .from(scenes)
            .where(eq(scenes.episodeId, episodeId))
            .orderBy(desc(scenes.position), desc(scenes.id))
            .limit(1);
          const position = last ? last.position + 1 : 0;
          if (position > 2147483647) throw new ScenePositionConflictError();
          const [scene] = await tx
            .insert(scenes)
            .values({ ...input, episodeId, position })
            .returning();
          return scene;
        });
      } catch (error: unknown) {
        if (isInvalidBackgroundMusic(error))
          throw new SceneBackgroundMusicError();
        throw error;
      }
    },
    async reorder(
      episodeId: string,
      sceneIds: string[],
    ): Promise<"ok" | "not_found" | "invalid"> {
      return db.transaction(async (tx) => {
        // Serialize with appends and other reorders; lock existing rows against deletion.
        const [episode] = await tx
          .select({ id: episodes.id })
          .from(episodes)
          .where(eq(episodes.id, episodeId))
          .for("update");
        if (!episode) return "not_found";
        const members = await tx
          .select({ id: scenes.id })
          .from(scenes)
          .where(eq(scenes.episodeId, episodeId))
          .for("update");
        const memberIds = new Set(members.map((scene) => scene.id));
        if (
          sceneIds.length !== members.length ||
          new Set(sceneIds).size !== members.length ||
          sceneIds.some((id) => !memberIds.has(id))
        )
          return "invalid";
        for (const [position, id] of sceneIds.entries()) {
          await tx
            .update(scenes)
            .set({ position, updatedAt: new Date() })
            .where(eq(scenes.id, id));
        }
        return "ok";
      });
    },
    async find(id: string): Promise<SceneRow | undefined> {
      const [scene] = await db.select().from(scenes).where(eq(scenes.id, id));
      return scene;
    },
    async update(
      id: string,
      input: UpdateSceneRequest,
    ): Promise<SceneRow | undefined> {
      try {
        const [scene] = await db
          .update(scenes)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(scenes.id, id))
          .returning();
        return scene;
      } catch (error: unknown) {
        if (isInvalidBackgroundMusic(error))
          throw new SceneBackgroundMusicError();
        throw error;
      }
    },
    async delete(id: string): Promise<boolean> {
      const removed = await db
        .delete(scenes)
        .where(eq(scenes.id, id))
        .returning({ id: scenes.id });
      return removed.length > 0;
    },
  };
}

export type SceneRepository = ReturnType<typeof createSceneRepository>;
