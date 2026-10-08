import { createApp } from "./app.ts";
import { ConfigurationError, parseConfig } from "./config.ts";

async function main(): Promise<void> {
  const config = parseConfig(process.env);
  const app = createApp();
  try {
    await app.listen({ port: config.PORT, host: "127.0.0.1" });
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
  console.log(`API listening at http://127.0.0.1:${config.PORT}`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof ConfigurationError ? error.message : "API startup failed.",
  );
  process.exitCode = 1;
});
