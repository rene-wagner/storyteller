import { MutationCache, QueryClient } from "@tanstack/vue-query";
import { ApiError } from "./api-client";
import { useFeedbackStore } from "./feedback";
import { pinia } from "./pinia";
import { projectError } from "./projects";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const message = mutation.meta?.successMessage;
      if (typeof message === "string")
        useFeedbackStore(pinia).notify("success", message);
    },
    onError: (error, _variables, _context, mutation) => {
      // Contextual conflicts are explained beside the affected item.
      if (
        mutation.meta?.contextualConflict === true &&
        error instanceof ApiError &&
        error.status === 409
      )
        return;
      useFeedbackStore(pinia).notify("error", projectError(error));
    },
  }),
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
