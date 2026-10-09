<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type { CreateCuePointRequest, CuePoint } from "@storyteller/shared";
import { computed, ref } from "vue";
import {
  cuePointsByPosition,
  movedCuePointIds,
  projectError,
  projectKeys,
  projectsApi,
} from "../projects";
import CuePointForm from "./CuePointForm.vue";
import BaseButton from "./ui/BaseButton.vue";
import ConfirmationDialog from "./ui/ConfirmationDialog.vue";
import EmptyState from "./ui/EmptyState.vue";
import ErrorState from "./ui/ErrorState.vue";
import LoadingState from "./ui/LoadingState.vue";

const props = defineProps<{ sceneId: string; projectId: string }>();
const queryClient = useQueryClient();
const points = useQuery({
  queryKey: computed(() => projectKeys.cuePoints(props.sceneId)),
  queryFn: () => projectsApi.cuePoints(props.sceneId),
});
const characters = useQuery({
  queryKey: computed(() => projectKeys.characters(props.projectId)),
  queryFn: () => projectsApi.characters(props.projectId),
});
const effects = useQuery({
  queryKey: projectKeys.soundEffects,
  queryFn: projectsApi.soundEffects,
});
const availableEffects = computed(() =>
  (effects.data.value ?? []).filter((item) => item.type === "sound_effect"),
);
const orderedPoints = computed(() =>
  cuePointsByPosition(points.data.value ?? []),
);
const adding = ref(false);
const editing = ref<CuePoint | null>(null);
const deleting = ref<CuePoint | null>(null);
const confirmingDelete = ref(false);
const create = useMutation({
  meta: { successMessage: "Cue point created." },
  mutationFn: (input: CreateCuePointRequest) =>
    projectsApi.createCuePoint(props.sceneId, input),
  onSuccess: async (saved) => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.cuePoints(saved.sceneId),
      exact: true,
    });
    adding.value = false;
  },
});
const update = useMutation({
  meta: { successMessage: "Cue point updated." },
  mutationFn: ({ id, input }: { id: string; input: CreateCuePointRequest }) =>
    projectsApi.updateCuePoint(id, input),
  onSuccess: async (saved) => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.cuePoints(saved.sceneId),
      exact: true,
    });
    editing.value = null;
  },
});
const remove = useMutation({
  meta: { successMessage: "Cue point deleted." },
  mutationFn: (id: string) => projectsApi.deleteCuePoint(id),
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.cuePoints(props.sceneId),
      exact: true,
    });
    deleting.value = null;
  },
});
const reorder = useMutation({
  meta: { successMessage: "Cue point order updated." },
  mutationFn: (cuePointIds: string[]) =>
    projectsApi.reorderCuePoints(props.sceneId, { cuePointIds }),
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.cuePoints(props.sceneId),
      exact: true,
    });
  },
});
const busy = computed(
  () =>
    create.isPending.value ||
    update.isPending.value ||
    remove.isPending.value ||
    reorder.isPending.value,
);
function movePoint(index: number, offset: -1 | 1): void {
  if (busy.value) return;
  const ids = movedCuePointIds(orderedPoints.value, index, offset);
  if (ids) reorder.mutate(ids);
}
</script>

<template>
  <section class="space-y-3" aria-label="Cue points">
    <h4 class="font-semibold">Cue points</h4>
    <template v-if="adding">
      <h5 class="font-semibold">Add cue point</h5>
      <LoadingState
        v-if="characters.isPending.value || effects.isPending.value"
        label="Loading cue point options…"
      />
      <ErrorState
        v-else-if="characters.isError.value || effects.isError.value"
        title="Could not load cue point options"
        :message="projectError(characters.error.value ?? effects.error.value)"
      >
        <template #action
          ><button
            type="button"
            class="underline"
            @click="
              characters.refetch();
              effects.refetch();
            "
          >
            Try again
          </button></template
        >
      </ErrorState>
      <CuePointForm
        v-else
        :characters="characters.data.value ?? []"
        :effects="availableEffects"
        submit-label="Add cue point"
        :submitting="busy"
        @submit="create.mutate"
      />
      <BaseButton
        variant="secondary"
        :disabled="busy"
        @click="
          adding = false;
          create.reset();
        "
        >Cancel</BaseButton
      >
    </template>
    <BaseButton
      v-else
      variant="secondary"
      :disabled="busy"
      @click="
        adding = true;
        editing = null;
        create.reset();
        update.reset();
        remove.reset();
        reorder.reset();
      "
      >Add cue point</BaseButton
    >
    <LoadingState v-if="points.isPending.value" label="Loading cue points…" />
    <ErrorState
      v-else-if="points.isError.value"
      title="Could not load cue points"
      :message="projectError(points.error.value)"
    >
      <template #action
        ><button type="button" class="underline" @click="points.refetch()">
          Try again
        </button></template
      >
    </ErrorState>
    <EmptyState
      v-else-if="!orderedPoints.length"
      title="No cue points"
      message="This scene has no cue points yet."
    />
    <ol v-else class="list-none divide-y divide-gray-200">
      <li
        v-for="(point, index) in orderedPoints"
        :key="point.id"
        class="space-y-3 py-3"
      >
        <p class="font-medium">
          {{ index + 1 }}.
          {{
            characters.data.value?.find(
              (character) => character.id === point.characterId,
            )?.name ?? "Assigned character"
          }}
        </p>
        <p class="whitespace-pre-wrap">{{ point.spokenText }}</p>
        <p>
          Sound effects:
          {{
            point.soundEffectIds
              .map(
                (id) =>
                  availableEffects.find((effect) => effect.id === id)?.name ??
                  "Assigned effect",
              )
              .join(", ") || "None"
          }}
        </p>
        <div class="flex flex-wrap gap-2">
          <BaseButton
            variant="secondary"
            :disabled="busy || index === 0"
            @click="movePoint(index, -1)"
            >Move cue point {{ index + 1 }} up</BaseButton
          >
          <BaseButton
            variant="secondary"
            :disabled="busy || index === orderedPoints.length - 1"
            @click="movePoint(index, 1)"
            >Move cue point {{ index + 1 }} down</BaseButton
          >
          <BaseButton
            variant="secondary"
            :disabled="busy"
            @click="
              editing = point;
              adding = false;
              update.reset();
              create.reset();
              remove.reset();
              reorder.reset();
            "
            >Edit cue point {{ index + 1 }}</BaseButton
          >
          <BaseButton
            variant="danger"
            :disabled="busy"
            @click="
              deleting = point;
              confirmingDelete = true;
              remove.reset();
            "
            >Delete cue point {{ index + 1 }}</BaseButton
          >
        </div>
        <div v-if="editing?.id === point.id" class="space-y-3">
          <LoadingState
            v-if="characters.isPending.value || effects.isPending.value"
            label="Loading cue point options…"
          />
          <ErrorState
            v-else-if="characters.isError.value || effects.isError.value"
            title="Could not load cue point options"
            :message="
              projectError(characters.error.value ?? effects.error.value)
            "
          >
            <template #action
              ><button
                type="button"
                class="underline"
                @click="
                  characters.refetch();
                  effects.refetch();
                "
              >
                Try again
              </button></template
            >
          </ErrorState>
          <CuePointForm
            v-else
            :key="point.id"
            :initial="point"
            :characters="characters.data.value ?? []"
            :effects="availableEffects"
            submit-label="Save cue point"
            :submitting="busy"
            @submit="(input) => update.mutate({ id: point.id, input })"
          />
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
      </li>
    </ol>
    <ConfirmationDialog
      v-model="confirmingDelete"
      title="Delete cue point?"
      message="Permanently delete this cue point? This cannot be undone."
      confirm-label="Delete cue point"
      @confirm="deleting && remove.mutate(deleting.id)"
    />
  </section>
</template>
