import type {
  CreateSceneRequest,
  Scene,
  UpdateSceneRequest,
} from "@storyteller/shared";
import type { EpisodeRepository } from "../episodes/repository.ts";
import type { SceneRepository, SceneRow } from "./repository.ts";

function toScene(row: SceneRow): Scene {
  return {
    id: row.id,
    episodeId: row.episodeId,
    title: row.title,
    backgroundMusicId: row.backgroundMusicId,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createSceneService(
  repository: SceneRepository,
  episodes: Pick<EpisodeRepository, "find">,
) {
  return {
    async list(episodeId: string): Promise<Scene[] | undefined> {
      if (!(await episodes.find(episodeId))) return undefined;
      return (await repository.list(episodeId)).map(toScene);
    },
    async create(
      episodeId: string,
      input: CreateSceneRequest,
    ): Promise<Scene | undefined> {
      const row = await repository.create(episodeId, input);
      return row && toScene(row);
    },
    reorder(
      episodeId: string,
      sceneIds: string[],
    ): Promise<"ok" | "not_found" | "invalid"> {
      return repository.reorder(episodeId, sceneIds);
    },
    async find(id: string): Promise<Scene | undefined> {
      const row = await repository.find(id);
      return row && toScene(row);
    },
    async update(
      id: string,
      input: UpdateSceneRequest,
    ): Promise<Scene | undefined> {
      const row = await repository.update(id, input);
      return row && toScene(row);
    },
    delete(id: string): Promise<boolean> {
      return repository.delete(id);
    },
  };
}

export type SceneService = ReturnType<typeof createSceneService>;
