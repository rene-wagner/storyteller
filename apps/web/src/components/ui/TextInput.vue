<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string;
    type?: "text" | "email" | "password" | "search" | "url" | "tel";
    disabled?: boolean;
  }>(),
  { type: "text" },
);

const model = defineModel<string>({ default: "" });
</script>

<template>
  <input
    v-model="model"
    :id="id"
    :type="type"
    :disabled="disabled"
    class="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 aria-invalid:border-danger"
  />
</template>
