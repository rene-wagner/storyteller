<script setup lang="ts">
import type { CreateEpisodeRequest } from "@storyteller/shared";
import { reactive, ref } from "vue";
import { validateEpisode, type EpisodeFieldErrors } from "../projects";
import BaseButton from "./ui/BaseButton.vue";
import FormField from "./ui/FormField.vue";
import TextInput from "./ui/TextInput.vue";
import TextareaInput from "./ui/TextareaInput.vue";

const props = withDefaults(
  defineProps<{
    initial?: CreateEpisodeRequest;
    submitting?: boolean;
    submitLabel: string;
  }>(),
  { submitting: false },
);
const emit = defineEmits<{ submit: [value: CreateEpisodeRequest] }>();
const fields = reactive<CreateEpisodeRequest>({
  title: props.initial?.title ?? "",
  description: props.initial?.description ?? "",
});
const errors = ref<EpisodeFieldErrors>({});

function submit(): void {
  const result = validateEpisode(fields);
  errors.value = result.errors;
  if (result.value) emit("submit", result.value);
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <FormField label="Title" for-id="episode-title" :error="errors.title">
      <template #default="{ describedBy, invalid }">
        <TextInput
          id="episode-title"
          v-model="fields.title"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </template>
    </FormField>
    <FormField
      label="Description"
      for-id="episode-description"
      :error="errors.description"
    >
      <template #default="{ describedBy, invalid }">
        <TextareaInput
          id="episode-description"
          v-model="fields.description"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </template>
    </FormField>
    <BaseButton type="submit" :disabled="submitting">{{
      submitting ? "Saving…" : submitLabel
    }}</BaseButton>
  </form>
</template>
