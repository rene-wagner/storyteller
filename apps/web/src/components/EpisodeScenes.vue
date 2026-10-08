<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type { CreateSceneRequest, Scene } from "@storyteller/shared";
import { computed, ref } from "vue";
import {
  movedSceneIds,
  projectError,
  projectKeys,
  projectsApi,
  scenesByPosition,
} from "../projects";
import SceneForm from "./SceneForm.vue";
import SceneCuePoints from "./SceneCuePoints.vue";
import Accordion from "./ui/Accordion.vue";
import AccordionContent from "./ui/AccordionContent.vue";
import AccordionHeader from "./ui/AccordionHeader.vue";
import AccordionItem from "./ui/AccordionItem.vue";
import BaseAlert from "./ui/BaseAlert.vue";
import BaseButton from "./ui/BaseButton.vue";
import ConfirmationDialog from "./ui/ConfirmationDialog.vue";
import EmptyState from "./ui/EmptyState.vue";
import ErrorState from "./ui/ErrorState.vue";
import LoadingState from "./ui/LoadingState.vue";

const props = defineProps<{ episodeId: string; projectId: string }>();
const queryClient = useQueryClient();
const scenes = useQuery({
  queryKey: computed(() => projectKeys.scenes(props.episodeId)),
  queryFn: () => projectsApi.scenes(props.episodeId),
});
const orderedScenes = computed(() => scenesByPosition(scenes.data.value ?? []));
const adding = ref(false);
const editing = ref<Scene | null>(null);
const deleting = ref<Scene | null>(null);
const confirmingDelete = ref(false);
const music = useQuery({
  queryKey: projectKeys.backgroundMusic,
  queryFn: projectsApi.backgroundMusic,
});
const availableMusic = computed(() =>
  (music.data.value ?? []).filter((item) => item.type === "background_music"),
);
const create = useMutation({
  mutationFn: (input: CreateSceneRequest) =>
    projectsApi.createScene(props.episodeId, input),
  onSuccess: async (saved) => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.scenes(saved.episodeId),
      exact: true,
    });
    adding.value = false;
  },
});
const update = useMutation({
  mutationFn: ({ id, input }: { id: string; input: CreateSceneRequest }) =>
    projectsApi.updateScene(id, input),
  onSuccess: async (saved) => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.scenes(saved.episodeId),
      exact: true,
    });
    editing.value = null;
  },
});
const remove = useMutation({
  mutationFn: (id: string) => projectsApi.deleteScene(id),
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.scenes(props.episodeId),
      exact: true,
    });
    deleting.value = null;
  },
});
const reorder = useMutation({
  mutationFn: (sceneIds: string[]) =>
    projectsApi.reorderScenes(props.episodeId, { sceneIds }),
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.scenes(props.episodeId),
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
function moveScene(index: number, offset: -1 | 1): void {
  if (busy.value) return;
  const ids = movedSceneIds(orderedScenes.value, index, offset);
  if (ids) reorder.mutate(ids);
}
</script>

<template>
  <section class="space-y-3" aria-label="Scenes">
    <h3 class="text-lg font-semibold">Scenes</h3>
    <BaseAlert
      v-if="
        create.isError.value ||
        update.isError.value ||
        remove.isError.value ||
        reorder.isError.value
      "
      variant="error"
      >{{
        projectError(
          create.error.value ??
            update.error.value ??
            remove.error.value ??
            reorder.error.value,
        )
      }}</BaseAlert
    >
    <template v-if="adding">
      <h4 class="font-semibold">Add scene</h4>
      <LoadingState
        v-if="music.isPending.value"
        label="Loading background music…"
      />
      <ErrorState
        v-else-if="music.isError.value"
        title="Could not load background music"
        :message="projectError(music.error.value)"
      >
        <template #action
          ><button class="underline" type="button" @click="music.refetch()">
            Try again
          </button></template
        >
      </ErrorState>
      <SceneForm
        v-else
        :music="availableMusic"
        submit-label="Add scene"
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
      >Add scene</BaseButton
    >
    <LoadingState v-if="scenes.isPending.value" label="Loading scenes…" />
    <ErrorState
      v-else-if="scenes.isError.value"
      title="Could not load scenes"
      :message="projectError(scenes.error.value)"
    >
      <template #action
        ><button class="underline" type="button" @click="scenes.refetch()">
          Try again
        </button></template
      >
    </ErrorState>
    <EmptyState
      v-else-if="!orderedScenes.length"
      title="No scenes"
      message="This episode has no scenes yet."
    />
    <Accordion v-else>
      <ol class="list-none divide-y divide-gray-200">
        <li v-for="(scene, index) in orderedScenes" :key="scene.id">
          <AccordionItem>
            <AccordionHeader
              >{{ index + 1 }}. {{ scene.title }}</AccordionHeader
            >
            <AccordionContent>
              <div class="space-y-3">
                <p>
                  Background music:
                  {{
                    availableMusic.find(
                      (item) => item.id === scene.backgroundMusicId,
                    )?.name ??
                    (scene.backgroundMusicId ? "Assigned music" : "None")
                  }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <BaseButton
                    variant="secondary"
                    :disabled="busy || index === 0"
                    @click="moveScene(index, -1)"
                    >Move {{ scene.title }} up</BaseButton
                  >
                  <BaseButton
                    variant="secondary"
                    :disabled="busy || index === orderedScenes.length - 1"
                    @click="moveScene(index, 1)"
                    >Move {{ scene.title }} down</BaseButton
                  >
                  <BaseButton
                    variant="secondary"
                    :disabled="busy"
                    @click="
                      editing = scene;
                      adding = false;
                      update.reset();
                      create.reset();
                      remove.reset();
                      reorder.reset();
                    "
                    >Edit {{ scene.title }}</BaseButton
                  >
                  <BaseButton
                    variant="danger"
                    :disabled="busy"
                    @click="
                      deleting = scene;
                      confirmingDelete = true;
                      remove.reset();
                    "
                    >Delete {{ scene.title }}</BaseButton
                  >
                </div>
                <div v-if="editing?.id === scene.id" class="space-y-3">
                  <LoadingState
                    v-if="music.isPending.value"
                    label="Loading background music…"
                  />
                  <ErrorState
                    v-else-if="music.isError.value"
                    title="Could not load background music"
                    :message="projectError(music.error.value)"
                  >
                    <template #action
                      ><button
                        class="underline"
                        type="button"
                        @click="music.refetch()"
                      >
                        Try again
                      </button></template
                    >
                  </ErrorState>
                  <SceneForm
                    v-else
                    :key="scene.id"
                    :initial="scene"
                    :music="availableMusic"
                    submit-label="Save scene"
                    :submitting="busy"
                    @submit="(input) => update.mutate({ id: scene.id, input })"
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
                <SceneCuePoints :scene-id="scene.id" :project-id="projectId" />
              </div>
            </AccordionContent>
          </AccordionItem>
        </li>
      </ol>
    </Accordion>
    <ConfirmationDialog
      v-model="confirmingDelete"
      title="Delete scene?"
      :message="`Permanently delete ${deleting?.title ?? 'this scene'} and its contents? This cannot be undone.`"
      confirm-label="Delete scene"
      @confirm="deleting && remove.mutate(deleting.id)"
    />
  </section>
</template>
