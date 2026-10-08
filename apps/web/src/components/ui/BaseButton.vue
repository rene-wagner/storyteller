<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
  }>(),
  { type: "button", variant: "primary" },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="rounded border px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'border-ink bg-ink text-white hover:bg-gray-800': variant === 'primary',
      'border-gray-300 bg-white text-ink hover:border-ink':
        variant === 'secondary',
      'border-danger bg-danger text-white hover:bg-red-800':
        variant === 'danger',
    }"
  >
    <slot />
  </button>
</template>
