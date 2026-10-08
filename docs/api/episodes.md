# Episode API

- `GET /projects/:projectId/episodes` — list episodes for an existing project in ascending `position` order (ties by `id`); returns `[]` when empty.
- `POST /projects/:projectId/episodes` — create an episode with `{ "title": "...", "description": "..." }`; returns the episode with HTTP 201. `position` is assigned by the server (0 for the first episode, otherwise one greater than the highest current position).
- `PUT /projects/:projectId/episodes/order` — replace the complete order with `{ "episodeIds": ["<episode UUID>", "..."] }`; returns HTTP 204 with no body. Provide every episode of this project exactly once, or `[]` if the project has no episodes. Positions become 0 through n−1 in the supplied order in one transaction. Missing, duplicate, invalid, or foreign IDs return HTTP 400 without changing positions; an unknown project returns HTTP 404.
- `GET /episodes/:episodeId` — retrieve one episode.
- `PATCH /episodes/:episodeId` — update one or both of `title` and `description`; an empty update is invalid.
- `DELETE /episodes/:episodeId` — delete an episode and its dependent scenes and cue points; returns HTTP 204.

Episode responses include `id`, `projectId`, `title`, `description`, `position`, `createdAt`, and `updatedAt`. IDs must be UUIDs; title must be nonempty; description must be a string. Clients cannot set the project or position through these endpoints. Invalid requests return HTTP 400, missing projects or episodes return HTTP 404. If no further position can be assigned, creation returns HTTP 409. Errors use the [standard format](./errors.md).
