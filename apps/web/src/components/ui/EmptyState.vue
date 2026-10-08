<script setup lang="ts">
defineProps<{ title: string; message: string }>();
</script>

<template>
  <section class="rounded border border-gray-300 bg-white p-5">
    <h2 class="text-lg font-semibold">{{ title }}</h2>
    <p class="mt-2 text-gray-700">{{ message }}</p>
    <div v-if="$slots.action" class="mt-4"><slot name="action" /></div>
  </section>
</template>
