import type {
  CreateEpisodeRequest,
  Episode,
  UpdateEpisodeRequest,
} from "@storyteller/shared";
import type { ProjectRepository } from "../projects/repository.ts";
import type { EpisodeRepository, EpisodeRow } from "./repository.ts";

function toEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createEpisodeService(
  repository: EpisodeRepository,
  projects: Pick<ProjectRepository, "find">,
) {
  return {
    async list(projectId: string): Promise<Episode[] | undefined> {
      if (!(await projects.find(projectId))) return undefined;
      return (await repository.list(projectId)).map(toEpisode);
    },
    async create(
      projectId: string,
      input: CreateEpisodeRequest,
    ): Promise<Episode | undefined> {
      const row = await repository.create(projectId, input);
      return row && toEpisode(row);
    },
    reorder(
      projectId: string,
      episodeIds: string[],
    ): Promise<"ok" | "not_found" | "invalid"> {
      return repository.reorder(projectId, episodeIds);
    },
    async find(id: string): Promise<Episode | undefined> {
      const row = await repository.find(id);
      return row && toEpisode(row);
    },
    async update(
      id: string,
      input: UpdateEpisodeRequest,
    ): Promise<Episode | undefined> {
      const row = await repository.update(id, input);
      return row && toEpisode(row);
    },
    delete(id: string): Promise<boolean> {
      return repository.delete(id);
    },
  };
}

export type EpisodeService = ReturnType<typeof createEpisodeService>;
