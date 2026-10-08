import { createApp } from "./app.ts";
import { ConfigurationError, parseConfig } from "./config.ts";
import { createDatabase } from "./db/connection.ts";
import { createProjectRepository } from "./projects/repository.ts";
import { createProjectService } from "./projects/service.ts";

async function main(): Promise<void> {
  const config = parseConfig(process.env);
  const database = createDatabase(config);
  const app = createApp({
    projects: createProjectService(createProjectRepository(database.db)),
  });
  app.addHook("onClose", database.close);
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
  } catch {
    await app.close();
    throw new Error("API startup failed.");
  }

  let shuttingDown = false;
  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await app.close();
      console.log("API shut down.");
    } catch {
      console.error("API shutdown failed.");
      process.exitCode = 1;
    } finally {
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
    }
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  console.log(`API listening at http://${config.HOST}:${config.PORT}`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof ConfigurationError ? error.message : "API startup failed.",
  );
  process.exitCode = 1;
});
