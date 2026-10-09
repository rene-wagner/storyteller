import { asc, DrizzleQueryError, eq } from "drizzle-orm";
import type { MediaType, UpdateMediaRequest } from "@storyteller/shared";
import type { createDatabase } from "../db/connection.ts";
import {
  cuePoints,
  cuePointSoundEffects,
  episodes,
  mediaItems,
  projects,
  scenes,
} from "../db/schema.ts";

type Database = ReturnType<typeof createDatabase>["db"];
export type MediaRow = typeof mediaItems.$inferSelect;
export type MediaUsage = {
  sceneIds: string[];
  cuePointIds: string[];
  scenes: {
    id: string;
    projectTitle: string;
    episodeTitle: string;
    sceneTitle: string;
  }[];
  cuePoints: {
    id: string;
    projectTitle: string;
    episodeTitle: string;
    sceneTitle: string;
    position: number;
  }[];
};

function isReferenceConflict(error: unknown): boolean {
  return (
    error instanceof DrizzleQueryError &&
    error.cause instanceof Error &&
    "code" in error.cause &&
    error.cause.code === "23503"
  );
}

export function createMediaRepository(db: Database) {
  async function usage(
    id: string,
    executor: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
  ): Promise<MediaUsage> {
    const [sceneRows, pointRows] = await Promise.all([
      executor
        .select({
          id: scenes.id,
          projectTitle: projects.title,
          episodeTitle: episodes.title,
          sceneTitle: scenes.title,
        })
        .from(scenes)
        .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
        .innerJoin(projects, eq(episodes.projectId, projects.id))
        .where(eq(scenes.backgroundMusicId, id))
        .orderBy(asc(scenes.id)),
      executor
        .select({
          id: cuePoints.id,
          projectTitle: projects.title,
          episodeTitle: episodes.title,
          sceneTitle: scenes.title,
          position: cuePoints.position,
        })
        .from(cuePointSoundEffects)
        .innerJoin(cuePoints, eq(cuePointSoundEffects.cuePointId, cuePoints.id))
        .innerJoin(scenes, eq(cuePoints.sceneId, scenes.id))
        .innerJoin(episodes, eq(scenes.episodeId, episodes.id))
        .innerJoin(projects, eq(episodes.projectId, projects.id))
        .where(eq(cuePointSoundEffects.mediaItemId, id))
        .orderBy(asc(cuePoints.id)),
    ]);
    return {
      sceneIds: sceneRows.map((row) => row.id),
      cuePointIds: pointRows.map((row) => row.id),
      scenes: sceneRows,
      cuePoints: pointRows,
    };
  }
  return {
    list(type?: MediaType): Promise<MediaRow[]> {
      return db
        .select()
        .from(mediaItems)
        .where(type ? eq(mediaItems.type, type) : undefined)
        .orderBy(asc(mediaItems.createdAt), asc(mediaItems.id));
    },
    async find(id: string): Promise<MediaRow | undefined> {
      const [item] = await db
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.id, id));
      return item;
    },
    async create(input: {
      name: string;
      type: MediaType;
      fileName: string;
      mimeType: string;
      fileSize: bigint;
      storageKey: string;
    }): Promise<MediaRow> {
      const [item] = await db.insert(mediaItems).values(input).returning();
      return item;
    },
    async update(
      id: string,
      input: UpdateMediaRequest,
    ): Promise<MediaRow | undefined> {
      const [item] = await db
        .update(mediaItems)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(mediaItems.id, id))
        .returning();
      return item;
    },
    async delete(
      id: string,
    ): Promise<
      | { kind: "deleted"; storageKey: string }
      | { kind: "in_use"; usage: MediaUsage }
      | { kind: "not_found" }
    > {
      try {
        return await db.transaction(async (tx) => {
          // This lock serializes deletion with FK inserts (key-share locks) and other deletions.
          const [item] = await tx
            .select({ storageKey: mediaItems.storageKey })
            .from(mediaItems)
            .where(eq(mediaItems.id, id))
            .for("update");
          if (!item) return { kind: "not_found" } as const;
          const references = await usage(id, tx);
          if (references.sceneIds.length || references.cuePointIds.length)
            return { kind: "in_use", usage: references } as const;
          await tx.delete(mediaItems).where(eq(mediaItems.id, id));
          return { kind: "deleted", storageKey: item.storageKey } as const;
        });
      } catch (error: unknown) {
        // The database FK remains the final guard if a writer races the usage lookup.
        if (isReferenceConflict(error))
          return { kind: "in_use", usage: await usage(id, db) };
        throw error;
      }
    },
  };
}

export type MediaRepository = ReturnType<typeof createMediaRepository>;
