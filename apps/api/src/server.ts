import { createApp } from "./app.ts";
import { ConfigurationError, parseConfig } from "./config.ts";
import { createCharacterRepository } from "./characters/repository.ts";
import { createCharacterService } from "./characters/service.ts";
import { createCuePointRepository } from "./cue-points/repository.ts";
import { createCuePointService } from "./cue-points/service.ts";
import { createDatabase } from "./db/connection.ts";
import { createEpisodeRepository } from "./episodes/repository.ts";
import { createEpisodeService } from "./episodes/service.ts";
import { createLocalMediaStorage } from "./media/local-storage.ts";
import { createMediaRepository } from "./media/repository.ts";
import { createMediaService } from "./media/service.ts";
import { createProjectRepository } from "./projects/repository.ts";
import { createProjectService } from "./projects/service.ts";
import { createSceneRepository } from "./scenes/repository.ts";
import { createSceneService } from "./scenes/service.ts";

async function main(): Promise<void> {
  const config = parseConfig(process.env);
  const database = createDatabase(config);
  const projectRepository = createProjectRepository(database.db);
  const episodeRepository = createEpisodeRepository(database.db);
  const sceneRepository = createSceneRepository(database.db);
  const app = createApp({
    projects: createProjectService(projectRepository),
    media: createMediaService(
      createMediaRepository(database.db),
      createLocalMediaStorage(config),
    ),
    characters: createCharacterService(
      createCharacterRepository(database.db),
      projectRepository,
    ),
    episodes: createEpisodeService(episodeRepository, projectRepository),
    scenes: createSceneService(sceneRepository, episodeRepository),
    cuePoints: createCuePointService(
      createCuePointRepository(database.db),
      sceneRepository,
    ),
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
