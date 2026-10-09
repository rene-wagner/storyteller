<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type { MediaItem, MediaType } from "@storyteller/shared";
import { computed, ref, useId } from "vue";
import { ApiError } from "../api-client";
import {
  mediaApi,
  mediaKeys,
  validateMediaName,
  validateMediaUpload,
} from "../media";
import { projectError } from "../projects";
import BaseAlert from "../components/ui/BaseAlert.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import ConfirmationDialog from "../components/ui/ConfirmationDialog.vue";
import EmptyState from "../components/ui/EmptyState.vue";
import ErrorState from "../components/ui/ErrorState.vue";
import FormField from "../components/ui/FormField.vue";
import LoadingState from "../components/ui/LoadingState.vue";
import SelectInput from "../components/ui/SelectInput.vue";
import TextInput from "../components/ui/TextInput.vue";

const queryClient = useQueryClient();
const fieldId = useId();
const filter = ref<MediaType | "all">("all");
const items = useQuery({
  queryKey: computed(() => mediaKeys.list(filter.value)),
  queryFn: () => mediaApi.list(filter.value),
});
const name = ref("");
const type = ref<MediaType>("background_music");
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadError = ref("");
const editing = ref<MediaItem | null>(null);
const editName = ref("");
const editError = ref("");
const deleting = ref<MediaItem | null>(null);
const confirmingDelete = ref(false);
const deletionErrorId = ref<string | null>(null);

async function refreshMedia(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
}
const upload = useMutation({
  mutationFn: (input: { name: string; type: MediaType; file: File }) =>
    mediaApi.upload({ name: input.name, type: input.type }, input.file),
  onSuccess: async () => {
    await refreshMedia();
    name.value = "";
    file.value = null;
    if (fileInput.value) fileInput.value.value = "";
  },
});
const update = useMutation({
  mutationFn: (input: { id: string; name: string }) =>
    mediaApi.updateName(input.id, input.name),
  onSuccess: async () => {
    await refreshMedia();
    editing.value = null;
  },
});
const remove = useMutation({
  mutationFn: (id: string) => mediaApi.delete(id),
  onSuccess: async () => {
    await refreshMedia();
    deleting.value = null;
    deletionErrorId.value = null;
  },
  onError: (_error, id) => {
    deletionErrorId.value = id;
  },
});
const busy = computed(
  () =>
    upload.isPending.value || update.isPending.value || remove.isPending.value,
);
const usage = computed(() => {
  const error = remove.error.value;
  return error instanceof ApiError && error.status === 409
    ? error.usage
    : undefined;
});
function submitUpload(): void {
  uploadError.value =
    validateMediaUpload(name.value, type.value, file.value) ?? "";
  if (!uploadError.value && file.value)
    upload.mutate({
      name: name.value.trim(),
      type: type.value,
      file: file.value,
    });
}
function submitEdit(): void {
  editError.value = validateMediaName(editName.value) ?? "";
  if (!editError.value && editing.value)
    update.mutate({ id: editing.value.id, name: editName.value.trim() });
}
function selectFile(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
  uploadError.value = "";
}
function beginEdit(item: MediaItem): void {
  editing.value = item;
  editName.value = item.name;
  editError.value = "";
  update.reset();
}
function beginDelete(item: MediaItem): void {
  deleting.value = item;
  deletionErrorId.value = null;
  remove.reset();
  confirmingDelete.value = true;
}
function mediaTypeLabel(type: MediaType): string {
  return type === "background_music" ? "Background Music" : "Sound Effect";
}
</script>

<template>
  <section aria-labelledby="media-heading" class="space-y-6">
    <h1 id="media-heading" class="text-3xl font-semibold">Media Library</h1>
    <section aria-label="Upload media" class="space-y-3">
      <h2 class="text-xl font-semibold">Upload media</h2>
      <BaseAlert v-if="upload.isError.value" variant="error">{{
        projectError(upload.error.value)
      }}</BaseAlert>
      <form class="space-y-4" novalidate @submit.prevent="submitUpload">
        <FormField label="Media name" :for-id="`${fieldId}-name`">
          <TextInput :id="`${fieldId}-name`" v-model="name" :disabled="busy" />
        </FormField>
        <FormField label="Media type" :for-id="`${fieldId}-type`">
          <SelectInput :id="`${fieldId}-type`" v-model="type" :disabled="busy">
            <option value="background_music">Background Music</option>
            <option value="sound_effect">Sound Effect</option>
          </SelectInput>
        </FormField>
        <FormField label="Audio file" :for-id="`${fieldId}-file`">
          <input
            :id="`${fieldId}-file`"
            ref="fileInput"
            type="file"
            accept="audio/*"
            :disabled="busy"
            class="block w-full rounded border border-gray-300 bg-white px-3 py-2"
            @change="selectFile"
          />
        </FormField>
        <BaseAlert v-if="uploadError" variant="error">{{
          uploadError
        }}</BaseAlert>
        <BaseButton type="submit" :disabled="busy">{{
          upload.isPending.value ? "Uploading…" : "Upload media"
        }}</BaseButton>
      </form>
    </section>
    <section aria-label="Media items" class="space-y-3">
      <FormField label="Filter media" :for-id="`${fieldId}-filter`">
        <SelectInput :id="`${fieldId}-filter`" v-model="filter">
          <option value="all">All</option>
          <option value="background_music">Background Music</option>
          <option value="sound_effect">Sound Effects</option>
        </SelectInput>
      </FormField>
      <LoadingState v-if="items.isPending.value" label="Loading media…" />
      <ErrorState
        v-else-if="items.isError.value"
        title="Could not load media"
        :message="projectError(items.error.value)"
      >
        <template #action
          ><button type="button" class="underline" @click="items.refetch()">
            Try again
          </button></template
        >
      </ErrorState>
      <EmptyState
        v-else-if="!items.data.value?.length"
        title="No media items"
        message="No media items match this filter."
      />
      <ul v-else class="divide-y divide-gray-200">
        <li
          v-for="item in items.data.value"
          :key="item.id"
          class="space-y-2 py-4"
        >
          <h2 class="text-lg font-semibold">{{ item.name }}</h2>
          <p>Type: {{ mediaTypeLabel(item.type) }}</p>
          <p>File: {{ item.fileName }}</p>
          <p>Created: {{ new Date(item.createdAt).toLocaleDateString() }}</p>
          <div class="flex gap-2">
            <BaseButton
              variant="secondary"
              :disabled="busy"
              @click="beginEdit(item)"
              >Edit {{ item.name }}</BaseButton
            >
            <BaseButton
              variant="danger"
              :disabled="busy"
              @click="beginDelete(item)"
              >Delete {{ item.name }}</BaseButton
            >
          </div>
          <form
            v-if="editing?.id === item.id"
            class="space-y-3"
            novalidate
            @submit.prevent="submitEdit"
          >
            <FormField
              label="Edit media name"
              :for-id="`${fieldId}-edit`"
              :error="editError"
            >
              <template #default="{ describedBy, invalid }">
                <TextInput
                  :id="`${fieldId}-edit`"
                  v-model="editName"
                  :disabled="busy"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid"
                />
              </template>
            </FormField>
            <BaseAlert v-if="update.isError.value" variant="error">{{
              projectError(update.error.value)
            }}</BaseAlert>
            <div class="flex gap-2">
              <BaseButton type="submit" :disabled="busy">Save name</BaseButton>
              <BaseButton
                variant="secondary"
                :disabled="busy"
                @click="
                  editing = null;
                  update.reset();
                "
                >Cancel</BaseButton
              >
            </div>
          </form>
          <BaseAlert
            v-if="deletionErrorId === item.id && remove.isError.value"
            variant="error"
          >
            <p>{{ projectError(remove.error.value) }}</p>
            <template v-if="usage">
              <p>
                Scenes using this media:
                {{ usage.sceneIds.join(", ") || "None" }}
              </p>
              <p>
                Cue points using this media:
                {{ usage.cuePointIds.join(", ") || "None" }}
              </p>
            </template>
          </BaseAlert>
        </li>
      </ul>
    </section>
    <ConfirmationDialog
      v-model="confirmingDelete"
      title="Delete media?"
      :message="`Permanently delete ${deleting?.name ?? 'this media item'}? This cannot be undone.`"
      confirm-label="Delete media"
      @confirm="deleting && remove.mutate(deleting.id)"
    />
  </section>
</template>
