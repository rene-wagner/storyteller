<script setup lang="ts">
import { onMounted, ref, useId, watch, type Component } from "vue";
import BaseButton from "./BaseButton.vue";

withDefaults(
  defineProps<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmIcon?: Component;
  }>(),
  { confirmLabel: "Confirm", cancelLabel: "Cancel" },
);

const open = defineModel<boolean>({ default: false });
const emit = defineEmits<{ confirm: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
const messageId = useId();

function syncOpen(): void {
  if (open.value && !dialog.value?.open) dialog.value?.showModal();
  else if (!open.value && dialog.value?.open) dialog.value.close();
}

watch(open, syncOpen);
onMounted(syncOpen);

function confirm(): void {
  emit("confirm");
  open.value = false;
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    :aria-describedby="messageId"
    @cancel="open = false"
    @close="open = false"
    class="m-auto w-full max-w-md rounded border border-gray-300 bg-white p-6 text-ink backdrop:bg-black/50"
  >
    <h2 :id="titleId" class="text-xl font-semibold">{{ title }}</h2>
    <p :id="messageId" class="mt-3">{{ message }}</p>
    <div class="mt-6 flex justify-end gap-3">
      <BaseButton variant="secondary" @click="open = false">{{
        cancelLabel
      }}</BaseButton>
      <BaseButton variant="danger" :icon="confirmIcon" @click="confirm">{{
        confirmLabel
      }}</BaseButton>
    </div>
  </dialog>
</template>
