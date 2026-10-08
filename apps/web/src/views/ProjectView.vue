<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import type {
  Character,
  CreateCharacterRequest,
  UpdateProjectRequest,
} from "@storyteller/shared";
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ApiError } from "../api-client";
import CharacterForm from "../components/CharacterForm.vue";
import ProjectForm from "../components/ProjectForm.vue";
import BaseAlert from "../components/ui/BaseAlert.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import ConfirmationDialog from "../components/ui/ConfirmationDialog.vue";
import EmptyState from "../components/ui/EmptyState.vue";
import ErrorState from "../components/ui/ErrorState.vue";
import LoadingState from "../components/ui/LoadingState.vue";
import { projectError, projectKeys, projectsApi } from "../projects";

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const projectId = computed(() => String(route.params.projectId ?? ""));
const project = useQuery({
  queryKey: computed(() => projectKeys.detail(projectId.value)),
  queryFn: () => projectsApi.get(projectId.value),
});
const characters = useQuery({
  queryKey: computed(() => projectKeys.characters(projectId.value)),
  queryFn: () => projectsApi.characters(projectId.value),
  enabled: computed(() => project.isSuccess.value),
});
const episodes = useQuery({
  queryKey: computed(() => projectKeys.episodes(projectId.value)),
  queryFn: () => projectsApi.episodes(projectId.value),
  enabled: computed(() => project.isSuccess.value),
});
const editing = ref(false);
const confirmingDelete = ref(false);
const addingCharacter = ref(false);
const editingCharacter = ref<Character | null>(null);
const deletingCharacter = ref<Character | null>(null);
const confirmingCharacterDelete = ref(false);
const createCharacter = useMutation({
  mutationFn: (input: CreateCharacterRequest) =>
    projectsApi.createCharacter(projectId.value, input),
  onSuccess: async (saved) => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.characters(saved.projectId),
      exact: true,
    });
    addingCharacter.value = false;
  },
});
const updateCharacter = useMutation({
  mutationFn: ({ id, input }: { id: string; input: CreateCharacterRequest }) =>
    projectsApi.updateCharacter(id, input),
  onSuccess: async (saved) => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.characters(saved.projectId),
      exact: true,
    });
    editingCharacter.value = null;
  },
});
const removeCharacter = useMutation({
  mutationFn: (id: string) => projectsApi.deleteCharacter(id),
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: projectKeys.characters(projectId.value),
      exact: true,
    });
    deletingCharacter.value = null;
  },
});
const characterDeleteError = computed(() =>
  removeCharacter.error.value instanceof ApiError &&
  removeCharacter.error.value.status === 409
    ? "This character is used by a cue point and cannot be deleted."
    : projectError(removeCharacter.error.value),
);
const update = useMutation({
  mutationFn: (input: UpdateProjectRequest) =>
    projectsApi.update(projectId.value, input),
  onSuccess: async (saved) => {
    queryClient.setQueryData(projectKeys.detail(saved.id), saved);
    await queryClient.invalidateQueries({
      queryKey: projectKeys.list,
      exact: true,
    });
    editing.value = false;
  },
});
const remove = useMutation({
  mutationFn: () => projectsApi.delete(projectId.value),
  onSuccess: async () => {
    queryClient.removeQueries({
      queryKey: projectKeys.detail(projectId.value),
      exact: true,
    });
    await queryClient.invalidateQueries({
      queryKey: projectKeys.list,
      exact: true,
    });
    await router.push({ name: "projects" });
  },
});
</script>

<template>
  <section aria-labelledby="project-heading" class="space-y-6">
    <RouterLink class="inline-block underline underline-offset-4" to="/projects"
      >Back to projects</RouterLink
    >
    <LoadingState v-if="project.isPending.value" label="Loading project…" />
    <ErrorState
      v-else-if="project.isError.value"
      title="Could not load project"
      :message="projectError(project.error.value)"
    >
      <template #action
        ><button class="underline" type="button" @click="project.refetch()">
          Try again
        </button></template
      >
    </ErrorState>
    <template v-else-if="project.data.value">
      <h1 id="project-heading" class="text-3xl font-semibold">
        {{ project.data.value.title }}
      </h1>
      <BaseAlert
        v-if="update.isError.value || remove.isError.value"
        variant="error"
        >{{ projectError(update.error.value ?? remove.error.value) }}</BaseAlert
      >
      <template v-if="editing">
        <h2 class="text-xl font-semibold">Edit project</h2>
        <ProjectForm
          :key="project.data.value.id"
          :initial="project.data.value"
          submit-label="Save changes"
          :submitting="update.isPending.value"
          @submit="update.mutate"
        />
        <BaseButton
          variant="secondary"
          :disabled="update.isPending.value"
          @click="
            editing = false;
            update.reset();
          "
          >Cancel</BaseButton
        >
      </template>
      <template v-else>
        <dl class="space-y-2 rounded border border-gray-300 bg-white p-5">
          <div>
            <dt class="font-medium">Genre</dt>
            <dd>{{ project.data.value.genre }}</dd>
          </div>
          <div>
            <dt class="font-medium">Description</dt>
            <dd class="whitespace-pre-wrap">
              {{ project.data.value.description || "No description." }}
            </dd>
          </div>
          <div>
            <dt class="font-medium">Created</dt>
            <dd>
              <time :datetime="project.data.value.createdAt">{{
                new Date(project.data.value.createdAt).toLocaleDateString()
              }}</time>
            </dd>
          </div>
          <div>
            <dt class="font-medium">Modified</dt>
            <dd>
              <time :datetime="project.data.value.updatedAt">{{
                new Date(project.data.value.updatedAt).toLocaleDateString()
              }}</time>
            </dd>
          </div>
        </dl>
        <div class="flex gap-3">
          <BaseButton
            variant="secondary"
            :disabled="remove.isPending.value"
            @click="
              editing = true;
              update.reset();
            "
            >Edit project</BaseButton
          >
          <BaseButton
            variant="danger"
            :disabled="remove.isPending.value"
            @click="
              confirmingDelete = true;
              remove.reset();
            "
            >Delete project</BaseButton
          >
        </div>
      </template>
      <section aria-labelledby="characters-heading" class="space-y-3">
        <h2 id="characters-heading" class="text-xl font-semibold">
          Characters
        </h2>
        <BaseAlert
          v-if="
            createCharacter.isError.value ||
            updateCharacter.isError.value ||
            removeCharacter.isError.value
          "
          variant="error"
          >{{
            removeCharacter.isError.value
              ? characterDeleteError
              : projectError(
                  createCharacter.error.value ?? updateCharacter.error.value,
                )
          }}</BaseAlert
        >
        <template v-if="addingCharacter">
          <h3 class="text-lg font-semibold">Add character</h3>
          <CharacterForm
            submit-label="Add character"
            :submitting="createCharacter.isPending.value"
            @submit="createCharacter.mutate"
          />
          <BaseButton
            variant="secondary"
            :disabled="createCharacter.isPending.value"
            @click="
              addingCharacter = false;
              createCharacter.reset();
            "
            >Cancel</BaseButton
          >
        </template>
        <BaseButton
          v-else
          variant="secondary"
          :disabled="
            removeCharacter.isPending.value || updateCharacter.isPending.value
          "
          @click="
            addingCharacter = true;
            editingCharacter = null;
            createCharacter.reset();
            updateCharacter.reset();
            removeCharacter.reset();
          "
          >Add character</BaseButton
        >
        <LoadingState
          v-if="characters.isPending.value"
          label="Loading characters…"
        />
        <ErrorState
          v-else-if="characters.isError.value"
          title="Could not load characters"
          :message="projectError(characters.error.value)"
        >
          <template #action
            ><button
              class="underline"
              type="button"
              @click="characters.refetch()"
            >
              Try again
            </button></template
          >
        </ErrorState>
        <EmptyState
          v-else-if="!characters.data.value?.length"
          title="No characters"
          message="This project has no characters yet."
        />
        <ul
          v-else
          class="divide-y divide-gray-200 rounded border border-gray-300 bg-white"
        >
          <li
            v-for="character in characters.data.value"
            :key="character.id"
            class="space-y-3 p-5"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <span
                >{{ character.name }} ({{
                  character.type === "main" ? "Main" : "Supporting"
                }})</span
              >
              <div class="flex gap-2">
                <BaseButton
                  variant="secondary"
                  :disabled="
                    removeCharacter.isPending.value ||
                    updateCharacter.isPending.value ||
                    createCharacter.isPending.value
                  "
                  @click="
                    editingCharacter = character;
                    addingCharacter = false;
                    updateCharacter.reset();
                    createCharacter.reset();
                    removeCharacter.reset();
                  "
                  >Edit {{ character.name }}</BaseButton
                >
                <BaseButton
                  variant="danger"
                  :disabled="
                    removeCharacter.isPending.value ||
                    updateCharacter.isPending.value ||
                    createCharacter.isPending.value
                  "
                  @click="
                    deletingCharacter = character;
                    confirmingCharacterDelete = true;
                    removeCharacter.reset();
                  "
                  >Delete {{ character.name }}</BaseButton
                >
              </div>
            </div>
            <div v-if="editingCharacter?.id === character.id" class="space-y-3">
              <CharacterForm
                :key="character.id"
                :initial="character"
                submit-label="Save character"
                :submitting="updateCharacter.isPending.value"
                @submit="
                  (input) => updateCharacter.mutate({ id: character.id, input })
                "
              />
              <BaseButton
                variant="secondary"
                :disabled="updateCharacter.isPending.value"
                @click="
                  editingCharacter = null;
                  updateCharacter.reset();
                "
                >Cancel</BaseButton
              >
            </div>
          </li>
        </ul>
      </section>
      <section aria-labelledby="episodes-heading" class="space-y-3">
        <h2 id="episodes-heading" class="text-xl font-semibold">Episodes</h2>
        <LoadingState
          v-if="episodes.isPending.value"
          label="Loading episodes…"
        />
        <ErrorState
          v-else-if="episodes.isError.value"
          title="Could not load episodes"
          :message="projectError(episodes.error.value)"
        >
          <template #action
            ><button
              class="underline"
              type="button"
              @click="episodes.refetch()"
            >
              Try again
            </button></template
          >
        </ErrorState>
        <EmptyState
          v-else-if="!episodes.data.value?.length"
          title="No episodes"
          message="This project has no episodes yet."
        />
        <ol
          v-else
          class="list-inside list-decimal rounded border border-gray-300 bg-white p-5"
        >
          <li v-for="episode in episodes.data.value" :key="episode.id">
            {{ episode.title }}
          </li>
        </ol>
      </section>
    </template>
    <ConfirmationDialog
      v-model="confirmingCharacterDelete"
      title="Delete character?"
      :message="`Permanently delete ${deletingCharacter?.name ?? 'this character'}? This cannot be undone.`"
      confirm-label="Delete character"
      @confirm="
        deletingCharacter && removeCharacter.mutate(deletingCharacter.id)
      "
    />
    <ConfirmationDialog
      v-model="confirmingDelete"
      title="Delete project?"
      message="This will permanently delete the project and all its contents, including characters and episodes. This cannot be undone."
      confirm-label="Delete project"
      @confirm="remove.mutate()"
    />
  </section>
</template>
