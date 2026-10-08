import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import {
  listMediaSchema,
  updateMediaSchema,
  uploadMediaSchema,
} from "@storyteller/shared";
import { z } from "zod";
import type { MediaService } from "./service.ts";

const paramsSchema = z.strictObject({ mediaId: z.uuid() });
const missing = {
  error: { code: "NOT_FOUND", message: "Resource not found.", details: [] },
};
const invalidUpload = () => new MediaUploadError();
export class MediaUploadError extends Error {
  statusCode = 400;
}

export function registerMediaRoutes(
  app: FastifyInstance,
  media: MediaService,
): void {
  app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 2,
      fields: 3,
      parts: 5,
      fieldSize: 256,
    },
    throwFileSizeLimit: true,
  });

  app.post("/media", async (request, reply) => {
    if (!request.isMultipart()) throw invalidUpload();
    const parts = request.parts();
    const iterator = parts[Symbol.asyncIterator]();
    const fields: Record<string, string> = {};
    let foundFile = false;
    let fileName = "";
    let mimeType = "";
    async function nextFileOrField(): Promise<
      ReturnType<typeof iterator.next> extends Promise<infer T> ? T : never
    > {
      const next = await iterator.next();
      if (next.done) return next;
      const part = next.value;
      if (part.type === "field") {
        if (
          (part.fieldname !== "name" && part.fieldname !== "type") ||
          Object.hasOwn(fields, part.fieldname) ||
          part.valueTruncated ||
          typeof part.value !== "string"
        )
          throw invalidUpload();
        fields[part.fieldname] = part.value;
      } else {
        if (foundFile || part.fieldname !== "file") throw invalidUpload();
        foundFile = true;
        fileName = part.filename;
        mimeType = part.mimetype;
      }
      return next;
    }
    let next = await nextFileOrField();
    while (!next.done && next.value.type !== "file")
      next = await nextFileOrField();
    if (next.done || next.value.type !== "file") throw invalidUpload();
    const file = next.value;
    const item = await media.upload(async () => {
      let remaining = await nextFileOrField();
      while (!remaining.done) remaining = await nextFileOrField();
      if (
        !fileName ||
        fileName.length > 255 ||
        [...fileName].some(
          (char) =>
            char === "/" ||
            char === "\\" ||
            char.charCodeAt(0) < 32 ||
            char.charCodeAt(0) === 127,
        ) ||
        !/^audio\/[a-z0-9][a-z0-9.+-]*$/i.test(mimeType)
      )
        throw invalidUpload();
      const input = uploadMediaSchema.parse(fields);
      return { ...input, fileName, mimeType };
    }, file.file);
    return reply.code(201).send(item);
  });
  app.get("/media", async (request) => {
    const { type } = listMediaSchema.parse(request.query);
    return media.list(type);
  });
  app.get("/media/:mediaId", async (request, reply) => {
    const { mediaId } = paramsSchema.parse(request.params);
    return (await media.find(mediaId)) ?? reply.code(404).send(missing);
  });
  app.patch("/media/:mediaId", async (request, reply) => {
    const { mediaId } = paramsSchema.parse(request.params);
    const input = updateMediaSchema.parse(request.body);
    return (
      (await media.update(mediaId, input)) ?? reply.code(404).send(missing)
    );
  });
  app.delete("/media/:mediaId", async (request, reply) => {
    const { mediaId } = paramsSchema.parse(request.params);
    const result = await media.delete(mediaId);
    if (result === "not_found") return reply.code(404).send(missing);
    if (result !== "deleted")
      return reply.code(409).send({
        error: {
          code: "CONFLICT",
          message: "Media item is in use.",
          details: [],
          usage: result.usage,
        },
      });
    return reply.code(204).send();
  });
}
