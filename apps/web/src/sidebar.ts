import { defineStore } from "pinia";

export const useSidebarStore = defineStore("sidebar", {
  state: () => ({ isSidebarOpen: false }),
  actions: {
    openSidebar() {
      this.isSidebarOpen = true;
    },
    closeSidebar() {
      this.isSidebarOpen = false;
    },
    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
    },
  },
});
