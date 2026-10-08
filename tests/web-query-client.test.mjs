import { expect, test } from "vitest";
import { ApiError } from "../apps/web/src/api-client.ts";
import { queryClient } from "../apps/web/src/query-client.ts";

test("query defaults cache briefly and avoid retrying client errors", () => {
  const { staleTime, retry } = queryClient.getDefaultOptions().queries;
  expect(staleTime).toBe(60_000);
  expect(retry(0, new ApiError(400, "VALIDATION_ERROR", "Invalid"))).toBe(
    false,
  );
  expect(retry(0, new ApiError(500, "INTERNAL_ERROR", "Failed"))).toBe(true);
  expect(retry(0, new TypeError("network error"))).toBe(true);
  expect(retry(1, new TypeError("network error"))).toBe(false);
});

test("mutations do not automatically retry writes", () => {
  expect(queryClient.getDefaultOptions().mutations.retry).toBe(false);
});
