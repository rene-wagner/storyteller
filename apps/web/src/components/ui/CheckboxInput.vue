<script setup lang="ts">
defineProps<{ id: string; disabled?: boolean }>();
const model = defineModel<boolean>({ default: false });
</script>

<template>
  <input
    v-model="model"
    :id="id"
    type="checkbox"
    :disabled="disabled"
    class="size-4 accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50"
  />
</template>
