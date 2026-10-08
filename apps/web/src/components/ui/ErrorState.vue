<script setup lang="ts">
defineProps<{ title: string; message: string }>();
</script>

<template>
  <section role="alert" class="rounded border border-danger p-5 text-danger">
    <h2 class="text-lg font-semibold">{{ title }}</h2>
    <p class="mt-2">{{ message }}</p>
    <div v-if="$slots.action" class="mt-4"><slot name="action" /></div>
  </section>
</template>
