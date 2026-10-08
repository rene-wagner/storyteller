import type {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest,
} from "@storyteller/shared";
import type { ProjectRepository, ProjectRow } from "./repository.ts";

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createProjectService(repository: ProjectRepository) {
  return {
    async create(input: CreateProjectRequest): Promise<Project> {
      return toProject(await repository.create(input));
    },
    async list(): Promise<Project[]> {
      return (await repository.list()).map(toProject);
    },
    async find(id: string): Promise<Project | undefined> {
      const row = await repository.find(id);
      return row && toProject(row);
    },
    async update(
      id: string,
      input: UpdateProjectRequest,
    ): Promise<Project | undefined> {
      const row = await repository.update(id, input);
      return row && toProject(row);
    },
    delete(id: string): Promise<boolean> {
      return repository.delete(id);
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
