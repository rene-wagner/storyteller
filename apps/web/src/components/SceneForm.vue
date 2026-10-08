<script setup lang="ts">
import type { CreateSceneRequest, MediaItem } from "@storyteller/shared";
import { ref, useId } from "vue";
import { validateScene, type SceneFieldErrors } from "../projects";
import BaseButton from "./ui/BaseButton.vue";
import FormField from "./ui/FormField.vue";
import SelectInput from "./ui/SelectInput.vue";
import TextInput from "./ui/TextInput.vue";

const props = withDefaults(
  defineProps<{
    initial?: CreateSceneRequest;
    music: MediaItem[];
    submitting?: boolean;
    submitLabel: string;
  }>(),
  { submitting: false },
);
const emit = defineEmits<{ submit: [value: CreateSceneRequest] }>();
const title = ref(props.initial?.title ?? "");
const backgroundMusicId = ref(props.initial?.backgroundMusicId ?? "");
const errors = ref<SceneFieldErrors>({});
const fieldId = useId();

function submit(): void {
  const result = validateScene({
    title: title.value,
    backgroundMusicId: backgroundMusicId.value || null,
  });
  errors.value = result.errors;
  if (result.value) emit("submit", result.value);
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <FormField label="Title" :for-id="`${fieldId}-title`" :error="errors.title">
      <template #default="{ describedBy, invalid }">
        <TextInput
          :id="`${fieldId}-title`"
          v-model="title"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </template>
    </FormField>
    <FormField
      label="Background music"
      :for-id="`${fieldId}-music`"
      :error="errors.backgroundMusicId"
    >
      <template #default="{ describedBy, invalid }">
        <SelectInput
          :id="`${fieldId}-music`"
          v-model="backgroundMusicId"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        >
          <option value="" :selected="!backgroundMusicId">
            No background music
          </option>
          <option
            v-for="item in music.filter(
              (item) => item.type === 'background_music',
            )"
            :key="item.id"
            :value="item.id"
            :selected="item.id === backgroundMusicId"
          >
            {{ item.name }}
          </option>
        </SelectInput>
      </template>
    </FormField>
    <BaseButton type="submit" :disabled="submitting">{{
      submitting ? "Saving…" : submitLabel
    }}</BaseButton>
  </form>
</template>
