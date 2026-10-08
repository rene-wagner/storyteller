import type {
  MediaItem,
  MediaType,
  UpdateMediaRequest,
  UploadMediaRequest,
} from "@storyteller/shared";
import type { MediaRepository, MediaRow } from "./repository.ts";
import type { MediaStorage } from "./storage.ts";

function toMediaItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createMediaService(
  repository: MediaRepository,
  storage: MediaStorage,
) {
  return {
    async upload(
      input: () => Promise<
        UploadMediaRequest & { fileName: string; mimeType: string }
      >,
      data: AsyncIterable<Uint8Array>,
    ): Promise<MediaItem> {
      let fileSize = 0;
      async function* counted(): AsyncIterable<Uint8Array> {
        for await (const chunk of data) {
          fileSize += chunk.byteLength;
          yield chunk;
        }
      }
      const storageKey = await storage.save(counted());
      try {
        if (fileSize === 0) throw new InvalidMediaFileError();
        return toMediaItem(
          await repository.create({
            ...(await input()),
            fileSize: BigInt(fileSize),
            storageKey,
          }),
        );
      } catch (error) {
        try {
          await storage.delete(storageKey);
        } catch {
          /* Preserve the original failure; cleanup is best effort. */
        }
        throw error;
      }
    },
    async list(type?: MediaType): Promise<MediaItem[]> {
      return (await repository.list(type)).map(toMediaItem);
    },
    async find(id: string): Promise<MediaItem | undefined> {
      const row = await repository.find(id);
      return row && toMediaItem(row);
    },
    async update(
      id: string,
      input: UpdateMediaRequest,
    ): Promise<MediaItem | undefined> {
      const row = await repository.update(id, input);
      return row && toMediaItem(row);
    },
    async delete(
      id: string,
    ): Promise<
      | "not_found"
      | { kind: "in_use"; usage: { sceneIds: string[]; cuePointIds: string[] } }
      | "deleted"
    > {
      const result = await repository.delete(id);
      if (result.kind === "not_found") return "not_found";
      if (result.kind === "in_use") return result;
      // Metadata is committed first. On storage failure the API returns 500; an orphaned
      // file is safer than metadata pointing at missing bytes or an invalid domain FK.
      await storage.delete(result.storageKey);
      return "deleted";
    },
  };
}

export class InvalidMediaFileError extends Error {
  statusCode = 400;
}
export type MediaService = ReturnType<typeof createMediaService>;
