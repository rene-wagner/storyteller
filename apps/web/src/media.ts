import type {
  MediaItem,
  MediaType,
  UploadMediaRequest,
} from "@storyteller/shared";
import { updateMediaSchema, uploadMediaSchema } from "@storyteller/shared";
import { ApiError, createApiClient } from "./api-client";

const apiClient = createApiClient("/api");

export const mediaKeys = {
  all: ["media"] as const,
  list: (type: MediaType | "all") => ["media", type] as const,
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

export const mediaApi = {
  async list(type: MediaType | "all" = "all"): Promise<MediaItem[]> {
    return required(
      await apiClient.request<MediaItem[]>(
        type === "all" ? "/media" : `/media?type=${encodeURIComponent(type)}`,
      ),
    );
  },
  async upload(input: UploadMediaRequest, file: File): Promise<MediaItem> {
    const formData = new FormData();
    formData.set("name", input.name);
    formData.set("type", input.type);
    formData.set("file", file);
    return required(
      await apiClient.request<MediaItem>("/media", {
        method: "POST",
        formData,
      }),
    );
  },
  async updateName(id: string, name: string): Promise<MediaItem> {
    return required(
      await apiClient.request<MediaItem>(`/media/${encodeURIComponent(id)}`, {
        method: "PATCH",
        json: { name },
      }),
    );
  },
  async delete(id: string): Promise<void> {
    await apiClient.request<void>(`/media/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

export function validateMediaName(name: string): string | undefined {
  return updateMediaSchema.safeParse({ name: name.trim() }).success
    ? undefined
    : "Enter a name (up to 255 characters).";
}

export function validateMediaUpload(
  name: string,
  type: string,
  file: File | null,
): string | undefined {
  if (
    !uploadMediaSchema.safeParse({ name: name.trim(), type }).success ||
    new TextEncoder().encode(name.trim()).length > 256
  )
    return "Enter a name (up to 255 characters and 256 bytes) and select a media type.";
  if (!file || !/^audio\/[a-z0-9][a-z0-9.+-]*$/i.test(file.type))
    return "Select an audio file.";
  if (file.size > 25 * 1024 * 1024)
    return "Audio files must be 25 MB or smaller.";
  return undefined;
}
