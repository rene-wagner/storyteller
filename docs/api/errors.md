# API error responses

API failures return JSON with an `error` object containing a stable `code`, a safe `message`, and a `details` array. `details` is currently empty; raw validation errors and internal exception messages are not returned.

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid request or validation failure (including Zod errors). |
| 404 | `NOT_FOUND` | Unknown route or missing resource. |
| 409 | `CONFLICT` | Resource conflict. |
| Other 4xx | `REQUEST_ERROR` | Other rejected client request. |
| 500 | `INTERNAL_ERROR` | Unexpected server failure. |

For route errors, throw an error with Fastify's `statusCode` set to 404 or 409 to use the corresponding response. Unhandled errors are reported as HTTP 500 without exposing their messages or stack traces. The existing `GET /health` success response is unchanged.
