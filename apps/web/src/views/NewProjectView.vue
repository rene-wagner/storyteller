<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section aria-labelledby="new-project-heading" class="space-y-5">
    <h1 id="new-project-heading" class="text-3xl font-semibold">New project</h1>
    <p class="text-gray-700">Project creation will be available here.</p>
    <RouterLink class="underline underline-offset-4" to="/projects"
      >Back to projects</RouterLink
    >
  </section>
</template>
