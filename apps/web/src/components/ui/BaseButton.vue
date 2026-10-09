<script setup lang="ts">
import type { Component } from "vue";

withDefaults(
  defineProps<{
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
    icon?: Component;
  }>(),
  { type: "button", variant: "primary" },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-2 rounded border px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'border-ink bg-ink text-white hover:bg-gray-800': variant === 'primary',
      'border-gray-300 bg-white text-ink hover:border-ink':
        variant === 'secondary',
      'border-danger bg-danger text-white hover:bg-red-800':
        variant === 'danger',
    }"
  >
    <component
      :is="icon"
      v-if="icon"
      :size="18"
      aria-hidden="true"
      focusable="false"
      class="shrink-0"
    />
    <span v-if="icon" class="sr-only md:not-sr-only"><slot /></span>
    <slot v-else />
  </button>
</template>
