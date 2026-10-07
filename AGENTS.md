AGENTS.md

This file defines the global working rules for coding agents in this repository.

Follow the closest "AGENTS.md" file for code-specific instructions. A nested "AGENTS.md" can add or override rules for its directory scope.

Task-specific instructions in the current prompt take precedence over this file.

---

Project Overview

This repository contains an application for creating and managing audio drama projects.

Users can manage:

- audio drama projects;
- characters;
- episodes;
- scenes;
- cue points;
- background music;
- sound effects.

The primary domain hierarchy is:

Project
└── Episode
    └── Scene
        └── Cue Point

Characters belong to projects.

Media items are managed independently in a shared media library.

Scenes can reference background music.

Cue points can reference characters and zero or more sound effects.

The application is currently a single-user application. Authentication, collaboration, audio rendering, text-to-speech, and remote media storage are outside the current MVP scope unless a task explicitly adds them.

---

Technology Stack

Monorepo

- PNPM
- Turbo
- TypeScript

Frontend

- Vue 3
- Composition API
- Vue Router
- Pinia
- TanStack Vue Query
- Tailwind CSS 4

Backend

- Node.js
- TypeScript
- Fastify
- Zod
- PostgreSQL
- Drizzle ORM

Media Storage

The current implementation stores media files locally.

Storage access MUST use a storage abstraction.

Business logic MUST NOT depend directly on local file system paths or Node.js file system APIs.

The architecture must permit a later remote storage implementation.

---

Repository Structure

The repository follows this general structure:

apps/
  web/                  Frontend application
  api/                  Backend application

packages/
  shared/               Shared types, schemas, constants, or utilities
  config/               Shared development configuration when applicable

docs/                   Architecture and project documentation when applicable

tests/                  Cross-application integration or E2E tests when applicable

Do not create a new package only to hold one small helper.

Prefer an existing package if the responsibility already fits there.

Shared packages MUST NOT depend on "apps/web" or "apps/api".

Application packages MAY depend on shared packages.

---

Development Commands

Run commands from the repository root unless a task explicitly requires otherwise.

Install dependencies

pnpm install

Start development mode

pnpm dev

Build

pnpm build

Run tests

pnpm test

Type checking

pnpm typecheck

Linting

pnpm lint

Full validation

pnpm validate

"pnpm validate" is the final repository-level validation command on platforms supported by Turbo.

Under Termux, agents MUST run each validation step separately from the repository root, without Turbo:

pnpm -r lint
pnpm exec eslint eslint.config.mjs tests
pnpm format:check
pnpm -r typecheck
pnpm test
pnpm -r build

Run every command individually and record its result. All commands MUST exit successfully for validation to pass. This sequence counts as successful final repository-level validation under Termux and satisfies the validation requirement in the Definition of Done; running "pnpm validate" or obtaining an additional run on another device is not required.

Keep this sequence aligned with the checks in the root validation scripts when they change. It does not verify Turbo orchestration or caching. Outside Termux, continue to use "pnpm validate".

It SHOULD execute the relevant CI-level checks, including at least:

lint
typecheck
test
build

If "pnpm validate" does not exist yet and the current task concerns repository setup, add it.

Do not state that a command passed unless you actually executed it successfully.

---

Architecture Rules

General

Maintain clear separation between:

UI
→ API client
→ HTTP API
→ Application / service logic
→ Persistence or storage adapters

Dependencies SHOULD point toward stable domain and shared abstractions.

Do not bypass an existing abstraction only because direct access is shorter.

Do not create parallel abstractions for responsibilities that already have an established implementation.

---

Frontend Architecture

Server state MUST use TanStack Vue Query where practical.

Examples of server state include:

- projects;
- characters;
- episodes;
- scenes;
- cue points;
- media items.

Do not copy server-managed entities into Pinia without a concrete reason.

Pinia SHOULD contain client-side state such as:

- UI preferences;
- transient application state;
- state shared between unrelated components that is not server state.

Vue components SHOULD use the Composition API.

Reusable UI behavior SHOULD use reusable components or composables.

Components MUST NOT contain duplicated low-level API request logic.

Use the shared API client.

Pages SHOULD orchestrate data and user interaction.

Reusable presentational behavior SHOULD remain in components where practical.

Do not introduce animations unless the task explicitly requires them.

Use Tailwind CSS 4 for application styling.

Do not introduce a second styling system without explicit justification.

---

Backend Architecture

Fastify route handlers SHOULD contain request-level orchestration only.

Route handlers SHOULD NOT contain substantial business logic.

Prefer this dependency flow:

Route
→ Validation
→ Service
→ Repository / Storage

External input MUST be validated.

Use Zod for request validation where applicable.

Database access MUST use Drizzle ORM.

Do not add direct SQL outside the established database layer unless the task requires it and the reason is documented.

Business logic MUST NOT depend directly on Fastify request or response objects.

Storage business logic MUST NOT depend directly on the local file system implementation.

---

Database Rules

Database changes MUST use migrations.

Do not manually change the database schema without a migration.

Relations MUST maintain referential integrity.

Do not create orphan records.

Ordering of:

- episodes;
- scenes;
- cue points

MUST persist in the database.

Use explicit position data for ordered entities.

Do not rely on insertion order or database return order.

Foreign-key deletion behavior MUST be intentional.

Before adding cascade deletion, verify that deleting the parent is expected to delete its children.

Media deletion MUST NOT leave invalid references.

Referenced media SHOULD be protected from deletion unless a task explicitly defines another policy.

---

Media Storage Rules

Application and domain code MUST use the media storage abstraction.

Do not:

- store absolute local file paths as domain identifiers;
- expose internal storage paths through the API;
- use arbitrary user-provided paths;
- access the local media directory outside the local storage adapter.

Use storage keys to identify stored files.

File names and storage keys MUST be safe against path traversal.

If file storage succeeds but database persistence fails, clean up the stored file where practical.

If database deletion succeeds only together with file deletion, handle partial failure intentionally.

---

API Rules

Use consistent resource naming.

Use consistent error responses.

Expected error structure:

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": []
  }
}

Do not expose:

- stack traces;
- database internals;
- absolute file paths;
- secrets;
- implementation details that are not useful to API consumers.

Use suitable HTTP status codes.

Examples:

200  Successful read or update
201  Successful creation
204  Successful deletion without response body
400  Invalid request
404  Resource not found
409  Resource conflict
500  Unexpected server failure

Do not silently convert failed operations into successful responses.

---

TypeScript Rules

TypeScript strict mode MUST remain enabled.

Avoid "any".

Use "unknown" for untrusted values until they are validated or narrowed.

Prefer explicit types at public boundaries, including:

- exported functions;
- service interfaces;
- API contracts;
- storage interfaces;
- repository interfaces.

Do not create duplicate handwritten types when they can safely be inferred from an existing Zod or Drizzle definition.

Avoid unsafe type assertions.

Do not use a type assertion to hide a real type error.

---

Coding Conventions

Inspect nearby code before creating new conventions.

Follow existing:

- file naming;
- symbol naming;
- directory structure;
- test patterns;
- error handling patterns.

Prefer small functions with one clear responsibility.

Prefer clear names over comments that explain unclear code.

Comments SHOULD explain decisions or constraints, not restate the code.

Do not introduce a dependency when the platform, framework, or an existing dependency already provides an adequate solution.

New runtime dependencies require a concrete justification.

Do not update unrelated dependencies as part of a feature task.

Do not perform broad formatting changes in unrelated files.

---

Change Rules

For every task:

1. Read the task completely.
2. Inspect the relevant existing implementation.
3. Check for a closer "AGENTS.md".
4. Identify the smallest coherent change.
5. Implement only the requested behavior.
6. Update or add relevant tests.
7. Run checks closest to the changed code.
8. Run the required final validation.
9. Review the diff for unrelated changes.
10. Report what was changed and verified.

Do not implement future roadmap tasks unless they are necessary for the current task.

Do not perform unrelated refactoring.

Do not rename or reorganize unrelated files.

Preserve existing behavior unless the task explicitly changes it.

Preserve backwards compatibility where practical.

If a public contract changes, update all affected consumers and documentation in the same task.

---

Scope Control

The current roadmap defines the intended implementation sequence.

When a task identifies one roadmap item, implement that item only.

Do not preemptively implement later features.

In particular, do not add these features unless explicitly requested:

- authentication;
- authorization;
- multi-user support;
- collaboration;
- text-to-speech;
- audio generation;
- audio mixing;
- final audio rendering;
- remote Hetzner storage;
- drag-and-drop ordering;
- animation frameworks;
- version history.

A future requirement is not a reason to implement a feature early.

Design for a known extension only when this does not materially increase current complexity.

---

Testing Requirements

New behavior requires tests when the behavior can reasonably be automated.

Bug fixes SHOULD include a regression test.

Tests SHOULD verify externally visible behavior instead of implementation details.

Run the most specific relevant tests first.

Examples:

pnpm --filter <package> test

Then run broader validation as appropriate.

Before task completion, run "pnpm validate", or, under Termux, every individual command in the Development Commands validation sequence.

The Termux sequence is an accepted validation path, not skipped validation. If any required check fails or cannot run, validation is not successful; report:

- which checks failed or could not run;
- why;
- which checks passed.

For other environment limitations preventing full validation, report:

- which command could not run;
- why it could not run;
- which checks were run instead.

Do not:

- delete tests to make a build pass;
- weaken assertions to hide failures;
- skip validation without reporting it;
- claim tests passed when they were not executed.

---

Security and Safety

Treat all user-controlled input as untrusted.

Never commit:

- passwords;
- API keys;
- access tokens;
- private keys;
- production credentials;
- secrets in example configuration.

Use environment variables for sensitive configuration.

Do not log secrets or credentials.

Do not expose server file paths to clients.

Validate uploaded file metadata and file handling inputs.

Prevent path traversal in media storage.

Do not bypass validation to make tests pass.

Do not disable security checks as a workaround.

Do not modify production infrastructure unless the task explicitly requires it.

Do not add authentication or authorization implementations unless explicitly requested.

---

Dependency Rules

Before adding a dependency:

1. Check whether the repository already provides equivalent functionality.
2. Check whether the framework or standard library provides it.
3. Verify that the dependency is necessary for the current task.

Prefer established dependencies already used by the repository.

Do not add overlapping libraries for the same responsibility without a documented reason.

Do not perform major dependency upgrades as part of an unrelated task.

---

Documentation Rules

"AGENTS.md" contains working rules for agents.

Do not turn it into general system documentation.

Put detailed architecture documentation in:

docs/architecture/

Put API documentation in the applicable API documentation location.

Use code and tests as the authoritative source for implementation behavior.

Update documentation when a task changes:

- public APIs;
- setup requirements;
- development commands;
- architecture boundaries;
- externally visible behavior.

Do not duplicate large amounts of information across documentation files.

---

Git Rules

Keep changes focused on the current task.

Do not modify unrelated files.

Do not rewrite existing commits unless explicitly requested.

Do not force-push.

Do not discard existing user changes.

Do not revert code that you did not create unless the current task explicitly requires it.

Review the final diff before completion.

Generated files SHOULD only be committed if repository conventions require them.

---

Pull Request Expectations

When preparing a pull request description, include:

What changed

Describe the implemented behavior.

Why

Explain the reason for the change.

Verification

List the commands and tests that were actually executed.

Limitations

List known limitations or follow-up work.

Do not include unrelated roadmap work in the same pull request.

---

Definition of Done

A task is complete only when all applicable conditions are true:

- the requested behavior is implemented;
- acceptance criteria are satisfied;
- architecture rules are respected;
- input validation is implemented where required;
- relevant tests exist;
- relevant tests pass;
- type checking passes;
- linting passes;
- the application builds;
- documentation is updated when necessary;
- no unrelated changes are included;
- the final diff was reviewed.

The default final repository check is "pnpm validate". Under Termux, successful execution of every individual validation step listed in Development Commands is equivalent for task completion.

Do not mark a task complete when known failures caused by the task remain.

---

Agent Completion Report

At the end of every implementation task, report the following.

Summary

Describe what was implemented.

Files Changed

List the important files that were added, removed, or modified.

Design Decisions

List relevant architectural or implementation decisions.

Do not list trivial coding choices.

Validation

Report the commands that were actually executed.

Use this format:

Lint:       PASS | FAIL | NOT RUN
Typecheck:  PASS | FAIL | NOT RUN
Tests:      PASS | FAIL | NOT RUN
Build:      PASS | FAIL | NOT RUN
Validate:   PASS | FAIL | NOT RUN

Under Termux, report "Validate: PASS" only when every required individual validation command passed, and state "Termux: individual checks without Turbo". List the commands actually executed; do not claim that "pnpm validate" itself ran or that Turbo was verified.

Add relevant details for failed or skipped checks.

Remaining Issues

List only:

- known limitations;
- unresolved problems;
- required follow-up work.

Do not implement unrelated follow-up work without a separate task.

If no relevant issues remain, state:

None.

---

Final Agent Principle

Prefer the smallest correct implementation that satisfies the current task and fits the existing architecture.

Do not optimize for the largest possible change.

Optimize for:

correctness
→ maintainability
→ testability
→ consistency
→ minimal scope

