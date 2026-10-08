<script setup lang="ts">
import ValidationMessage from "./ValidationMessage.vue";

defineProps<{
  label: string;
  forId: string;
  hint?: string;
  error?: string;
}>();
</script>

<template>
  <div class="space-y-1">
    <label :for="forId" class="block font-medium">{{ label }}</label>
    <slot
      :described-by="
        error ? `${forId}-error` : hint ? `${forId}-hint` : undefined
      "
      :invalid="!!error"
    />
    <p
      v-if="hint && !error"
      :id="`${forId}-hint`"
      class="text-sm text-gray-600"
    >
      {{ hint }}
    </p>
    <ValidationMessage v-if="error" :id="`${forId}-error`">{{
      error
    }}</ValidationMessage>
  </div>
</template>
