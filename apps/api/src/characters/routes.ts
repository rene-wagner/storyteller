import type { FastifyInstance } from "fastify";
import {
  createCharacterSchema,
  updateCharacterSchema,
} from "@storyteller/shared";
import { z } from "zod";
import type { CharacterService } from "./service.ts";

const projectParamsSchema = z.strictObject({ projectId: z.uuid() });
const characterParamsSchema = z.strictObject({ characterId: z.uuid() });
const notFound = {
  error: { code: "NOT_FOUND", message: "Resource not found.", details: [] },
};

export function registerCharacterRoutes(
  app: FastifyInstance,
  characters: CharacterService,
): void {
  app.get("/projects/:projectId/characters", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const list = await characters.list(projectId);
    return list ?? reply.code(404).send(notFound);
  });

  app.post("/projects/:projectId/characters", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const input = createCharacterSchema.parse(request.body);
    const character = await characters.create(projectId, input);
    return character
      ? reply.code(201).send(character)
      : reply.code(404).send(notFound);
  });

  app.patch("/characters/:characterId", async (request, reply) => {
    const { characterId } = characterParamsSchema.parse(request.params);
    const input = updateCharacterSchema.parse(request.body);
    const character = await characters.update(characterId, input);
    return character ?? reply.code(404).send(notFound);
  });

  app.delete("/characters/:characterId", async (request, reply) => {
    const { characterId } = characterParamsSchema.parse(request.params);
    if (!(await characters.delete(characterId)))
      return reply.code(404).send(notFound);
    return reply.code(204).send();
  });
}
