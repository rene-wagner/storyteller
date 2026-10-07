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
are pinned; TypeScript 5.9 is used for compatibility with Vue's checker and the
TypeScript ESLint tooling.

## Commands

| Command             | Purpose                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev`          | Run both compiler watchers through Turbo; no HTTP server or UI dev server yet                          |
| `pnpm build`        | Compile the API probe to JavaScript and emit the web probe's TypeScript/Vue declarations through Turbo |
| `pnpm lint`         | Lint both apps through Turbo, then root tooling/tests; check formatting                                |
| `pnpm typecheck`    | Check both apps through Turbo, including Vue single-file components                                    |
| `pnpm test`         | Run repository-configuration tests using Node's built-in test runner                                   |
| `pnpm format:check` | Check formatting without changing files                                                                |
| `pnpm format`       | Format owned source and configuration files                                                            |
| `pnpm validate`     | Run lint, typecheck, tests and build in that order; stop on failure                                    |

## Structure and scope

- `apps/api`: a Node TypeScript compiler probe, not a Fastify application.
- `apps/web`: TypeScript and Vue `<script setup>` compiler probes, not a runnable
  frontend. Its build emits declarations only; it does not bundle a website.
- `packages/config`: shared strict TypeScript base, Node and Vue configurations,
  consumed through workspace dependencies by both apps.
- `eslint.config.mjs` and `.prettierrc.json`: common code-quality settings.
- `tests/repository.test.mjs`: workspace/task wiring, effective compiler settings
  (including rejected invalid types and isolated Node/browser globals), Vue/TS
  lint rules and ignore-policy checks.

There are no routes, environment validation, database connections, domain/UI
features or dependencies for later roadmap phases. Compiler output (`dist`),
Turbo cache, dependencies, coverage and TypeScript build information are ignored.
`AGENTS.md` and `docs/` are excluded from automatic formatting.

## Termux / Android validation

The JavaScript tooling was checked on Node.js 26.3.1 and PNPM 12.10.1 on Android
arm64. Installation succeeds, but Turbo 2.11.7 installs a Linux arm64 executable
that Android cannot run (`unexpected e_type: 2`). Consequently, the root
Turbo-backed commands, including `pnpm validate`, are environment-blocked here;
use the accepted individual validation sequence instead.

Run each command separately from the repository root and check its exit status:

```sh
pnpm -r lint
pnpm exec eslint eslint.config.mjs tests
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
