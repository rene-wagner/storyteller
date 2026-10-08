import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

export function createApp(): FastifyInstance {
  const app = Fastify();
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
