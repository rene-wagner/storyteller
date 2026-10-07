# Storyteller

Repository foundation for an audio drama application. Only Phase 1
(TASK-001–TASK-003) of `docs/development/ROADMAP.md` is implemented.

## Requirements and setup

- Node.js 24 or newer
- PNPM 12 (the exact development version is recorded in `packageManager`)
- For Turbo-backed commands: Linux, macOS or Windows
- Under Termux: use the individual validation steps below instead of Turbo

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

| Command             | Purpose                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`          | Run the API compiler watcher and the Vite frontend development server through Turbo |
| `pnpm build`        | Compile the API probe and typecheck/bundle the Vue frontend probe through Turbo     |
| `pnpm lint`         | Run Oxlint for both apps through Turbo, then root tests; check Oxfmt formatting     |
| `pnpm typecheck`    | Check both apps through Turbo, including Vue single-file components                 |
| `pnpm test`         | Run repository-configuration tests using Node's built-in test runner                |
| `pnpm format:check` | Check formatting without changing files                                             |
| `pnpm format`       | Format owned source and configuration files                                         |
| `pnpm validate`     | Run lint, typecheck, tests and build in that order; stop on failure                 |

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
Turbo cache, dependencies, coverage and TypeScript build information are ignored.
`AGENTS.md` and `docs/` are excluded from automatic formatting.

## Code quality

Oxlint uses its correctness rules with the native TypeScript and Vue plugins.
Explicit `any`, unused variables, `var` and avoidable `let` declarations are
rejected. Both apps and the root tests use the shared configuration; lint warnings
also fail validation. `pnpm lint:root` checks the root tests independently of Turbo.
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

## Termux / Android validation

The JavaScript tooling was checked on Node.js 26.3.1 and PNPM 12.10.1 on Android
arm64. Installation succeeds, but Turbo 2.11.7 installs a Linux arm64 executable
that Android cannot run (`unexpected e_type: 2`). Consequently, the root
Turbo-backed commands, including `pnpm validate`, are environment-blocked here;
use the accepted individual validation sequence instead.

Run each command separately from the repository root and check its exit status:

```sh
pnpm -r lint
pnpm lint:root
pnpm format:check
pnpm -r typecheck
pnpm test
pnpm -r build
```

If every command exits successfully, this counts as successful final validation
under Termux and satisfies the repository's validation requirement. No additional
`pnpm validate` attempt or run on another device is required. A failed or unavailable
check still means validation has not passed.

Report `Validate: PASS (Termux: individual checks without Turbo)` and list the
commands executed. This validates the underlying checks, not Turbo orchestration
or caching. Keep the sequence aligned with the root scripts when checks change;
on supported platforms, continue to use `pnpm validate`.
