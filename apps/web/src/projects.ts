import type {
  Character,
  CreateCharacterRequest,
  CreateCuePointRequest,
  CuePoint,
  CreateEpisodeRequest,
  CreateProjectRequest,
  CreateSceneRequest,
  Episode,
  MediaItem,
  Project,
  ReorderEpisodesRequest,
  ReorderCuePointsRequest,
  ReorderScenesRequest,
  Scene,
  UpdateCharacterRequest,
  UpdateCuePointRequest,
  UpdateEpisodeRequest,
  UpdateProjectRequest,
  UpdateSceneRequest,
} from "@storyteller/shared";
import {
  createCharacterSchema,
  createCuePointSchema,
  createEpisodeSchema,
  createProjectSchema,
  createSceneSchema,
} from "@storyteller/shared";
import { createApiClient, ApiError } from "./api-client";

const apiClient = createApiClient("/api");

export const projectKeys = {
  list: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
  characters: (id: string) => ["projects", id, "characters"] as const,
  episodes: (id: string) => ["projects", id, "episodes"] as const,
  scenes: (id: string) => ["episodes", id, "scenes"] as const,
  backgroundMusic: ["media", "background_music"] as const,
  soundEffects: ["media", "sound_effect"] as const,
  cuePoints: (id: string) => ["scenes", id, "cue-points"] as const,
};

function required<T>(response: T | undefined): T {
  if (response === undefined)
    throw new ApiError(
      200,
      "INVALID_RESPONSE",
      "The server returned an empty response.",
    );
  return response;
}

export const projectsApi = {
  async list(): Promise<Project[]> {
    return required(await apiClient.request<Project[]>("/projects"));
  },
  async get(id: string): Promise<Project> {
    return required(
      await apiClient.request<Project>(`/projects/${encodeURIComponent(id)}`),
    );
  },
  async create(input: CreateProjectRequest): Promise<Project> {
    return required(
      await apiClient.request<Project>("/projects", {
        method: "POST",
        json: input,
      }),
    );
  },
  async update(id: string, input: UpdateProjectRequest): Promise<Project> {
    return required(
      await apiClient.request<Project>(`/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        json: input,
      }),
    );
  },
  async delete(id: string): Promise<void> {
    await apiClient.request<void>(`/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  async characters(id: string): Promise<Character[]> {
    return required(
      await apiClient.request<Character[]>(
        `/projects/${encodeURIComponent(id)}/characters`,
      ),
    );
  },
  async createCharacter(
    projectId: string,
    input: CreateCharacterRequest,
  ): Promise<Character> {
    return required(
      await apiClient.request<Character>(
        `/projects/${encodeURIComponent(projectId)}/characters`,
        { method: "POST", json: input },
      ),
    );
  },
  async updateCharacter(
    id: string,
    input: UpdateCharacterRequest,
  ): Promise<Character> {
    return required(
      await apiClient.request<Character>(
        `/characters/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          json: input,
        },
      ),
    );
  },
  async deleteCharacter(id: string): Promise<void> {
    await apiClient.request<void>(`/characters/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  async episodes(id: string): Promise<Episode[]> {
    return required(
      await apiClient.request<Episode[]>(
        `/projects/${encodeURIComponent(id)}/episodes`,
      ),
    );
  },
  async createEpisode(
    projectId: string,
    input: CreateEpisodeRequest,
  ): Promise<Episode> {
    return required(
      await apiClient.request<Episode>(
        `/projects/${encodeURIComponent(projectId)}/episodes`,
        { method: "POST", json: input },
      ),
    );
  },
  async updateEpisode(
    id: string,
    input: UpdateEpisodeRequest,
  ): Promise<Episode> {
    return required(
      await apiClient.request<Episode>(`/episodes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        json: input,
      }),
    );
  },
  async deleteEpisode(id: string): Promise<void> {
    await apiClient.request<void>(`/episodes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  async reorderEpisodes(
    projectId: string,
    input: ReorderEpisodesRequest,
  ): Promise<void> {
    await apiClient.request<void>(
      `/projects/${encodeURIComponent(projectId)}/episodes/order`,
      { method: "PUT", json: input },
    );
  },
  async scenes(episodeId: string): Promise<Scene[]> {
    return required(
      await apiClient.request<Scene[]>(
        `/episodes/${encodeURIComponent(episodeId)}/scenes`,
      ),
    );
  },
  async backgroundMusic(): Promise<MediaItem[]> {
    return required(
      await apiClient.request<MediaItem[]>("/media?type=background_music"),
    );
  },
  async createScene(
    episodeId: string,
    input: CreateSceneRequest,
  ): Promise<Scene> {
    return required(
      await apiClient.request<Scene>(
        `/episodes/${encodeURIComponent(episodeId)}/scenes`,
        { method: "POST", json: input },
      ),
    );
  },
  async updateScene(id: string, input: UpdateSceneRequest): Promise<Scene> {
    return required(
      await apiClient.request<Scene>(`/scenes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        json: input,
      }),
    );
  },
  async deleteScene(id: string): Promise<void> {
    await apiClient.request<void>(`/scenes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  async reorderScenes(
    episodeId: string,
    input: ReorderScenesRequest,
  ): Promise<void> {
    await apiClient.request<void>(
      `/episodes/${encodeURIComponent(episodeId)}/scenes/order`,
      { method: "PUT", json: input },
    );
  },
  async cuePoints(sceneId: string): Promise<CuePoint[]> {
    return required(
      await apiClient.request<CuePoint[]>(
        `/scenes/${encodeURIComponent(sceneId)}/cue-points`,
      ),
    );
  },
  async soundEffects(): Promise<MediaItem[]> {
    return required(
      await apiClient.request<MediaItem[]>("/media?type=sound_effect"),
    );
  },
  async createCuePoint(
    sceneId: string,
    input: CreateCuePointRequest,
  ): Promise<CuePoint> {
    return required(
      await apiClient.request<CuePoint>(
        `/scenes/${encodeURIComponent(sceneId)}/cue-points`,
        { method: "POST", json: input },
      ),
    );
  },
  async updateCuePoint(
    id: string,
    input: UpdateCuePointRequest,
  ): Promise<CuePoint> {
    return required(
      await apiClient.request<CuePoint>(
        `/cue-points/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          json: input,
        },
      ),
    );
  },
  async deleteCuePoint(id: string): Promise<void> {
    await apiClient.request<void>(`/cue-points/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  async reorderCuePoints(
    sceneId: string,
    input: ReorderCuePointsRequest,
  ): Promise<void> {
    await apiClient.request<void>(
      `/scenes/${encodeURIComponent(sceneId)}/cue-points/order`,
      { method: "PUT", json: input },
    );
  },
};

export type ProjectFields = keyof CreateProjectRequest;
export type ProjectFieldErrors = Partial<Record<ProjectFields, string>>;

export function validateProject(input: CreateProjectRequest): {
  value?: CreateProjectRequest;
  errors: ProjectFieldErrors;
} {
  const value = {
    ...input,
    title: input.title.trim(),
    genre: input.genre.trim(),
  };
  const result = createProjectSchema.safeParse(value);
  if (result.success) return { value: result.data, errors: {} };
  const errors: ProjectFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      (field === "title" || field === "genre" || field === "description") &&
      !errors[field]
    )
      errors[field] = `${field[0].toUpperCase()}${field.slice(1)} is required.`;
  }
  return { errors };
}

export type CharacterFieldErrors = Partial<
  Record<keyof CreateCharacterRequest, string>
>;

export function validateCharacter(input: CreateCharacterRequest): {
  value?: CreateCharacterRequest;
  errors: CharacterFieldErrors;
} {
  const result = createCharacterSchema.safeParse({
    ...input,
    name: input.name.trim(),
  });
  if (result.success) return { value: result.data, errors: {} };
  const errors: CharacterFieldErrors = {};
  for (const issue of result.error.issues) {
    if (issue.path[0] === "name") errors.name = "Name is required.";
    if (issue.path[0] === "type") errors.type = "Select a character type.";
  }
  return { errors };
}

export function episodesByPosition(episodes: Episode[]): Episode[] {
  return [...episodes].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
}

export function movedEpisodeIds(
  episodes: Episode[],
  index: number,
  offset: -1 | 1,
): string[] | undefined {
  const other = index + offset;
  if (
    index < 0 ||
    index >= episodes.length ||
    other < 0 ||
    other >= episodes.length
  )
    return undefined;
  const ids = episodes.map((episode) => episode.id);
  [ids[index], ids[other]] = [ids[other]!, ids[index]!];
  return ids;
}

export type EpisodeFieldErrors = Partial<
  Record<keyof CreateEpisodeRequest, string>
>;

export function validateEpisode(input: CreateEpisodeRequest): {
  value?: CreateEpisodeRequest;
  errors: EpisodeFieldErrors;
} {
  const result = createEpisodeSchema.safeParse({
    ...input,
    title: input.title.trim(),
  });
  if (result.success) return { value: result.data, errors: {} };
  const errors: EpisodeFieldErrors = {};
  for (const issue of result.error.issues) {
    if (issue.path[0] === "title") errors.title = "Title is required.";
    if (issue.path[0] === "description")
      errors.description = "Description is required.";
  }
  return { errors };
}

export function scenesByPosition(scenes: Scene[]): Scene[] {
  return [...scenes].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
}

export function movedSceneIds(
  scenes: Scene[],
  index: number,
  offset: -1 | 1,
): string[] | undefined {
  const other = index + offset;
  if (
    index < 0 ||
    index >= scenes.length ||
    other < 0 ||
    other >= scenes.length
  )
    return undefined;
  const ids = scenes.map((scene) => scene.id);
  [ids[index], ids[other]] = [ids[other]!, ids[index]!];
  return ids;
}

export type SceneFieldErrors = Partial<
  Record<keyof CreateSceneRequest, string>
>;

export function validateScene(input: CreateSceneRequest): {
  value?: CreateSceneRequest;
  errors: SceneFieldErrors;
} {
  const result = createSceneSchema.safeParse({
    ...input,
    title: input.title.trim(),
  });
  if (result.success) return { value: result.data, errors: {} };
  const errors: SceneFieldErrors = {};
  for (const issue of result.error.issues) {
    if (issue.path[0] === "title") errors.title = "Title is required.";
    if (issue.path[0] === "backgroundMusicId")
      errors.backgroundMusicId = "Select background music or none.";
  }
  return { errors };
}

export function cuePointsByPosition(points: CuePoint[]): CuePoint[] {
  return [...points].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
}

export function movedCuePointIds(
  points: CuePoint[],
  index: number,
  offset: -1 | 1,
): string[] | undefined {
  const other = index + offset;
  if (
    index < 0 ||
    index >= points.length ||
    other < 0 ||
    other >= points.length
  )
    return undefined;
  const ids = points.map((point) => point.id);
  [ids[index], ids[other]] = [ids[other]!, ids[index]!];
  return ids;
}

export type CuePointFieldErrors = Partial<
  Record<keyof CreateCuePointRequest, string>
>;

export function validateCuePoint(input: CreateCuePointRequest): {
  value?: CreateCuePointRequest;
  errors: CuePointFieldErrors;
} {
  const result = createCuePointSchema.safeParse(input);
  if (result.success) return { value: result.data, errors: {} };
  const errors: CuePointFieldErrors = {};
  for (const issue of result.error.issues) {
    if (issue.path[0] === "characterId")
      errors.characterId = "Select a character.";
    if (issue.path[0] === "spokenText")
      errors.spokenText = "Enter valid spoken text.";
    if (issue.path[0] === "soundEffectIds")
      errors.soundEffectIds = "Select valid sound effects.";
  }
  return { errors };
}

export function projectError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Unable to complete the request. Please try again.";
}
