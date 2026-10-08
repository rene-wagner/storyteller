<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: "Loading…" });
</script>

<template>
  <p role="status" class="text-gray-700">{{ label }}</p>
</template>
