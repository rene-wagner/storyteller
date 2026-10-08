import type { FastifyInstance } from "fastify";
import { createProjectSchema, updateProjectSchema } from "@storyteller/shared";
import { z } from "zod";
import type { ProjectService } from "./service.ts";

const projectParamsSchema = z.strictObject({ projectId: z.uuid() });
const notFound = {
  error: { code: "NOT_FOUND", message: "Resource not found.", details: [] },
};

export function registerProjectRoutes(
  app: FastifyInstance,
  projects: ProjectService,
): void {
  app.post("/projects", async (request, reply) => {
    const input = createProjectSchema.parse(request.body);
    return reply.code(201).send(await projects.create(input));
  });

  app.get("/projects", async () => projects.list());

  app.get("/projects/:projectId", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await projects.find(projectId);
    return project ?? reply.code(404).send(notFound);
  });

  app.patch("/projects/:projectId", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);
    const project = await projects.update(projectId, input);
    return project ?? reply.code(404).send(notFound);
  });

  app.delete("/projects/:projectId", async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    if (!(await projects.delete(projectId)))
      return reply.code(404).send(notFound);
    return reply.code(204).send();
  });
}
