import type { FastifyInstance } from "fastify";
import {
  createCuePointSchema,
  reorderCuePointsSchema,
  updateCuePointSchema,
} from "@storyteller/shared";
import { z } from "zod";
import type { CuePointService } from "./service.ts";

const sceneParamsSchema = z.strictObject({ sceneId: z.uuid() });
const cuePointParamsSchema = z.strictObject({ cuePointId: z.uuid() });
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

export function registerCuePointRoutes(
  app: FastifyInstance,
  points: CuePointService,
): void {
  app.get("/scenes/:sceneId/cue-points", async (request, reply) => {
    const { sceneId } = sceneParamsSchema.parse(request.params);
    const list = await points.list(sceneId);
    return list ?? reply.code(404).send(notFound);
  });

  app.post("/scenes/:sceneId/cue-points", async (request, reply) => {
    const { sceneId } = sceneParamsSchema.parse(request.params);
    const input = createCuePointSchema.parse(request.body);
    const point = await points.create(sceneId, input);
    if (point === "invalid") return reply.code(400).send(invalid);
    return point ? reply.code(201).send(point) : reply.code(404).send(notFound);
  });

  app.put("/scenes/:sceneId/cue-points/order", async (request, reply) => {
    const { sceneId } = sceneParamsSchema.parse(request.params);
    const { cuePointIds } = reorderCuePointsSchema.parse(request.body);
    const result = await points.reorder(sceneId, cuePointIds);
    if (result === "not_found") return reply.code(404).send(notFound);
    if (result === "invalid") return reply.code(400).send(invalid);
    return reply.code(204).send();
  });

  app.get("/cue-points/:cuePointId", async (request, reply) => {
    const { cuePointId } = cuePointParamsSchema.parse(request.params);
    const point = await points.find(cuePointId);
    return point ?? reply.code(404).send(notFound);
  });

  app.patch("/cue-points/:cuePointId", async (request, reply) => {
    const { cuePointId } = cuePointParamsSchema.parse(request.params);
    const input = updateCuePointSchema.parse(request.body);
    const point = await points.update(cuePointId, input);
    if (point === "invalid") return reply.code(400).send(invalid);
    return point ?? reply.code(404).send(notFound);
  });

  app.delete("/cue-points/:cuePointId", async (request, reply) => {
    const { cuePointId } = cuePointParamsSchema.parse(request.params);
    if (!(await points.delete(cuePointId)))
      return reply.code(404).send(notFound);
    return reply.code(204).send();
  });
}
