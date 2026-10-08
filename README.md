# Storyteller

Repository and database foundation for an audio drama application. TASK-001–TASK-014
of `docs/development/ROADMAP.md` are implemented.

## Requirements and setup

- Node.js 24 or newer
- PNPM 12 (the exact development version is recorded in `packageManager`)
- Supported environments include Termux / Android arm64

From the repository root:

```sh
pnpm install
pnpm validate
```

Keep `pnpm-lock.yaml` with repository changes for reproducible installs. Dependencies
are pinned; TypeScript 5.9 is used for compatibility with Vue's checker.
Oxlint 1.87.0 handles linting and Oxfmt 0.72.0 handles formatting, both with
native Android arm64 support.

## Commands

| Command             | Purpose                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`          | Run the API and Vite development server in parallel via PNPM                 |
| `pnpm build`        | Compile the API and typecheck/bundle the Vue frontend via recursive PNPM     |
| `pnpm lint`         | Lint both apps via recursive PNPM, then lint root tests and check formatting |
| `pnpm typecheck`    | Check both apps via recursive PNPM, including Vue single-file components     |
| `pnpm test`         | Run repository and backend-foundation tests once using Vitest                |
| `pnpm format:check` | Check formatting without changing files                                      |
| `pnpm format`       | Format owned source and configuration files                                  |
| `pnpm validate`     | Run lint, typecheck, tests and build in that order; stop on failure          |

## Structure and scope

- `apps/api`: a minimal Fastify application with an importable app factory,
  separate server entry point and Zod-validated environment configuration.
- `apps/web`: a minimal runnable Vue `<script setup>` tooling probe using Vite 8
  and `@vitejs/plugin-vue`. Vite serves the probe in development and bundles HTML
  and JavaScript to `dist` for production. Type checking remains separate and
  also checks the Node-side Vite configuration; no application shell or features
  are implemented yet.
- `packages/config`: shared strict TypeScript base, Node and Vue configurations,
  consumed through workspace dependencies by both apps.
- `.oxlintrc.json` and `.oxfmtrc.json`: common Oxlint and Oxfmt settings.
- `tests/repository.test.mjs`: workspace/task wiring, effective compiler settings
  (including rejected invalid types and isolated Node/browser globals), Vue/TS
  script lint rules, formatting/ignore-policy checks and Vite development/build
  smoke tests.
- `vitest.config.mjs`: Vitest configuration for root repository tests in the
  Node environment, with a 30-second per-test timeout for tooling smoke tests.

Vite is used where browser bundling is needed. The Node API retains `tsc`, and
`packages/config` distributes JSON configuration directly without a build step.
Future shared packages should use Vite library mode only if they need bundled
output, not simply because they belong to the workspace.

Run the frontend independently (also under Termux):

```sh
pnpm --filter @storyteller/web dev
pnpm --filter @storyteller/web build
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The page
only displays the existing `web` tooling marker.

The API currently exposes only `GET /health`. A PostgreSQL/Drizzle connection
factory and migration tooling are available, but the HTTP server does not open a
database connection until a later task needs one. The database schema includes
projects, characters, episodes, scenes, cue points, media items and media
relations; HTTP APIs, media file operations, storage implementations and domain/UI
features belong to later roadmap phases. Compiler output (`dist`), dependencies,
coverage, TypeScript build information and private `.env.local` files are ignored.
The root `.env` (local Docker defaults) and `apps/api/.env.example` are tracked.
`AGENTS.md` and `docs/` are excluded from automatic formatting.

## Docker Compose (local development)

Docker Compose runs PostgreSQL 17, the compiled API and the Vite development
server. Install Docker with Compose, then from the repository root:

```sh
docker compose up --build -d
docker compose run --rm api pnpm --filter @storyteller/api db:migrate
curl http://127.0.0.1:3000/health
# Open http://127.0.0.1:5173 for the current frontend tooling probe.
```

The API does not connect to PostgreSQL at startup; migrations are explicit and
must be run before using database-backed features or tests. Source changes require
`docker compose up --build -d` again; this is not a hot-reload setup. PostgreSQL
and future media files persist in named volumes. `docker compose down` stops the
stack; `docker compose down -v` also **deletes** database and media data.
Ports are published only on the host loopback interface. `DB_PORT`, `API_PORT`
and `WEB_PORT` in the root `.env` set host ports (defaults: 5432, 3000, 5173).
The container-side ports stay fixed. The API binds to all container interfaces
only in Compose; outside Docker it remains loopback-only by default.

The root `.env` is versioned and contains **development-only** PostgreSQL values.
Never put real credentials there. For private overrides create `.env.local` in
the repository root and pass both files to every Compose command, for example:

```sh
docker compose --env-file .env --env-file .env.local up --build -d
docker compose --env-file .env --env-file .env.local run --rm api pnpm --filter @storyteller/api db:migrate
```

`.env.local` is Git-ignored and excluded from Docker builds. Set
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and/or host ports there.
Use URL-safe characters for PostgreSQL credentials: Compose constructs the
container `DATABASE_URL` from these values. PostgreSQL initialization variables
only take effect for a new volume; changing them on an existing volume requires
migrating the database or deliberately removing the volume. This configuration
is for local development, not production deployment.

## Backend setup and configuration

From the repository root:

```sh
cp apps/api/.env.example apps/api/.env
pnpm --filter @storyteller/api dev
```

The example contains a credential-free local PostgreSQL URL, not production
credentials. Keep real credentials only in the ignored `.env` file or process
environment. Both API scripts optionally load `apps/api/.env` using Node's built-in
support; existing process environment values take precedence. Without that file,
Node may print a notice and continues with the process environment.

| Variable                  | Default     | Validation                                                                                           |
| ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `HOST`                    | `127.0.0.1` | `127.0.0.1` or `0.0.0.0` (for containers only)                                                       |
| `PORT`                    | `3000`      | Decimal integer from 1 to 65535; port 0 is not accepted                                              |
| `DATABASE_URL`            | Required    | `postgres://` or `postgresql://` URL with a host and database name; an explicit port must be 1–65535 |
| `MEDIA_STORAGE_DIRECTORY` | `./media`   | Non-empty path after trimming, without NUL or line breaks                                            |

Relative media paths are relative to the API working directory (`apps/api` for
these PNPM scripts). The directory is neither created nor accessed in Phase 2;
its existence/permissions and database connectivity are not checked at server
startup. A PostgreSQL server is not needed to run the health endpoint.

The API binds only to `127.0.0.1`. Check it from another terminal:

```sh
curl http://127.0.0.1:3000/health
# {"status":"ok"} with HTTP 200
```

Development uses Node 24+'s native TypeScript type stripping. It does not typecheck
or automatically restart: stop with Ctrl-C and rerun after changes. Use
`pnpm --filter @storyteller/api typecheck` for strict type checking. Production
still compiles with `tsc` (relative TypeScript imports are rewritten to JavaScript):

```sh
pnpm --filter @storyteller/api build
pnpm --filter @storyteller/api start
```

Configuration is validated before creating/listening with Fastify. Invalid
configuration exits nonzero with field names and fixed diagnostic messages, never
raw values or credentials. Listen failures also exit nonzero without stack traces.
SIGINT (Ctrl-C) and SIGTERM close Fastify, finish shutdown and exit normally.

## PostgreSQL and migrations

Set `DATABASE_URL` in `apps/api/.env` (ignored by Git) or the process environment
before running database commands from the repository root. Do not store credentials
in tracked files. An existing PostgreSQL database and a user allowed to create
schema objects are required. `apps/api/src/db/connection.ts` creates a Drizzle
client backed by a `pg` pool from validated configuration; callers must close it
when finished. It does not connect during HTTP server startup.

```sh
pnpm --filter @storyteller/api db:generate
pnpm --filter @storyteller/api db:migrate
```

Drizzle Kit reads `apps/api/drizzle.config.ts`, the schema entry point at
`apps/api/src/db/schema.ts`, and stores generated SQL plus metadata in
`apps/api/drizzle/`. The initial empty baseline migration was generated with
`pnpm --filter @storyteller/api db:generate --custom --name=baseline`. Subsequent migrations add the Phase 3 tables, constraints and media relations.
Run `db:migrate` against an existing database to apply them in order. For future
schema changes, run `db:generate` followed by `db:migrate`; keep migrations in
version control. Migration 0007 makes the cue-point character foreign key
`DEFERRABLE INITIALLY DEFERRED` so deleting a project can remove all descendants
while directly deleting a referenced character still fails at commit. Drizzle
cannot express this constraint property in its schema; preserve it in future
migrations. To run database constraint tests, set `DATABASE_URL`, apply migrations,
and run `pnpm test`. API type checking still uses strict mode; `skipLibCheck` is
enabled only for the API because Drizzle's published declarations include
unrelated database drivers and unresolved optional peer declarations.

## Code quality

Oxlint uses its correctness rules with the native TypeScript and Vue plugins.
Explicit `any`, unused variables, `var` and avoidable `let` declarations are
rejected. Both apps and the root tests use the shared configuration; lint warnings
also fail validation. `pnpm lint:root` checks the root tests and Vitest
configuration independently of workspace scripts.
Type checking remains a separate step using `tsc` and `vue-tsc`; type-aware Oxlint
rules are not enabled.

Oxlint checks Vue `<script>` and `<script setup>` blocks, but does not currently
lint Vue templates. It is not a one-to-one replacement for the former Vue
recommended lint rules. `vue-tsc` continues to check template types, and Oxfmt
formats entire Vue single-file components.

Oxfmt retains the existing style: semicolons, double quotes, trailing commas and
an 80-character print width. Package-key sorting is disabled to avoid unrelated
reordering. Generated files, the lockfile and user-owned documentation retain
their formatting exclusions.

## Tests

Vitest replaces Node's built-in test runner. `pnpm test` runs the existing
`tests/**/*.test.mjs` suite once; use `pnpm exec vitest` for watch mode or
`pnpm exec vitest run tests/repository.test.mjs` for the specific test file.
Tests use Vitest's `expect` assertions (`toStrictEqual` for strict deep
comparisons) and `onTestFinished` for temporary-directory cleanup. Node APIs and
child processes remain available; no browser/DOM test environment is needed for
these repository checks.

`tests/api.test.mjs` covers the health response, valid/invalid configuration,
refused startup (including an occupied port), actual local development/compiled
startup and graceful SIGINT/SIGTERM shutdown. It builds the API before exercising
its production entry point; no database or media directory is needed. Run it with
`pnpm exec vitest run tests/api.test.mjs`.

`tests/db.test.mjs` checks the connection factory against a live PostgreSQL server.
The schema tests check Phase 3 tables, references, ordering constraints and deletion
behavior, including project cascades. These tests skip when `DATABASE_URL` is unset.
Database-backed API and Vue component test infrastructure remain future roadmap tasks.

## Workspace execution and Termux

Root scripts use `pnpm -r` to run workspace tasks in dependency order. Packages
without the requested script (such as `packages/config`) are skipped, and the
workspace root is excluded to avoid recursion. Development uses
`pnpm -r --parallel dev` so the long-running API and Vite server start together
instead of waiting for another process to finish. No separate task runner or task
cache is configured.

The JavaScript tooling was checked on Node.js 26.3.1 and PNPM 12.10.1 on Android
arm64. The same root commands, including `pnpm validate`, work under Termux;
no platform-specific validation sequence is required.
