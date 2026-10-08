import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { CharacterDeletionConflictError } from "./characters/repository.ts";
import { registerCharacterRoutes } from "./characters/routes.ts";
import type { CharacterService } from "./characters/service.ts";
import { ProjectDeletionConflictError } from "./projects/repository.ts";
import { registerProjectRoutes } from "./projects/routes.ts";
import type { ProjectService } from "./projects/service.ts";

type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "REQUEST_ERROR"
  | "INTERNAL_ERROR";

function errorResponse(code: ErrorCode, message: string) {
  return { error: { code, message, details: [] } };
}

export function createApp(
  dependencies: {
    projects?: ProjectService;
    characters?: CharacterService;
  } = {},
): FastifyInstance {
  const app = Fastify();

  app.setErrorHandler((error, _request, reply) => {
    const statusCode =
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
    if (error instanceof ZodError || statusCode === 400) {
      return reply
        .code(400)
        .send(
          errorResponse(
            "VALIDATION_ERROR",
            "The request contains invalid data.",
          ),
        );
    }
    if (statusCode === 404) {
      return reply
        .code(404)
        .send(errorResponse("NOT_FOUND", "Resource not found."));
    }
    if (
      error instanceof ProjectDeletionConflictError ||
      error instanceof CharacterDeletionConflictError ||
      statusCode === 409
    ) {
      return reply
        .code(409)
        .send(errorResponse("CONFLICT", "Resource conflict."));
    }
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply
        .code(statusCode)
        .send(
          errorResponse("REQUEST_ERROR", "The request could not be processed."),
        );
    }
    return reply
      .code(500)
      .send(errorResponse("INTERNAL_ERROR", "An unexpected error occurred."));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(errorResponse("NOT_FOUND", "Resource not found.")),
  );

  app.get("/health", async () => ({ status: "ok" }));
  if (dependencies.projects) registerProjectRoutes(app, dependencies.projects);
  if (dependencies.characters)
    registerCharacterRoutes(app, dependencies.characters);
  return app;
}
