import { z } from "zod";

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      url.hostname.length > 0 &&
      url.pathname.length > 1 &&
      (!url.port ||
        (/^\d+$/.test(url.port) &&
          Number(url.port) >= 1 &&
          Number(url.port) <= 65535)) &&
      !/\s/.test(value)
    );
  } catch {
    return false;
  }
}

const environmentSchema = z.object({
  HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default("3000")
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),
  DATABASE_URL: z.string().refine(isPostgresUrl),
  MEDIA_STORAGE_DIRECTORY: z
    .string()
    .refine((value) => !/[\0\r\n]/.test(value))
    .trim()
    .min(1)
    .default("./media"),
});

export type Config = z.infer<typeof environmentSchema>;

const configurationMessages = {
  HOST: "must be 127.0.0.1 or 0.0.0.0",
  PORT: "must be an integer from 1 to 65535",
  DATABASE_URL:
    "must be a PostgreSQL URL with a host and database name (postgres:// or postgresql://)",
  MEDIA_STORAGE_DIRECTORY:
    "must be a non-empty directory path without NUL or line breaks",
};

export class ConfigurationError extends Error {}

export function parseConfig(environment: NodeJS.ProcessEnv): Config {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    // Only emit fixed messages: Zod diagnostics or raw values can contain secrets.
    const messages = Object.entries(configurationMessages)
      .filter(([field]) =>
        result.error.issues.some((issue) => issue.path[0] === field),
      )
      .map(([field, message]) => `${field}: ${message}`);
    throw new ConfigurationError(
      `Invalid API configuration:\n${messages.join("\n")}`,
    );
  }
  return result.data;
}
