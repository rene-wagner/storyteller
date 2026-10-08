import { asc, eq, DrizzleQueryError } from "drizzle-orm";
import type {
  CreateCharacterRequest,
  UpdateCharacterRequest,
} from "@storyteller/shared";
import type { createDatabase } from "../db/connection.ts";
import { characters } from "../db/schema.ts";

type Database = ReturnType<typeof createDatabase>["db"];
export type CharacterRow = typeof characters.$inferSelect;

export class CharacterDeletionConflictError extends Error {}

function isReferencedCharacterError(error: unknown): boolean {
  if (!(error instanceof DrizzleQueryError)) return false;
  const cause = error.cause;
  return (
    cause instanceof Error &&
    "code" in cause &&
    cause.code === "23503" &&
    "constraint" in cause &&
    cause.constraint === "cue_points_character_id_characters_id_fk"
  );
}

export function createCharacterRepository(db: Database) {
  return {
    list(projectId: string): Promise<CharacterRow[]> {
      return db
        .select()
        .from(characters)
        .where(eq(characters.projectId, projectId))
        .orderBy(asc(characters.name), asc(characters.id));
    },
    async create(
      projectId: string,
      input: CreateCharacterRequest,
    ): Promise<CharacterRow> {
      const [character] = await db
        .insert(characters)
        .values({ ...input, projectId })
        .returning();
      return character;
    },
    async update(
      id: string,
      input: UpdateCharacterRequest,
    ): Promise<CharacterRow | undefined> {
      const [character] = await db
        .update(characters)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(characters.id, id))
        .returning();
      return character;
    },
    async delete(id: string): Promise<boolean> {
      try {
        const removed = await db
          .delete(characters)
          .where(eq(characters.id, id))
          .returning({ id: characters.id });
        return removed.length > 0;
      } catch (error: unknown) {
        if (isReferencedCharacterError(error)) {
          throw new CharacterDeletionConflictError();
        }
        throw error;
      }
    },
  };
}

export type CharacterRepository = ReturnType<typeof createCharacterRepository>;
