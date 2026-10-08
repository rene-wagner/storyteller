<script setup lang="ts">
withDefaults(defineProps<{ defaultOpen?: boolean }>(), { defaultOpen: false });
</script>

<template>
  <details class="group" :open="defaultOpen"><slot /></details>
</template>
