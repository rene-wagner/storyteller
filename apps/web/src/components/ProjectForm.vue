<script setup lang="ts">
import type { CreateProjectRequest } from "@storyteller/shared";
import { reactive, ref } from "vue";
import { validateProject, type ProjectFieldErrors } from "../projects";
import BaseButton from "./ui/BaseButton.vue";
import FormField from "./ui/FormField.vue";
import TextInput from "./ui/TextInput.vue";
import TextareaInput from "./ui/TextareaInput.vue";

const props = withDefaults(
  defineProps<{
    initial?: CreateProjectRequest;
    submitting?: boolean;
    submitLabel: string;
  }>(),
  { submitting: false },
);
const emit = defineEmits<{ submit: [value: CreateProjectRequest] }>();
const fields = reactive<CreateProjectRequest>({
  title: props.initial?.title ?? "",
  genre: props.initial?.genre ?? "",
  description: props.initial?.description ?? "",
});
const errors = ref<ProjectFieldErrors>({});

function submit(): void {
  const result = validateProject(fields);
  errors.value = result.errors;
  if (result.value) emit("submit", result.value);
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <FormField label="Title" for-id="project-title" :error="errors.title">
      <template #default="{ describedBy, invalid }">
        <TextInput
          id="project-title"
          v-model="fields.title"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </template>
    </FormField>
    <FormField label="Genre" for-id="project-genre" :error="errors.genre">
      <template #default="{ describedBy, invalid }">
        <TextInput
          id="project-genre"
          v-model="fields.genre"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </template>
    </FormField>
    <FormField
      label="Description"
      for-id="project-description"
      :error="errors.description"
    >
      <template #default="{ describedBy, invalid }">
        <TextareaInput
          id="project-description"
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
