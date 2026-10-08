<script setup lang="ts">
import type { CreateCharacterRequest } from "@storyteller/shared";
import { reactive, ref } from "vue";
import { validateCharacter, type CharacterFieldErrors } from "../projects";
import BaseButton from "./ui/BaseButton.vue";
import FormField from "./ui/FormField.vue";
import TextInput from "./ui/TextInput.vue";

const props = withDefaults(
  defineProps<{
    initial?: CreateCharacterRequest;
    submitting?: boolean;
    submitLabel: string;
  }>(),
  { submitting: false },
);
const emit = defineEmits<{ submit: [value: CreateCharacterRequest] }>();
const fields = reactive<CreateCharacterRequest>({
  name: props.initial?.name ?? "",
  type: props.initial?.type ?? "main",
});
const errors = ref<CharacterFieldErrors>({});

function submit(): void {
  const result = validateCharacter(fields);
  errors.value = result.errors;
  if (result.value) emit("submit", result.value);
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <FormField label="Name" for-id="character-name" :error="errors.name">
      <template #default="{ describedBy, invalid }">
        <TextInput
          id="character-name"
          v-model="fields.name"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </template>
    </FormField>
    <FormField label="Type" for-id="character-type" :error="errors.type">
      <template #default="{ describedBy, invalid }">
        <select
          id="character-type"
          v-model="fields.type"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
          class="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 aria-invalid:border-danger"
        >
          <option value="main">Main</option>
          <option value="supporting">Supporting</option>
        </select>
      </template>
    </FormField>
    <BaseButton type="submit" :disabled="submitting">{{
      submitting ? "Saving…" : submitLabel
    }}</BaseButton>
  </form>
</template>
