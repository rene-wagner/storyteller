# Media API

All media responses use the shared `MediaItem` shape (`fileSize` is a decimal string); storage keys and filesystem paths are never returned. Media types are `background_music` and `sound_effect`.

- `POST /media`: multipart/form-data with exactly one `file` (nonempty audio MIME type `audio/*`, maximum 25 MiB), required text `name` (1–255 characters after trimming) and `type`. Fields may precede or follow the file. File names must be nonempty, at most 255 characters, and contain no path separators or control characters. Returns 201 and a media item. Invalid data returns 400; oversized files return 413. The MIME declaration is validated, not the audio contents.
- `GET /media`: returns items in creation order; optional `?type=background_music` or `?type=sound_effect` filters the list.
- `GET /media/:mediaId`: returns the item, or 404.
- `PATCH /media/:mediaId`: accepts `{ "name": "..." }`, updates the modification time, returns the item or 404. Uploaded file data, type and immutable file metadata cannot be patched.
- `DELETE /media/:mediaId`: returns 204 for unused media, 404 if absent. If a scene or cue point refers to the item, returns 409 with `{ "error": { "code": "CONFLICT", "message": "Media item is in use.", "details": [], "usage": { "sceneIds": ["..."], "cuePointIds": ["..."], "scenes": [{ "id": "...", "projectTitle": "...", "episodeTitle": "...", "sceneTitle": "..." }], "cuePoints": [{ "id": "...", "projectTitle": "...", "episodeTitle": "...", "sceneTitle": "...", "position": 0 }] } } }`. The ID arrays remain available for technical references; the additional labels and zero-based cue position provide human-readable context for each reference. Existing database foreign keys also prohibit concurrent writes from creating dangling references.

Upload removes saved bytes if metadata insertion fails (cleanup is best effort on storage failure). Deletion commits metadata removal first and then deletes the bytes; if byte deletion fails the API returns 500 and orphaned bytes may require operator cleanup. This order avoids leaving a metadata row referencing missing bytes. Storage errors are not sent to clients.
