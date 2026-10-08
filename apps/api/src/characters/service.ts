import type {
  Character,
  CreateCharacterRequest,
  UpdateCharacterRequest,
} from "@storyteller/shared";
import type { ProjectRepository } from "../projects/repository.ts";
import type { CharacterRepository, CharacterRow } from "./repository.ts";

function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createCharacterService(
  repository: CharacterRepository,
  projects: Pick<ProjectRepository, "find">,
) {
  return {
    async list(projectId: string): Promise<Character[] | undefined> {
      if (!(await projects.find(projectId))) return undefined;
      return (await repository.list(projectId)).map(toCharacter);
    },
    async create(
      projectId: string,
      input: CreateCharacterRequest,
    ): Promise<Character | undefined> {
      if (!(await projects.find(projectId))) return undefined;
      return toCharacter(await repository.create(projectId, input));
    },
    async update(
      id: string,
      input: UpdateCharacterRequest,
    ): Promise<Character | undefined> {
      const row = await repository.update(id, input);
      return row && toCharacter(row);
    },
    delete(id: string): Promise<boolean> {
      return repository.delete(id);
    },
  };
}

export type CharacterService = ReturnType<typeof createCharacterService>;
