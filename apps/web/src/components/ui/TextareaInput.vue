<script setup lang="ts">
defineProps<{ id: string; disabled?: boolean }>();
const model = defineModel<string>({ default: "" });
</script>

<template>
  <textarea
    v-model="model"
    :id="id"
    :disabled="disabled"
    class="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 aria-invalid:border-danger"
  />
</template>
