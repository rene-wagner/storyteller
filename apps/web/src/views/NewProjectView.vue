<script setup lang="ts">
import { Folder } from "@lucide/vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { RouterLink, useRouter } from "vue-router";
import ProjectForm from "../components/ProjectForm.vue";
import { projectKeys, projectsApi } from "../projects";

const router = useRouter();
const queryClient = useQueryClient();
const create = useMutation({
  meta: { successMessage: "Project created." },
  mutationFn: projectsApi.create,
  onSuccess: async (project) => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.list,
      exact: true,
    });
    await router.push({ name: "project", params: { projectId: project.id } });
  },
});
</script>

<template>
  <section aria-labelledby="new-project-heading" class="max-w-xl space-y-5">
    <h1
      id="new-project-heading"
      class="flex items-center gap-2 text-3xl font-semibold"
    >
      <Folder
        :size="20"
        aria-hidden="true"
        focusable="false"
        class="shrink-0"
      />
      New project
    </h1>
    <ProjectForm
      submit-label="Create project"
      :submitting="create.isPending.value"
      @submit="create.mutate"
    />
    <RouterLink class="inline-block underline underline-offset-4" to="/projects"
      >Back to projects</RouterLink
    >
  </section>
</template>
