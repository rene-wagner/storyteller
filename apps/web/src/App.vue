<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import ToolingCheck from "./ToolingCheck.vue";
import FeedbackNotices from "./components/ui/FeedbackNotices.vue";
</script>

<template>
  <div class="min-h-screen bg-paper text-ink">
    <header class="border-b border-gray-200 bg-white">
      <div
        class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5"
      >
        <RouterLink class="text-xl font-semibold" to="/"
          >Storyteller</RouterLink
        >
        <nav aria-label="Primary navigation" class="flex gap-6">
          <RouterLink
            class="text-gray-700 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
            active-class="font-semibold text-black"
            to="/projects"
            >Projects</RouterLink
          >
          <RouterLink
            class="text-gray-700 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
            active-class="font-semibold text-black"
            to="/media"
            >Media Library</RouterLink
          >
        </nav>
      </div>
    </header>
    <FeedbackNotices />
    <main class="mx-auto max-w-5xl px-6 py-10">
      <RouterView />
    </main>
    <footer class="mx-auto max-w-5xl px-6 pb-8 text-sm text-gray-600">
      Tooling check: <ToolingCheck />
    </footer>
  </div>
</template>
