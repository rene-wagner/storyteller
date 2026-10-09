<script setup lang="ts">
import { Menu } from "@lucide/vue";
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { useSidebarStore } from "../sidebar";

const sidebar = useSidebarStore();
const menuButton = ref<HTMLButtonElement | null>(null);

defineExpose({ focusMenu: () => menuButton.value?.focus() });
</script>

<template>
  <header class="relative z-30 border-b border-gray-200 bg-white">
    <div class="flex min-h-16 items-center gap-4 px-6">
      <button
        ref="menuButton"
        type="button"
        class="rounded px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black md:hidden"
        aria-label="Open navigation menu"
        aria-controls="app-sidebar"
        :aria-expanded="sidebar.isSidebarOpen"
        @click="sidebar.openSidebar()"
      >
        <Menu :size="24" aria-hidden="true" focusable="false" />
      </button>
      <RouterLink
        class="text-xl font-semibold"
        to="/"
        @click="sidebar.closeSidebar()"
        >Storyteller</RouterLink
      >
    </div>
  </header>
</template>
