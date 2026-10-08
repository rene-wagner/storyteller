<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: "info" | "success" | "warning" | "error" }>(),
  { variant: "info" },
);
</script>

<template>
  <div
    :role="variant === 'error' ? 'alert' : 'status'"
    class="rounded border p-4"
    :class="{
      'border-gray-300 bg-white text-ink': variant === 'info',
      'border-success text-success': variant === 'success',
      'border-warning text-warning': variant === 'warning',
      'border-danger text-danger': variant === 'error',
    }"
  >
    <slot />
  </div>
</template>
