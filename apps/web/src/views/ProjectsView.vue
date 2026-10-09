<script setup lang="ts">
import { Plus, Folder } from "@lucide/vue";
import { useQuery } from "@tanstack/vue-query";
import { RouterLink } from "vue-router";
import EmptyState from "../components/ui/EmptyState.vue";
import ErrorState from "../components/ui/ErrorState.vue";
import LoadingState from "../components/ui/LoadingState.vue";
import { projectError, projectKeys, projectsApi } from "../projects";

const projects = useQuery({
  queryKey: projectKeys.list,
  queryFn: projectsApi.list,
});
</script>

<template>
  <section aria-labelledby="projects-heading" class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1
        id="projects-heading"
        class="flex items-center gap-2 text-3xl font-semibold"
      >
        <Folder
          :size="20"
          aria-hidden="true"
          focusable="false"
          class="shrink-0"
        />
        Projects
      </h1>
      <RouterLink
        class="inline-flex items-center gap-2 rounded border border-ink bg-ink px-4 py-2 text-white hover:bg-gray-800"
        to="/projects/new"
        ><Plus
          :size="20"
          aria-hidden="true"
          focusable="false"
          class="shrink-0"
        />
        <span class="sr-only md:not-sr-only">New project</span></RouterLink
      >
    </div>
    <LoadingState v-if="projects.isPending.value" label="Loading projects…" />
    <ErrorState
      v-else-if="projects.isError.value"
      title="Could not load projects"
      :message="projectError(projects.error.value)"
    >
      <template #action
        ><button class="underline" type="button" @click="projects.refetch()">
          Try again
        </button></template
      >
    </ErrorState>
    <EmptyState
      v-else-if="!projects.data.value?.length"
      title="No projects yet"
      message="Create a project to get started."
    >
      <template #action
        ><RouterLink
          class="inline-flex items-center gap-2 underline"
          to="/projects/new"
          ><Plus
            :size="20"
            aria-hidden="true"
            focusable="false"
            class="shrink-0"
          />
          <span class="sr-only md:not-sr-only">Create project</span></RouterLink
        ></template
      >
    </EmptyState>
    <ul
      v-else
      class="divide-y divide-gray-200 rounded border border-gray-300 bg-white"
    >
      <li v-for="project in projects.data.value" :key="project.id" class="p-5">
        <RouterLink
          class="text-lg font-semibold underline underline-offset-4"
          :to="{ name: 'project', params: { projectId: project.id } }"
          >{{ project.title }}</RouterLink
        >
        <p class="text-gray-700">{{ project.genre }}</p>
        <p class="text-sm text-gray-600">
          Modified
          <time :datetime="project.updatedAt">{{
            new Date(project.updatedAt).toLocaleDateString()
          }}</time>
        </p>
      </li>
    </ul>
  </section>
</template>
