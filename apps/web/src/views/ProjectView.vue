<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <section aria-labelledby="project-heading" class="space-y-5">
    <h1 id="project-heading" class="text-3xl font-semibold">Project</h1>
    <p class="text-gray-700">
      Project {{ route.params.projectId }} will be available here.
    </p>
    <RouterLink class="underline underline-offset-4" to="/projects"
      >Back to projects</RouterLink
    >
  </section>
</template>
