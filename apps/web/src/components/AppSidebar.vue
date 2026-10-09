<script setup lang="ts">
import { Folder, Library, X } from "@lucide/vue";
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { useSidebarStore } from "../sidebar";

const sidebar = useSidebarStore();
const closeButton = ref<HTMLButtonElement | null>(null);

defineExpose({ focusClose: () => closeButton.value?.focus() });
</script>

<template>
  <aside
    id="app-sidebar"
    class="w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white max-md:fixed max-md:top-16 max-md:bottom-0 max-md:left-0 max-md:z-40 md:block"
    :class="sidebar.isSidebarOpen ? 'block' : 'hidden'"
  >
    <div class="flex justify-end border-b border-gray-200 p-4 md:hidden">
      <button
        ref="closeButton"
        type="button"
        class="rounded px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        aria-label="Close navigation menu"
        @click="sidebar.closeSidebar()"
      >
        <X :size="24" aria-hidden="true" focusable="false" />
      </button>
    </div>
    <nav aria-label="Primary navigation" class="flex flex-col gap-2 p-6">
      <RouterLink
        class="inline-flex items-center gap-2 rounded px-2 py-1 text-gray-700 hover:text-black focus-visible:outline-2 focus-visible:outline-black"
        active-class="font-semibold text-black"
        to="/projects"
        @click="sidebar.closeSidebar()"
        ><Folder
          :size="20"
          aria-hidden="true"
          focusable="false"
          class="shrink-0"
        />
        Projects</RouterLink
      >
      <RouterLink
        class="inline-flex items-center gap-2 rounded px-2 py-1 text-gray-700 hover:text-black focus-visible:outline-2 focus-visible:outline-black"
        active-class="font-semibold text-black"
        to="/media"
        @click="sidebar.closeSidebar()"
        ><Library
          :size="20"
          aria-hidden="true"
          focusable="false"
          class="shrink-0"
        />
        Media Library</RouterLink
      >
    </nav>
  </aside>
</template>
