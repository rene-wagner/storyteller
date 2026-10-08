import type { FastifyInstance } from "fastify";
import {
  createEpisodeSchema,
  reorderEpisodesSchema,
  updateEpisodeSchema,
} from "@storyteller/shared";
import { z } from "zod";
import type { EpisodeService } from "./service.ts";

const projectParamsSchema = z.strictObject({ projectId: z.uuid() });
const episodeParamsSchema = z.strictObject({ episodeId: z.uuid() });
const notFound = {
  error: { code: "NOT_FOUND", message: "Resource not found.", details: [] },
};

export function registerEpisodeRoutes(
  app: FastifyInstance,
  episodes: EpisodeService,
): void {
  app.get("/projects/:projectId/episodes", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const list = await episodes.list(projectId);
    return list ?? reply.code(404).send(notFound);
  });

  app.post("/projects/:projectId/episodes", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const input = createEpisodeSchema.parse(request.body);
    const episode = await episodes.create(projectId, input);
    return episode
      ? reply.code(201).send(episode)
      : reply.code(404).send(notFound);
  });

  app.put("/projects/:projectId/episodes/order", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const { episodeIds } = reorderEpisodesSchema.parse(request.body);
    const result = await episodes.reorder(projectId, episodeIds);
    if (result === "not_found") return reply.code(404).send(notFound);
    if (result === "invalid")
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request contains invalid data.",
          details: [],
        },
      });
    return reply.code(204).send();
  });

  app.get("/episodes/:episodeId", async (request, reply) => {
    const { episodeId } = episodeParamsSchema.parse(request.params);
    const episode = await episodes.find(episodeId);
    return episode ?? reply.code(404).send(notFound);
  });

  app.patch("/episodes/:episodeId", async (request, reply) => {
    const { episodeId } = episodeParamsSchema.parse(request.params);
    const input = updateEpisodeSchema.parse(request.body);
    const episode = await episodes.update(episodeId, input);
    return episode ?? reply.code(404).send(notFound);
  });

  app.delete("/episodes/:episodeId", async (request, reply) => {
    const { episodeId } = episodeParamsSchema.parse(request.params);
    if (!(await episodes.delete(episodeId)))
      return reply.code(404).send(notFound);
    return reply.code(204).send();
  });
}
