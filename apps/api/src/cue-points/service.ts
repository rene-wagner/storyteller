import type {
  CreateCuePointRequest,
  CuePoint,
  UpdateCuePointRequest,
} from "@storyteller/shared";
import type { SceneRepository } from "../scenes/repository.ts";
import type { CuePointRepository, CuePointRow } from "./repository.ts";

function toCuePoint(row: CuePointRow): CuePoint {
  return {
    id: row.id,
    sceneId: row.sceneId,
    characterId: row.characterId,
    spokenText: row.spokenText,
    soundEffectIds: row.soundEffectIds,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createCuePointService(
  repository: CuePointRepository,
  scenes: Pick<SceneRepository, "find">,
) {
  return {
    async list(sceneId: string): Promise<CuePoint[] | undefined> {
      if (!(await scenes.find(sceneId))) return undefined;
      return (await repository.list(sceneId)).map(toCuePoint);
    },
    async create(
      sceneId: string,
      input: CreateCuePointRequest,
    ): Promise<CuePoint | "invalid" | undefined> {
      const row = await repository.create(sceneId, input);
      return row && (row === "invalid" ? row : toCuePoint(row));
    },
    reorder(
      sceneId: string,
      cuePointIds: string[],
    ): Promise<"ok" | "not_found" | "invalid"> {
      return repository.reorder(sceneId, cuePointIds);
    },
    async find(id: string): Promise<CuePoint | undefined> {
      const row = await repository.find(id);
      return row && toCuePoint(row);
    },
    async update(
      id: string,
      input: UpdateCuePointRequest,
    ): Promise<CuePoint | "invalid" | undefined> {
      const row = await repository.update(id, input);
      return row && (row === "invalid" ? row : toCuePoint(row));
    },
    delete(id: string): Promise<boolean> {
      return repository.delete(id);
    },
  };
}

export type CuePointService = ReturnType<typeof createCuePointService>;
