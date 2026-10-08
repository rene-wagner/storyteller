import { and, asc, desc, DrizzleQueryError, eq, inArray } from "drizzle-orm";
import type {
  CreateCuePointRequest,
  UpdateCuePointRequest,
} from "@storyteller/shared";
import type { createDatabase } from "../db/connection.ts";
import {
  characters,
  cuePoints,
  cuePointSoundEffects,
  episodes,
  mediaItems,
  scenes,
} from "../db/schema.ts";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type CuePointRow = typeof cuePoints.$inferSelect & {
  soundEffectIds: string[];
};
export class CuePointPositionConflictError extends Error {}

// PostgreSQL truncates generated constraint names to 63 bytes.
const soundEffectForeignKey =
  "cue_point_sound_effects_media_item_id_media_type_media_items_id_type_fk".slice(
    0,
    63,
  );
function isInvalidSoundEffect(error: unknown): boolean {
  if (!(error instanceof DrizzleQueryError)) return false;
  const cause = error.cause;
  return (
    cause instanceof Error &&
    "code" in cause &&
    cause.code === "23503" &&
    "constraint" in cause &&
    cause.constraint === soundEffectForeignKey
  );
}

async function withEffects(
  db: Database | Transaction,
  rows: (typeof cuePoints.$inferSelect)[],
): Promise<CuePointRow[]> {
  if (!rows.length) return [];
  const links = await db
    .select({
      cuePointId: cuePointSoundEffects.cuePointId,
      mediaItemId: cuePointSoundEffects.mediaItemId,
    })
    .from(cuePointSoundEffects)
    .where(
      inArray(
        cuePointSoundEffects.cuePointId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(cuePointSoundEffects.mediaItemId));
  const byPoint = new Map<string, string[]>();
  for (const link of links) {
    const ids = byPoint.get(link.cuePointId) ?? [];
    ids.push(link.mediaItemId);
    byPoint.set(link.cuePointId, ids);
  }
  return rows.map((row) => ({
    ...row,
    soundEffectIds: byPoint.get(row.id) ?? [],
  }));
}

async function validEffects(tx: Transaction, ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  // Keep referenced media from being removed or changing type until the links commit.
  const effects = await tx
    .select({ id: mediaItems.id })
    .from(mediaItems)
    .where(
      and(inArray(mediaItems.id, ids), eq(mediaItems.type, "sound_effect")),
    )
    .orderBy(asc(mediaItems.id))
    .for("key share");
  return effects.length === ids.length;
}

async function assignEffects(
  tx: Transaction,
  pointId: string,
  ids: string[],
): Promise<void> {
  await tx
    .delete(cuePointSoundEffects)
    .where(eq(cuePointSoundEffects.cuePointId, pointId));
  if (ids.length)
    await tx
      .insert(cuePointSoundEffects)
      .values(ids.map((mediaItemId) => ({ cuePointId: pointId, mediaItemId })));
}

async function sceneProject(
  tx: Transaction,
  sceneId: string,
): Promise<string | undefined> {
  // The scene lock serializes appends and protects the parent while validating the reference.
  const [scene] = await tx
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .for("update");
  if (!scene) return undefined;
  const [episode] = await tx
    .select({ projectId: episodes.projectId })
    .from(episodes)
    .innerJoin(scenes, eq(scenes.episodeId, episodes.id))
    .where(eq(scenes.id, sceneId));
  return episode?.projectId;
}

async function belongsToProject(
  tx: Transaction,
  characterId: string,
  projectId: string,
): Promise<boolean> {
  // Hold a key-share lock until the write commits so a concurrent delete cannot invalidate it.
  const [character] = await tx
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(eq(characters.id, characterId), eq(characters.projectId, projectId)),
    )
    .for("key share");
  return !!character;
}

export function createCuePointRepository(db: Database) {
  return {
    async list(sceneId: string): Promise<CuePointRow[]> {
      const rows = await db
        .select()
        .from(cuePoints)
        .where(eq(cuePoints.sceneId, sceneId))
        .orderBy(asc(cuePoints.position), asc(cuePoints.id));
      return withEffects(db, rows);
    },
    async create(
      sceneId: string,
      input: CreateCuePointRequest,
    ): Promise<CuePointRow | "invalid" | undefined> {
      try {
        return await db.transaction(async (tx) => {
          const projectId = await sceneProject(tx, sceneId);
          if (!projectId) return undefined;
          if (
            !(await belongsToProject(tx, input.characterId, projectId)) ||
            !(await validEffects(tx, input.soundEffectIds ?? []))
          )
            return "invalid";
          const [last] = await tx
            .select({ position: cuePoints.position })
            .from(cuePoints)
            .where(eq(cuePoints.sceneId, sceneId))
            .orderBy(desc(cuePoints.position), desc(cuePoints.id))
            .limit(1);
          const position = last ? last.position + 1 : 0;
          if (position > 2147483647) throw new CuePointPositionConflictError();
          const [point] = await tx
            .insert(cuePoints)
            .values({
              characterId: input.characterId,
              spokenText: input.spokenText,
              sceneId,
              position,
            })
            .returning();
          const ids = input.soundEffectIds ?? [];
          if (ids.length) await assignEffects(tx, point.id, ids);
          return { ...point, soundEffectIds: [...ids].sort() };
        });
      } catch (error: unknown) {
        if (isInvalidSoundEffect(error)) return "invalid";
        throw error;
      }
    },
    async reorder(
      sceneId: string,
      cuePointIds: string[],
    ): Promise<"ok" | "not_found" | "invalid"> {
      return db.transaction(async (tx) => {
        // Serialize with appends and other reorders; lock existing rows against deletion.
        const [scene] = await tx
          .select({ id: scenes.id })
          .from(scenes)
          .where(eq(scenes.id, sceneId))
          .for("update");
        if (!scene) return "not_found";
        const members = await tx
          .select({ id: cuePoints.id })
          .from(cuePoints)
          .where(eq(cuePoints.sceneId, sceneId))
          .for("update");
        const memberIds = new Set(members.map((point) => point.id));
        if (
          cuePointIds.length !== members.length ||
          new Set(cuePointIds).size !== members.length ||
          cuePointIds.some((id) => !memberIds.has(id))
        )
          return "invalid";
        for (const [position, id] of cuePointIds.entries()) {
          await tx
            .update(cuePoints)
            .set({ position, updatedAt: new Date() })
            .where(eq(cuePoints.id, id));
        }
        return "ok";
      });
    },
    async find(id: string): Promise<CuePointRow | undefined> {
      const [point] = await db
        .select()
        .from(cuePoints)
        .where(eq(cuePoints.id, id));
      return point && (await withEffects(db, [point]))[0];
    },
    async update(
      id: string,
      input: UpdateCuePointRequest,
    ): Promise<CuePointRow | "invalid" | undefined> {
      try {
        return await db.transaction(async (tx) => {
          const [existing] = await tx
            .select({ sceneId: cuePoints.sceneId })
            .from(cuePoints)
            .where(eq(cuePoints.id, id));
          if (!existing) return undefined;
          const projectId = await sceneProject(tx, existing.sceneId);
          if (!projectId) return undefined;
          // Serialize replacement with concurrent patches on this cue point.
          const [locked] = await tx
            .select({ id: cuePoints.id })
            .from(cuePoints)
            .where(eq(cuePoints.id, id))
            .for("update");
          if (!locked) return undefined;
          if (
            input.characterId &&
            !(await belongsToProject(tx, input.characterId, projectId))
          )
            return "invalid";
          if (
            input.soundEffectIds !== undefined &&
            !(await validEffects(tx, input.soundEffectIds))
          )
            return "invalid";
          const [point] = await tx
            .update(cuePoints)
            .set({
              characterId: input.characterId,
              spokenText: input.spokenText,
              updatedAt: new Date(),
            })
            .where(eq(cuePoints.id, id))
            .returning();
          if (input.soundEffectIds !== undefined)
            await assignEffects(tx, id, input.soundEffectIds);
          return (await withEffects(tx, [point]))[0];
        });
      } catch (error: unknown) {
        if (isInvalidSoundEffect(error)) return "invalid";
        throw error;
      }
    },
    async delete(id: string): Promise<boolean> {
      const removed = await db
        .delete(cuePoints)
        .where(eq(cuePoints.id, id))
        .returning({ id: cuePoints.id });
      return removed.length > 0;
    },
  };
}

export type CuePointRepository = ReturnType<typeof createCuePointRepository>;
