<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section aria-labelledby="projects-heading" class="space-y-5">
    <h1 id="projects-heading" class="text-3xl font-semibold">Projects</h1>
    <p class="text-gray-700">Project management will be available here.</p>
    <RouterLink
      class="inline-block rounded border border-gray-300 bg-white px-4 py-2 hover:border-black"
      to="/projects/new"
      >New project</RouterLink
    >
  </section>
</template>
