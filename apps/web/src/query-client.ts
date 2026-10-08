import { QueryClient } from "@tanstack/vue-query";
import { ApiError } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) =>
        failureCount < 1 &&
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ),
    },
    mutations: { retry: false },
  },
});
