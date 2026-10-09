<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
</script>

<template>
  <summary
    class="cursor-pointer list-none px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black [&::-webkit-details-marker]:hidden [[open]>&_svg]:rotate-180"
  >
    <span class="inline-flex w-full items-center justify-between gap-3"
      ><span><slot /></span
      ><ChevronDown
        :size="18"
        aria-hidden="true"
        focusable="false"
        class="shrink-0 text-gray-600"
    /></span>
  </summary>
</template>
