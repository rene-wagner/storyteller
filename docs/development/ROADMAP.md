Audio Drama Application

Sequential Implementation Roadmap

1. Purpose

This roadmap divides the implementation into small and ordered tasks.

Each task is intended to be completed by an AI coding agent.

The agent shall complete one task before it starts the next task.

Each task shall:

- have a limited scope;
- produce a testable result;
- avoid unrelated changes;
- use the existing project architecture;
- keep the application in a working state.

The implementation shall use:

Monorepo

- PNPM
- Turbo

Frontend

- Vue 3
- Vite
- Composition API
- TypeScript
- Pinia
- Vue Router
- Tailwind CSS 4
- TanStack Vue Query

Backend

- Node.js
- TypeScript
- Fastify
- Zod
- PostgreSQL
- Drizzle ORM

---

Phase 1 — Repository Foundation

TASK-001 — Initialize the Monorepo

Goal

Create the basic repository structure.

Tasks

- Initialize a PNPM workspace.
- Configure Turbo.
- Create these directories:

apps/
  web/
  api/

packages/

- Add the root "package.json".
- Add "pnpm-workspace.yaml".
- Add "turbo.json".
- Add root scripts for:
  - development;
  - build;
  - lint;
  - type checking;
  - testing.

Result

The monorepo can install dependencies and run Turbo commands.

Definition of Done

- "pnpm install" completes successfully.
- "pnpm build" can execute through Turbo.
- "pnpm typecheck" can execute through Turbo.
- No application features are required.

---

TASK-002 — Add Shared TypeScript Configuration

Goal

Create consistent TypeScript configuration for all packages and applications.

Tasks

- Create a shared TypeScript configuration package.
- Add base TypeScript settings.
- Configure Node.js settings for the backend.
- Configure Vue settings for the frontend.
- Use Vite with the Vue plugin for frontend development and production bundling; retain separate type checking.
- Keep the Node.js API on the TypeScript compiler and configuration-only packages unbundled. Use Vite library mode only for packages that need bundled distributable code.
- Make "apps/web" and "apps/api" use the shared configuration.

Result

Frontend and backend use compatible TypeScript settings.

Definition of Done

- Both applications compile without TypeScript configuration errors.
- The configuration does not duplicate unnecessary settings.

---

TASK-003 — Add Shared Code Quality Configuration

Goal

Create common linting and formatting rules.

Tasks

- Configure Oxlint for JavaScript, TypeScript and Vue script blocks (Vue template linting is not currently supported).
- Configure Oxfmt formatting rules.
- Add scripts for linting.
- Add ignore rules for generated files.
- Apply the configuration to frontend and backend code.

Result

The repository has one consistent code style.

Definition of Done

- "pnpm lint" completes successfully.
- Existing source files have no lint errors.

---

Phase 2 — Backend Foundation

TASK-004 — Initialize the Fastify Backend

Goal

Create a minimal backend application.

Tasks

- Initialize "apps/api".
- Install Fastify.
- Add TypeScript support.
- Create the Fastify application.
- Create a server entry point.
- Add environment configuration.
- Add a health endpoint:

GET /health

Expected Response

{
  "status": "ok"
}

Definition of Done

- The API starts locally.
- "GET /health" returns HTTP 200.
- The application shuts down correctly.

---

TASK-005 — Configure Backend Environment Validation

Goal

Validate backend environment variables.

Tasks

- Add Zod.
- Define an environment schema.
- Validate environment variables at application startup.
- Add configuration for:
  - server port;
  - database URL;
  - media storage directory.

Definition of Done

- The backend does not start with invalid configuration.
- Configuration errors contain clear messages.
- Application code uses validated configuration values.

---

Phase 3 — Database Foundation

TASK-006 — Configure PostgreSQL and Drizzle

Goal

Connect the backend to PostgreSQL.

Tasks

- Install Drizzle ORM.
- Install the PostgreSQL driver.
- Configure Drizzle.
- Create the database connection module.
- Add migration configuration.
- Add migration scripts.

Definition of Done

- The backend can connect to PostgreSQL.
- A migration can be generated.
- A migration can be applied.

---

TASK-007 — Create the Project Database Schema

Goal

Add the first domain entity.

Project Fields

- "id"
- "title"
- "genre"
- "description"
- "createdAt"
- "updatedAt"

Tasks

- Create the Drizzle project schema.
- Add required database constraints.
- Create and apply the migration.

Definition of Done

- The "projects" table exists.
- Required fields cannot contain null values.
- Project IDs are unique.

---

TASK-008 — Create the Character Database Schema

Goal

Store project characters.

Character Fields

- "id"
- "projectId"
- "name"
- "type"
- "createdAt"
- "updatedAt"

Character Types

- "main"
- "supporting"

Tasks

- Create the character schema.
- Add the project relation.
- Add the character type constraint.
- Add cascade behavior where appropriate.
- Create and apply the migration.

Definition of Done

- Characters belong to a project.
- Removing a project cannot leave orphan character records.

---

TASK-009 — Create the Episode Database Schema

Fields

- "id"
- "projectId"
- "title"
- "description"
- "position"
- "createdAt"
- "updatedAt"

Tasks

- Create the episode schema.
- Add its project relation.
- Add sequence information through "position".
- Add suitable indexes.
- Create and apply the migration.

Definition of Done

- Episodes belong to exactly one project.
- Episodes can be sorted by "position".

---

TASK-010 — Create the Scene Database Schema

Fields

- "id"
- "episodeId"
- "title"
- "backgroundMusicId"
- "position"
- "createdAt"
- "updatedAt"

Tasks

- Create the scene schema.
- Add the episode relation.
- Keep "backgroundMusicId" nullable for now.
- Add sequence information.
- Create and apply the migration.

Definition of Done

- Scenes belong to exactly one episode.
- A scene can exist without background music.

---

TASK-011 — Create the Cue Point Database Schema

Fields

- "id"
- "sceneId"
- "characterId"
- "spokenText"
- "position"
- "createdAt"
- "updatedAt"

Tasks

- Create the cue point schema.
- Add the scene relation.
- Add the character relation.
- Add sequence information.
- Create and apply the migration.

Definition of Done

- Cue points belong to exactly one scene.
- Cue points can be sorted by "position".

---

TASK-012 — Create the Media Item Database Schema

Fields

- "id"
- "name"
- "type"
- "fileName"
- "storageKey"
- "mimeType"
- "fileSize"
- "createdAt"
- "updatedAt"

Media Types

- "background_music"
- "sound_effect"

Tasks

- Create the media item schema.
- Add media type validation at database level where practical.
- Create and apply the migration.

Definition of Done

- Media metadata can be stored independently from projects.

---

TASK-013 — Create Cue Point Sound Effect Relations

Goal

Allow one cue point to use multiple sound effects.

Tasks

Create a join table between:

- cue points;
- media items.

The relation MUST support:

- zero or more sound effects per cue point;
- the same sound effect in multiple cue points.

Definition of Done

- Cue points can reference multiple media items.
- Only media items can be referenced.

---

TASK-014 — Add Scene Background Music Relation

Goal

Connect scene background music to the media library.

Tasks

- Add the foreign key from scenes to media items.
- Keep the relation optional.
- Define suitable deletion behavior.

Definition of Done

- A scene can reference one media item.
- A scene remains valid without background music.

---

Phase 4 — Shared Validation and API Foundation

TASK-015 — Create Shared Domain Schemas

Goal

Share validation definitions where this reduces duplication.

Tasks

Create a shared package for applicable:

- Zod schemas;
- request types;
- response types;
- domain constants.

Create schemas for:

- projects;
- characters;
- episodes;
- scenes;
- cue points;
- media item metadata.

Definition of Done

- Frontend and backend can import shared types.
- Backend input validation uses the shared schemas where applicable.

---

TASK-016 — Create Standard API Error Handling

Goal

Use one error format for backend responses.

Error Format

Example:

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": []
  }
}

Tasks

- Add a global Fastify error handler.
- Handle validation errors.
- Handle not-found errors.
- Handle conflict errors.
- Handle unexpected errors.

Definition of Done

- API errors use a consistent structure.
- Internal stack traces are not sent to the frontend.

---

Phase 5 — Project API

TASK-017 — Implement Project Create API

Endpoint

POST /projects

Tasks

- Validate input.
- Create the project.
- Require:
  - title;
  - genre;
  - description.
- Return the created project.

Definition of Done

- Valid requests return the created project.
- Invalid requests return HTTP 400.
- The project persists in PostgreSQL.

---

TASK-018 — Implement Project Read APIs

Endpoints

GET /projects
GET /projects/:projectId

Tasks

- Return all projects.
- Sort the project list by modification date.
- Return one project by ID.
- Return HTTP 404 for unknown IDs.

---

TASK-019 — Implement Project Update API

Endpoint

PATCH /projects/:projectId

Tasks

- Validate updates.
- Update the modification date.
- Return the updated project.
- Handle unknown project IDs.

---

TASK-020 — Implement Project Delete API

Endpoint

DELETE /projects/:projectId

Tasks

- Delete the project.
- Delete dependent domain data correctly.
- Return a suitable success response.

Definition of Done

No orphan:

- characters;
- episodes;
- scenes;
- cue points

remain after deletion.

---

Phase 6 — Character API

TASK-021 — Implement Character CRUD API

Endpoints

GET    /projects/:projectId/characters
POST   /projects/:projectId/characters
PATCH  /characters/:characterId
DELETE /characters/:characterId

Tasks

- Validate character data.
- Support "main" and "supporting" character types.
- Verify project ownership.
- Handle character deletion safely.

Definition of Done

The API supports complete character management.

---

Phase 7 — Episode API

TASK-022 — Implement Episode CRUD API

Endpoints

GET    /projects/:projectId/episodes
POST   /projects/:projectId/episodes
GET    /episodes/:episodeId
PATCH  /episodes/:episodeId
DELETE /episodes/:episodeId

Tasks

- Implement CRUD.
- Validate parent project IDs.
- Assign a default position to new episodes.
- Return episodes in position order.

---

TASK-023 — Implement Episode Reordering API

Goal

Allow the frontend to change episode order.

Tasks

Create an endpoint such as:

PUT /projects/:projectId/episodes/order

Accept an ordered list of episode IDs.

Definition of Done

- All supplied episode IDs belong to the project.
- Positions are updated in one safe operation.
- Reloading preserves the order.

---

Phase 8 — Scene API

TASK-024 — Implement Scene CRUD API

Endpoints

GET    /episodes/:episodeId/scenes
POST   /episodes/:episodeId/scenes
GET    /scenes/:sceneId
PATCH  /scenes/:sceneId
DELETE /scenes/:sceneId

Tasks

- Implement CRUD.
- Validate episode ownership.
- Support optional background music.
- Return scenes in position order.

---

TASK-025 — Implement Scene Reordering API

Tasks

Create an endpoint such as:

PUT /episodes/:episodeId/scenes/order

Definition of Done

Scene order remains stable after reload.

---

Phase 9 — Cue Point API

TASK-026 — Implement Cue Point CRUD API

Endpoints

GET    /scenes/:sceneId/cue-points
POST   /scenes/:sceneId/cue-points
GET    /cue-points/:cuePointId
PATCH  /cue-points/:cuePointId
DELETE /cue-points/:cuePointId

Tasks

- Validate scene ownership.
- Validate character references.
- Store spoken text.
- Return cue points in position order.

---

TASK-027 — Implement Cue Point Sound Effect Assignment

Tasks

Support assignment of:

soundEffectIds: string[]

Validate that all referenced media items:

- exist;
- have type "sound_effect".

Definition of Done

A cue point can contain zero or more sound effects.

---

TASK-028 — Implement Cue Point Reordering API

Tasks

Create an endpoint such as:

PUT /scenes/:sceneId/cue-points/order

Definition of Done

Cue point order persists after reload.

---

Phase 10 — Media Storage

TASK-029 — Create the Media Storage Abstraction

Goal

Separate physical file storage from business logic.

Interface

The storage service should provide operations comparable to:

interface MediaStorage {
  save(...)
  delete(...)
  get(...)
}

Tasks

- Define a storage interface.
- Do not use local file system APIs outside the storage implementation.
- Use storage keys instead of absolute file paths in domain logic.

Definition of Done

Business services do not know how files are physically stored.

---

TASK-030 — Implement Local Media Storage

Tasks

- Create a local file storage implementation.
- Use the configured media directory.
- Generate safe unique storage keys.
- Prevent unsafe path traversal.
- Support file deletion.

Definition of Done

Media files can be written and removed locally.

---

TASK-031 — Implement Media Upload API

Endpoint

POST /media

Tasks

- Accept multipart file uploads.
- Require a media type.
- Store the file through the storage abstraction.
- Store metadata in PostgreSQL.
- Return the new media item.
- Clean up the stored file if database persistence fails.

Definition of Done

A user can upload one audio file and receive a media item.

---

TASK-032 — Implement Media CRUD API

Endpoints

GET    /media
GET    /media/:mediaId
PATCH  /media/:mediaId
DELETE /media/:mediaId

Tasks

- List media items.
- Filter by media type.
- Update media metadata.
- Delete metadata and physical files safely.

---

TASK-033 — Implement Media Reference Protection

Goal

Prevent invalid references after media deletion.

Tasks

Before deletion:

- detect scene references;
- detect cue point references.

Choose and implement a consistent deletion policy.

Recommended MVP policy:

- prevent deletion while the media item is in use;
- return usage information to the frontend.

Definition of Done

Deleting a media item cannot create invalid domain references.

---

Phase 11 — Frontend Foundation

TASK-034 — Initialize the Vue Frontend

Tasks

- Initialize Vue 3.
- Use TypeScript.
- Use Composition API.
- Extend the existing Vite development server and Vue tooling probe.
- Add the base application shell.

Definition of Done

The frontend starts and displays the application shell.

---

TASK-035 — Configure Tailwind CSS 4

Tasks

- Install Tailwind CSS 4.
- Integrate Tailwind with the Vite frontend build.
- Create base design tokens.
- Use:
  - black;
  - white;
  - gray;
  - semantic status colors.

Definition of Done

The application can use Tailwind utility classes.

---

TASK-036 — Configure Vue Router

Routes

Add at least:

/
 /projects
 /projects/new
 /projects/:projectId
 /media

Definition of Done

The user can navigate between projects and the media library.

---

TASK-037 — Configure TanStack Vue Query

Tasks

- Install TanStack Vue Query.
- Configure the query client.
- Add global defaults.
- Configure error handling where practical.

Definition of Done

Server state can use queries and mutations.

---

TASK-038 — Configure Pinia

Goal

Use Pinia only for applicable client state.

Tasks

- Install Pinia.
- Register it with Vue.
- Do not duplicate API data in Pinia.

Definition of Done

Pinia is available for UI and client state.

---

TASK-039 — Create the Frontend API Client

Tasks

Create one reusable API client.

It shall support:

- JSON requests;
- multipart uploads;
- standard API errors;
- typed responses.

Definition of Done

Components do not manually duplicate low-level fetch logic.

---

Phase 12 — Shared UI Components

TASK-040 — Create Base Form Components

Components

Create reusable components for:

- text input;
- textarea;
- select;
- form field;
- validation message;
- button;
- checkbox where required.

Definition of Done

Forms use consistent components.

---

TASK-041 — Create Base Feedback Components

Components

Create:

- alert;
- error state;
- empty state;
- loading state;
- confirmation dialog.

Definition of Done

CRUD screens can use consistent feedback patterns.

---

TASK-042 — Create Accordion Components

Goal

Support hierarchical project editing.

Tasks

Create reusable:

- accordion;
- accordion item;
- accordion header;
- accordion content.

Requirements

- Support keyboard interaction.
- Clearly show expanded and collapsed state.
- Do not require animations.

---

TASK-043 — Create Application Layout and Navigation

Tasks

Create:

- application shell;
- primary navigation;
- content container;
- page header.

Navigation shall include:

- Projects
- Media Library

Definition of Done

Primary areas have consistent navigation.

---

Phase 13 — Project Frontend

TASK-044 — Implement Project List Page

Route

/projects

Tasks

- Load projects with TanStack Vue Query.
- Show:
  - title;
  - genre;
  - modification date.
- Add empty state.
- Add create-project action.
- Add loading and error states.

---

TASK-045 — Implement Project Creation Page

Route

/projects/new

Tasks

Create fields for:

- title;
- genre;
- description.

Implement:

- client validation;
- API mutation;
- backend error handling;
- redirect after successful creation.

---

TASK-046 — Implement Project Detail Page

Route

/projects/:projectId

Tasks

- Load project data.
- Display project metadata.
- Provide edit functionality.
- Provide delete functionality.
- Show project characters.
- Show project episodes.

---

Phase 14 — Character Frontend

TASK-047 — Implement Character Management UI

Tasks

Inside the project detail page:

- list characters;
- add a character;
- edit a character;
- delete a character;
- show character type.

Definition of Done

Main and supporting characters can be managed without leaving the project.

---

Phase 15 — Episode Frontend

TASK-048 — Implement Episode List

Tasks

- Load project episodes.
- Show them in position order.
- Use accordion components.
- Add empty state.
- Add create action.

---

TASK-049 — Implement Episode Create and Edit UI

Fields

- title;
- description.

Tasks

- Add episode creation.
- Add episode editing.
- Add validation.
- Add delete confirmation.

---

TASK-050 — Implement Episode Reordering UI

Goal

Allow order changes without drag-and-drop.

Recommended MVP Controls

- Move up
- Move down

Definition of Done

The user can change episode order.

---

Phase 16 — Scene Frontend

TASK-051 — Implement Scene List

Tasks

Inside each episode:

- load scenes;
- show scenes in position order;
- use nested accordions;
- add a create-scene action.

---

TASK-052 — Implement Scene Create and Edit UI

Fields

- title;
- background music.

Tasks

- Load background music from the media library.
- Show only "background_music" media items.
- Allow no background music.
- Add create, edit, and delete operations.

---

TASK-053 — Implement Scene Reordering UI

Tasks

Add:

- Move up
- Move down

Persist the new order through the API.

---

Phase 17 — Cue Point Frontend

TASK-054 — Implement Cue Point List

Tasks

Inside each scene:

- load cue points;
- show cue points in position order;
- provide an add action;
- provide edit and delete actions.

---

TASK-055 — Implement Cue Point Editor

Fields

- character;
- spoken text;
- sound effects.

Tasks

- Load applicable characters.
- Load sound effects.
- Show only media items of type "sound_effect".
- Support multiple selected sound effects.
- Save through the API.

---

TASK-056 — Implement Cue Point Reordering UI

Tasks

Add:

- Move up
- Move down

Definition of Done

The user can define the final cue point sequence.

---

Phase 18 — Media Library Frontend

TASK-057 — Implement Media Library Page

Route

/media

Tasks

- Load all media items.
- Show:
  - name;
  - media type;
  - file name;
  - creation date.
- Add loading state.
- Add empty state.
- Add error state.

---

TASK-058 — Implement Media Upload UI

Tasks

Create an upload form with:

- file selection;
- media name;
- media type.

Media types:

- Background Music
- Sound Effect

Definition of Done

The user can upload an audio file from the frontend.

---

TASK-059 — Implement Media Filtering

Tasks

Add filters for:

- All
- Background Music
- Sound Effects

Filtering MAY use the existing API query parameter.

---

TASK-060 — Implement Media Edit and Delete UI

Tasks

- Edit media name.
- Delete unused media items.
- Show confirmation before deletion.
- Show usage information when deletion is blocked.

---

Phase 19 — UX Integration

TASK-061 — Add Global User Feedback

Tasks

Add consistent feedback for:

- successful creation;
- successful update;
- successful deletion;
- upload success;
- request errors.

Requirements

Notifications must be simple.

No animation framework is required.

---

TASK-062 — Improve Loading and Empty States

Tasks

Review all major screens.

Add suitable states for:

- no projects;
- no characters;
- no episodes;
- no scenes;
- no cue points;
- no media items.

---

TASK-063 — Review Destructive Actions

Tasks

Ensure confirmation exists for destructive actions.

Review:

- project deletion;
- character deletion where necessary;
- episode deletion;
- scene deletion;
- cue point deletion where appropriate;
- media deletion.

---

Phase 20 — Backend Testing

TASK-064 — Add Backend Test Infrastructure

Tasks

- Configure the backend test framework.
- Add test database support.
- Add helpers for Fastify API tests.

Definition of Done

Automated backend tests can execute in isolation.

---

TASK-065 — Add Project and Character API Tests

Test

- valid creation;
- invalid creation;
- retrieval;
- update;
- deletion;
- cascade behavior;
- not-found cases.

---

TASK-066 — Add Episode and Scene API Tests

Test

- CRUD;
- parent validation;
- ordering;
- deletion behavior;
- invalid relations.

---

TASK-067 — Add Cue Point API Tests

Test

- CRUD;
- character validation;
- sound effect validation;
- ordering;
- invalid references.

---

TASK-068 — Add Media API Tests

Test

- upload;
- metadata creation;
- filtering;
- editing;
- file deletion;
- referenced-file deletion protection;
- invalid media types.

---

Phase 21 — Frontend Testing

TASK-069 — Add Frontend Test Infrastructure

Tasks

Configure tests for:

- Vue components;
- composables;
- API-related UI behavior.

---

TASK-070 — Test Core Shared Components

Test

- form fields;
- validation messages;
- accordion behavior;
- confirmation dialog;
- empty states.

---

TASK-071 — Test Project Workflow

Test

User workflow:

Create Project
→ Add Character
→ Add Episode
→ Add Scene
→ Add Cue Point

Verify UI state and API integration.

---

TASK-072 — Test Media Workflow

Test

User workflow:

Upload Background Music
→ Assign to Scene

Upload Sound Effect
→ Assign to Cue Point

---

Phase 22 — End-to-End MVP Validation

TASK-073 — Validate Complete Authoring Workflow

Scenario

Create a new project.

Add:

- project metadata;
- main characters;
- one episode;
- one scene;
- two cue points.

Upload:

- one background music file;
- one sound effect.

Assign:

- background music to the scene;
- sound effect to one cue point.

Reload the application.

Expected Result

All data remains available and correct.

---

TASK-074 — Validate Ordering

Test

Create:

- multiple episodes;
- multiple scenes;
- multiple cue points.

Change their order.

Reload the application.

Expected Result

All entities remain in the selected order.

---

TASK-075 — Validate Cascading Deletes

Test

Verify deletion behavior for:

Project
→ Episode
→ Scene
→ Cue Point

Expected Result

No invalid records or references remain.

---

TASK-076 — Validate Media Reference Protection

Test

- Assign background music to a scene.
- Try to delete the media item.
- Assign a sound effect to a cue point.
- Try to delete the media item.

Expected Result

The system prevents unsafe deletion and explains where the media item is used.

---

Phase 23 — Final Technical Review

TASK-077 — Review Frontend Architecture

Review

Verify:

- Vue Composition API usage;
- reusable components;
- TanStack Vue Query for server state;
- Pinia only for applicable client state;
- no duplicated server state;
- Tailwind CSS 4 usage;
- consistent form patterns.

---

TASK-078 — Review Backend Architecture

Review

Verify separation between:

Routes
→ Validation
→ Services
→ Database

Also verify:

- Fastify routes do not contain unnecessary business logic;
- Zod validates input;
- Drizzle handles database access;
- storage logic is isolated.

---

TASK-079 — Review Storage Architecture

Goal

Verify that Hetzner storage can be added later.

Review

Application business logic MUST NOT depend on:

- local directory structures;
- absolute file paths;
- Node.js file system APIs.

Only the local storage adapter may contain local file system implementation details.

---

TASK-080 — Perform Final MVP Review

Verify

The MVP supports:

- Project CRUD
- Character CRUD
- Episode CRUD
- Scene CRUD
- Cue Point CRUD
- Episode ordering
- Scene ordering
- Cue point ordering
- Media upload
- Media CRUD
- Local media storage
- Scene background music
- Cue point sound effects
- Input validation
- Error handling
- PostgreSQL persistence
- Responsive basic UI
- Consistent navigation

The MVP does not require:

- authentication;
- collaboration;
- text-to-speech;
- audio mixing;
- final audio rendering;
- remote storage;
- animations;
- drag-and-drop.

---

24. Standard Instructions for Each AI Agent Task

Use these instructions together with each task in this roadmap.

Agent Rules

1. Implement only the requested task.
2. Do not implement later roadmap tasks.
3. Inspect the existing repository before you make changes.
4. Follow existing architecture and naming conventions.
5. Do not replace working architecture without a clear technical reason.
6. Use TypeScript with strict types.
7. Do not use "any" unless there is no practical alternative.
8. Validate external input.
9. Keep business logic separate from UI and HTTP transport code.
10. Add or update tests when the task changes testable behavior.
11. Run applicable:

- type checks;
- lint checks;
- tests;
- builds.

12. Fix errors that your changes cause.
13. Do not make unrelated formatting or refactoring changes.
14. Update relevant documentation if the task changes a public interface.
15. Stop after the task and its acceptance criteria are complete.

Required Agent Report

After each task, the agent should report:

Implemented

A short description of the completed work.

Files Changed

A list of important files that were created or modified.

Validation

Report the result of:

Lint:
Type check:
Tests:
Build:

Decisions

List relevant implementation decisions.

Remaining Issues

List unresolved issues that are directly related to the task.

Do not implement those issues unless they are part of the current task.

---

25. Recommended Agent Prompt Template

Use this template when you give one roadmap task to an AI coding agent.

You are working on the Audio Drama Application.

Implement only the following roadmap task:

[TASK ID AND TASK TEXT]

Technical stack:

Monorepo:
- PNPM
- Turbo

Frontend:
- Vue 3
- Vite
- Composition API
- TypeScript
- Pinia
- Vue Router
- Tailwind CSS 4
- TanStack Vue Query

Backend:
- Node.js
- TypeScript
- Fastify
- Zod
- PostgreSQL
- Drizzle ORM

Rules:

- Inspect the existing repository before making changes.
- Follow the existing architecture.
- Do not implement future roadmap tasks.
- Do not make unrelated changes.
- Keep the repository in a working state.
- Use strict TypeScript.
- Validate external input.
- Add or update tests where applicable.
- Run linting, type checks, tests, and builds that are relevant to your changes.
- Fix problems caused by your implementation.

When finished, report:

1. What you implemented.
2. Which important files you changed.
3. Which tests and checks you ran.
4. Important implementation decisions.
5. Remaining issues that relate directly to this task.

Stop after this task is complete.

---

26. Recommended Execution Order

The tasks should normally be executed in this exact order:

001–003  Repository
004–005  Backend foundation
006–014  Database
015–016  Shared validation and API infrastructure
017–020  Projects
021      Characters
022–023  Episodes
024–025  Scenes
026–028  Cue Points
029–033  Media and storage
034–043  Frontend foundation and shared UI
044–047  Projects and characters UI
048–050  Episodes UI
051–053  Scenes UI
054–056  Cue Points UI
057–060  Media Library UI
061–063  UX integration
064–068  Backend tests
069–072  Frontend tests
073–076  End-to-end validation
077–080  Architecture and MVP review

Do not start frontend feature implementation before the applicable backend API is stable.

Do not add remote storage before the MVP is complete.

