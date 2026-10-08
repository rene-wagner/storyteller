# Storyteller

Repository foundation for an audio drama application. Only Phase 1
(TASK-001–TASK-003) of `docs/development/ROADMAP.md` is implemented.

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

| Command             | Purpose                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`          | Run the API compiler watcher and Vite development server in parallel via PNPM  |
| `pnpm build`        | Compile the API probe and typecheck/bundle the Vue frontend via recursive PNPM |
| `pnpm lint`         | Lint both apps via recursive PNPM, then lint root tests and check formatting   |
| `pnpm typecheck`    | Check both apps via recursive PNPM, including Vue single-file components       |
| `pnpm test`         | Run repository-configuration tests once using Vitest                           |
| `pnpm format:check` | Check formatting without changing files                                        |
| `pnpm format`       | Format owned source and configuration files                                    |
| `pnpm validate`     | Run lint, typecheck, tests and build in that order; stop on failure            |

## Structure and scope

- `apps/api`: a Node TypeScript compiler probe, not a Fastify application.
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

There are no routes, environment validation, database connections, domain/UI
features or dependencies for later roadmap phases. Compiler output (`dist`),
dependencies, coverage and TypeScript build information are ignored.
`AGENTS.md` and `docs/` are excluded from automatic formatting.

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

Backend API and Vue component test infrastructure remain future roadmap tasks.

## Workspace execution and Termux

Root scripts use `pnpm -r` to run workspace tasks in dependency order. Packages
without the requested script (such as `packages/config`) are skipped, and the
workspace root is excluded to avoid recursion. Development uses
`pnpm -r --parallel dev` so long-running watchers start together instead of
waiting for another watcher to finish. No separate task runner or task cache is
configured.

The JavaScript tooling was checked on Node.js 26.3.1 and PNPM 12.10.1 on Android
arm64. The same root commands, including `pnpm validate`, work under Termux;
no platform-specific validation sequence is required.
