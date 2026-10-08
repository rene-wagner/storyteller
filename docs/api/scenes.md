# Scene API

- `GET /episodes/:episodeId/scenes` — list scenes of an existing episode in ascending `position` order (ties by `id`); returns `[]` when empty.
- `POST /episodes/:episodeId/scenes` — create a scene with `{ "title": "...", "backgroundMusicId": "<media UUID>" }`; `backgroundMusicId` may be omitted or `null`. Returns HTTP 201. The server assigns position 0 for the first scene, otherwise one greater than the highest current position.
- `PUT /episodes/:episodeId/scenes/order` — replace the complete order with `{ "sceneIds": ["<scene UUID>", "..."] }`; returns HTTP 204 with no body. Supply every scene of the episode exactly once, or `[]` if empty. Positions become 0 through n−1 in one transaction. Missing, duplicate, invalid, or foreign IDs return HTTP 400 without changing positions; an unknown episode returns HTTP 404.
- `GET /scenes/:sceneId` — retrieve one scene.
- `PATCH /scenes/:sceneId` — update `title` and/or `backgroundMusicId`; use `null` to remove the music. An empty update is invalid.
- `DELETE /scenes/:sceneId` — delete a scene and its cue points; returns HTTP 204.

Scene responses include `id`, `episodeId`, `title`, `backgroundMusicId` (UUID or `null`), `position`, `createdAt`, and `updatedAt`. IDs must be UUIDs and titles must be nonempty. Background music must refer to an existing media item of type `background_music`; invalid or wrong-type media references return HTTP 400. Clients cannot set the episode or position through these endpoints. Invalid requests return HTTP 400, missing episodes or scenes return HTTP 404, and exhausted positions return HTTP 409. Errors use the [standard format](./errors.md).
