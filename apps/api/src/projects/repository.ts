import { desc, eq, DrizzleQueryError } from "drizzle-orm";
import type { CreateProjectRequest } from "@storyteller/shared";
import type { createDatabase } from "../db/connection.ts";
import { projects } from "../db/schema.ts";

type Database = ReturnType<typeof createDatabase>["db"];
export type ProjectRow = typeof projects.$inferSelect;

export class ProjectDeletionConflictError extends Error {}

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

export function createProjectRepository(db: Database) {
  return {
    async create(input: CreateProjectRequest): Promise<ProjectRow> {
      const [project] = await db.insert(projects).values(input).returning();
      return project;
    },
    list(): Promise<ProjectRow[]> {
      return db
        .select()
        .from(projects)
        .orderBy(desc(projects.updatedAt), desc(projects.id));
    },
    async find(id: string): Promise<ProjectRow | undefined> {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));
      return project;
    },
    async update(
      id: string,
      input: Partial<CreateProjectRequest>,
    ): Promise<ProjectRow | undefined> {
      const [project] = await db
        .update(projects)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      return project;
    },
    async delete(id: string): Promise<boolean> {
      try {
        const removed = await db
          .delete(projects)
          .where(eq(projects.id, id))
          .returning({ id: projects.id });
        return removed.length > 0;
      } catch (error: unknown) {
        if (isReferencedCharacterError(error)) {
          throw new ProjectDeletionConflictError();
        }
        throw error;
      }
    },
  };
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;
