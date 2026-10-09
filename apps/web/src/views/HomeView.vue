<script setup lang="ts">
import { Folder, Library } from "@lucide/vue";
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
        class="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 hover:border-black"
        to="/projects"
        ><Folder
          :size="20"
          aria-hidden="true"
          focusable="false"
          class="shrink-0"
        />
        <span class="sr-only md:not-sr-only">Projects</span></RouterLink
      >
      <RouterLink
        class="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 hover:border-black"
        to="/media"
        ><Library
          :size="20"
          aria-hidden="true"
          focusable="false"
          class="shrink-0"
        />
        <span class="sr-only md:not-sr-only">Media Library</span></RouterLink
      >
    </div>
  </section>
</template>
