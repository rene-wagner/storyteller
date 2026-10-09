import { defineStore } from "pinia";

interface Notice {
  id: number;
  variant: "success" | "error";
  message: string;
}

export const useFeedbackStore = defineStore("feedback", {
  state: () => ({ notices: [] as Notice[], nextId: 0 }),
  actions: {
    notify(variant: Notice["variant"], message: string): void {
      this.notices.push({ id: ++this.nextId, variant, message });
      // Keep the list compact when a user performs many actions without dismissing notices.
      if (this.notices.length > 5) this.notices.shift();
    },
    dismiss(id: number): void {
      this.notices = this.notices.filter((notice) => notice.id !== id);
    },
  },
});
