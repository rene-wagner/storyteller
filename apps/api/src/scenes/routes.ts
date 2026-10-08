import type { FastifyInstance } from "fastify";
import {
  createSceneSchema,
  reorderScenesSchema,
  updateSceneSchema,
} from "@storyteller/shared";
import { z } from "zod";
import type { SceneService } from "./service.ts";

const episodeParamsSchema = z.strictObject({ episodeId: z.uuid() });
const sceneParamsSchema = z.strictObject({ sceneId: z.uuid() });
const notFound = {
  error: { code: "NOT_FOUND", message: "Resource not found.", details: [] },
};
const invalid = {
  error: {
    code: "VALIDATION_ERROR",
    message: "The request contains invalid data.",
    details: [],
  },
};

export function registerSceneRoutes(
  app: FastifyInstance,
  scenes: SceneService,
): void {
  app.get("/episodes/:episodeId/scenes", async (request, reply) => {
    const { episodeId } = episodeParamsSchema.parse(request.params);
    const list = await scenes.list(episodeId);
    return list ?? reply.code(404).send(notFound);
  });

  app.post("/episodes/:episodeId/scenes", async (request, reply) => {
    const { episodeId } = episodeParamsSchema.parse(request.params);
    const input = createSceneSchema.parse(request.body);
    const scene = await scenes.create(episodeId, input);
    return scene ? reply.code(201).send(scene) : reply.code(404).send(notFound);
  });

  app.put("/episodes/:episodeId/scenes/order", async (request, reply) => {
    const { episodeId } = episodeParamsSchema.parse(request.params);
    const { sceneIds } = reorderScenesSchema.parse(request.body);
    const result = await scenes.reorder(episodeId, sceneIds);
    if (result === "not_found") return reply.code(404).send(notFound);
    if (result === "invalid") return reply.code(400).send(invalid);
    return reply.code(204).send();
  });

  app.get("/scenes/:sceneId", async (request, reply) => {
    const { sceneId } = sceneParamsSchema.parse(request.params);
    const scene = await scenes.find(sceneId);
    return scene ?? reply.code(404).send(notFound);
  });

  app.patch("/scenes/:sceneId", async (request, reply) => {
    const { sceneId } = sceneParamsSchema.parse(request.params);
    const input = updateSceneSchema.parse(request.body);
    const scene = await scenes.update(sceneId, input);
    return scene ?? reply.code(404).send(notFound);
  });

  app.delete("/scenes/:sceneId", async (request, reply) => {
    const { sceneId } = sceneParamsSchema.parse(request.params);
    if (!(await scenes.delete(sceneId))) return reply.code(404).send(notFound);
    return reply.code(204).send();
  });
}
