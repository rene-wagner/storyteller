<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section aria-labelledby="home-heading" class="space-y-5">
    <h1 id="home-heading" class="text-3xl font-semibold">
      Audio drama workspace
    </h1>
    <p class="text-gray-700">Choose where to start.</p>
    <div class="flex flex-wrap gap-4">
      <RouterLink
        class="rounded border border-gray-300 bg-white px-4 py-2 hover:border-black"
        to="/projects"
        >Projects</RouterLink
      >
      <RouterLink
        class="rounded border border-gray-300 bg-white px-4 py-2 hover:border-black"
        to="/media"
        >Media Library</RouterLink
      >
    </div>
  </section>
</template>
