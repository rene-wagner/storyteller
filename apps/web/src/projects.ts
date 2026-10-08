import type {
  Character,
  CreateProjectRequest,
  Episode,
  Project,
  UpdateProjectRequest,
} from "@storyteller/shared";
import { createProjectSchema } from "@storyteller/shared";
import { createApiClient, ApiError } from "./api-client";

const apiClient = createApiClient("/api");

export const projectKeys = {
  list: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
  characters: (id: string) => ["projects", id, "characters"] as const,
  episodes: (id: string) => ["projects", id, "episodes"] as const,
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
  async episodes(id: string): Promise<Episode[]> {
    return required(
      await apiClient.request<Episode[]>(
        `/projects/${encodeURIComponent(id)}/episodes`,
      ),
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

export function projectError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Unable to complete the request. Please try again.";
}
