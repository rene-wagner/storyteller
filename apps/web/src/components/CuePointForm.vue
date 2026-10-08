<script setup lang="ts">
import type {
  Character,
  CreateCuePointRequest,
  MediaItem,
} from "@storyteller/shared";
import { ref, useId } from "vue";
import { validateCuePoint, type CuePointFieldErrors } from "../projects";
import BaseButton from "./ui/BaseButton.vue";
import CheckboxInput from "./ui/CheckboxInput.vue";
import FormField from "./ui/FormField.vue";
import SelectInput from "./ui/SelectInput.vue";
import TextareaInput from "./ui/TextareaInput.vue";
import ValidationMessage from "./ui/ValidationMessage.vue";

const props = withDefaults(
  defineProps<{
    initial?: CreateCuePointRequest;
    characters: Character[];
    effects: MediaItem[];
    submitting?: boolean;
    submitLabel: string;
  }>(),
  { submitting: false },
);
const emit = defineEmits<{ submit: [value: CreateCuePointRequest] }>();
const characterId = ref(props.initial?.characterId ?? "");
const spokenText = ref(props.initial?.spokenText ?? "");
const soundEffectIds = ref([...(props.initial?.soundEffectIds ?? [])]);
const errors = ref<CuePointFieldErrors>({});
const fieldId = useId();

function toggleEffect(id: string, selected: boolean): void {
  soundEffectIds.value = selected
    ? [...soundEffectIds.value, id]
    : soundEffectIds.value.filter((value) => value !== id);
}

function submit(): void {
  const result = validateCuePoint({
    characterId: characterId.value,
    spokenText: spokenText.value,
    soundEffectIds: soundEffectIds.value,
  });
  errors.value = result.errors;
  if (!props.characters.some((character) => character.id === characterId.value))
    errors.value.characterId = "Select a project character.";
  if (
    soundEffectIds.value.some(
      (id) =>
        !props.effects.some(
          (effect) => effect.id === id && effect.type === "sound_effect",
        ),
    )
  )
    errors.value.soundEffectIds = "Select valid sound effects.";
  if (result.value && !Object.keys(errors.value).length)
    emit("submit", result.value);
}
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="submit">
    <FormField
      label="Character"
      :for-id="`${fieldId}-character`"
      :error="errors.characterId"
    >
      <template #default="{ describedBy, invalid }">
        <SelectInput
          :id="`${fieldId}-character`"
          v-model="characterId"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        >
          <option value="">Select a character</option>
          <option
            v-for="character in characters"
            :key="character.id"
            :value="character.id"
            :selected="character.id === characterId"
          >
            {{ character.name }}
          </option>
        </SelectInput>
      </template>
    </FormField>
    <FormField
      label="Spoken text"
      :for-id="`${fieldId}-text`"
      :error="errors.spokenText"
    >
      <template #default="{ describedBy, invalid }">
        <TextareaInput
          :id="`${fieldId}-text`"
          v-model="spokenText"
          :disabled="submitting"
          :aria-describedby="describedBy"
          :aria-invalid="invalid"
        />
      </template>
    </FormField>
    <fieldset
      class="space-y-2"
      :aria-describedby="
        errors.soundEffectIds ? `${fieldId}-effects-error` : undefined
      "
    >
      <legend class="font-medium">Sound effects</legend>
      <p
        v-if="
          !effects.filter((effect) => effect.type === 'sound_effect').length
        "
      >
        No sound effects available.
      </p>
      <label
        v-for="effect in effects.filter((item) => item.type === 'sound_effect')"
        :key="effect.id"
        class="flex items-center gap-2"
      >
        <CheckboxInput
          :id="`${fieldId}-effect-${effect.id}`"
          :model-value="soundEffectIds.includes(effect.id)"
          :disabled="submitting"
          @update:model-value="(selected) => toggleEffect(effect.id, selected)"
        />
        {{ effect.name }}
      </label>
      <ValidationMessage
        v-if="errors.soundEffectIds"
        :id="`${fieldId}-effects-error`"
        >{{ errors.soundEffectIds }}</ValidationMessage
      >
    </fieldset>
    <BaseButton type="submit" :disabled="submitting">{{
      submitting ? "Saving…" : submitLabel
    }}</BaseButton>
  </form>
</template>
