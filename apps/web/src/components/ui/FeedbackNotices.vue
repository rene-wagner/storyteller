<script setup lang="ts">
import { useFeedbackStore } from "../../feedback";
import BaseAlert from "./BaseAlert.vue";

const feedback = useFeedbackStore();
</script>

<template>
  <div
    v-if="feedback.notices.length"
    class="mx-auto max-w-5xl space-y-2 px-6 pt-4"
  >
    <BaseAlert
      v-for="notice in feedback.notices"
      :key="notice.id"
      :variant="notice.variant"
    >
      <div class="flex items-start justify-between gap-4">
        <span>{{ notice.message }}</span>
        <button
          type="button"
          class="underline"
          :aria-label="`Dismiss ${notice.variant} notification`"
          @click="feedback.dismiss(notice.id)"
        >
          Dismiss
        </button>
      </div>
    </BaseAlert>
  </div>
</template>
