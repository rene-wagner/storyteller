<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterView } from "vue-router";
import ToolingCheck from "../ToolingCheck.vue";
import { useSidebarStore } from "../sidebar";
import AppHeader from "./AppHeader.vue";
import AppSidebar from "./AppSidebar.vue";
import FeedbackNotices from "./ui/FeedbackNotices.vue";

const sidebar = useSidebarStore();
const header = ref<InstanceType<typeof AppHeader> | null>(null);
const sidebarView = ref<InstanceType<typeof AppSidebar> | null>(null);
let desktopQuery: MediaQueryList | undefined;

watch(
  () => sidebar.isSidebarOpen,
  async (open) => {
    await nextTick();
    if (open) sidebarView.value?.focusClose();
    else if (!desktopQuery?.matches) header.value?.focusMenu();
  },
);

function handleKeydown(event: KeyboardEvent): void {
  if (!sidebar.isSidebarOpen || desktopQuery?.matches) return;
  if (event.key === "Escape") {
    sidebar.closeSidebar();
    return;
  }
  if (event.key !== "Tab") return;

  const panel = document.getElementById("app-sidebar");
  if (!panel) return;
  const controls = panel.querySelectorAll<HTMLElement>("button, a[href]");
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      !panel.contains(document.activeElement))
  ) {
    event.preventDefault();
    last?.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !panel.contains(document.activeElement))
  ) {
    event.preventDefault();
    first?.focus();
  }
}

function handleDesktopChange(event: MediaQueryListEvent): void {
  if (event.matches) sidebar.closeSidebar();
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  desktopQuery = window.matchMedia?.("(min-width: 768px)");
  desktopQuery?.addEventListener("change", handleDesktopChange);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  desktopQuery?.removeEventListener("change", handleDesktopChange);
});
</script>

<template>
  <div class="flex min-h-screen flex-col bg-paper text-ink">
    <AppHeader ref="header" />
    <div class="flex min-h-0 flex-1">
      <div
        v-if="sidebar.isSidebarOpen"
        class="fixed inset-0 top-16 z-30 bg-black/40 md:hidden"
        aria-hidden="true"
        @click="sidebar.closeSidebar()"
      />
      <AppSidebar ref="sidebarView" />
      <div class="min-w-0 flex-1">
        <FeedbackNotices />
        <main class="mx-auto max-w-5xl px-6 py-10">
          <RouterView />
        </main>
        <footer class="mx-auto max-w-5xl px-6 pb-8 text-sm text-gray-600">
          Tooling check: <ToolingCheck />
        </footer>
      </div>
    </div>
  </div>
</template>
