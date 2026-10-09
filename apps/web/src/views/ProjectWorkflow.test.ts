import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import type {
  Character,
  CuePoint,
  Episode,
  Project,
  Scene,
} from "@storyteller/shared";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, expect, test, vi } from "vitest";
import App from "../App.vue";
import { routes } from "../router";

const projectId = "00000000-0000-4000-8000-000000000001";
const characterId = "00000000-0000-4000-8000-000000000002";
const episodeId = "00000000-0000-4000-8000-000000000003";
const sceneId = "00000000-0000-4000-8000-000000000004";
const cuePointId = "00000000-0000-4000-8000-000000000005";
const timestamp = "2026-01-01T00:00:00.000Z";

type ApiRequest = { method: string; path: string; body: unknown };

function mockProjectApi(): ApiRequest[] {
  const requests: ApiRequest[] = [];
  let project: Project | undefined;
  let character: Character | undefined;
  let episode: Episode | undefined;
  let scene: Scene | undefined;
  let cuePoint: CuePoint | undefined;

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const path = String(input);
        const method = init?.method ?? "GET";
        const body: unknown = init?.body
          ? JSON.parse(String(init.body))
          : undefined;
        requests.push({ method, path, body });
        let data: unknown;
        if (method === "GET" && path === "/api/projects")
          data = project ? [project] : [];
        else if (method === "POST" && path === "/api/projects") {
          project = {
            id: projectId,
            title: "The Lighthouse",
            genre: "Mystery",
            description: "A coastal story",
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          data = project;
        } else if (method === "GET" && path === `/api/projects/${projectId}`)
          data = project;
        else if (
          method === "GET" &&
          path === `/api/projects/${projectId}/characters`
        )
          data = character ? [character] : [];
        else if (
          method === "POST" &&
          path === `/api/projects/${projectId}/characters`
        ) {
          character = {
            id: characterId,
            projectId,
            name: "Mara",
            type: "main",
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          data = character;
        } else if (
          method === "GET" &&
          path === `/api/projects/${projectId}/episodes`
        )
          data = episode ? [episode] : [];
        else if (
          method === "POST" &&
          path === `/api/projects/${projectId}/episodes`
        ) {
          episode = {
            id: episodeId,
            projectId,
            title: "Arrival",
            description: "The first night",
            position: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          data = episode;
        } else if (
          method === "GET" &&
          path === `/api/episodes/${episodeId}/scenes`
        )
          data = scene ? [scene] : [];
        else if (
          method === "POST" &&
          path === `/api/episodes/${episodeId}/scenes`
        ) {
          scene = {
            id: sceneId,
            episodeId,
            title: "At the harbor",
            backgroundMusicId: null,
            position: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          data = scene;
        } else if (
          method === "GET" &&
          path === `/api/scenes/${sceneId}/cue-points`
        )
          data = cuePoint ? [cuePoint] : [];
        else if (
          method === "POST" &&
          path === `/api/scenes/${sceneId}/cue-points`
        ) {
          cuePoint = {
            id: cuePointId,
            sceneId,
            characterId,
            spokenText: "Is anyone there?",
            soundEffectIds: [],
            position: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          data = cuePoint;
        } else if (
          method === "GET" &&
          (path === "/api/media?type=background_music" ||
            path === "/api/media?type=sound_effect")
        )
          data = [];
        else throw new Error(`Unexpected API request: ${method} ${path}`);
        if (data === undefined)
          throw new Error(`Missing fixture for ${method} ${path}`);
        return new Response(JSON.stringify(data), {
          status: method === "POST" ? 201 : 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    ),
  );
  return requests;
}

async function waitForUi(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    if (condition()) return;
  }
  throw new Error("Expected UI state did not appear");
}

function formFor(wrapper: VueWrapper, label: string) {
  const form = wrapper
    .findAll("form")
    .find((item) => item.find('button[type="submit"]').text() === label);
  if (!form) throw new Error(`Missing form: ${label}`);
  return form;
}

afterEach(() => vi.unstubAllGlobals());

test("create project, character, episode, scene and cue point through the routed UI", async () => {
  const requests = mockProjectApi();
  // Preload the lazy destination so Vite transformation does not delay the routed transition.
  await import("./ProjectView.vue");
  const router = createRouter({ history: createMemoryHistory(), routes });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await router.push("/projects/new");
  await router.isReady();
  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), [VueQueryPlugin, { queryClient }], router],
    },
  });
  try {
    await waitForUi(
      () =>
        wrapper.findAll("form").length === 1 &&
        wrapper.get("h1").text() === "New project",
    );
    const projectForm = formFor(wrapper, "Create project");
    await projectForm.get("#project-title").setValue("The Lighthouse");
    await projectForm.get("#project-genre").setValue("Mystery");
    await projectForm.get("#project-description").setValue("A coastal story");
    await projectForm.trigger("submit");
    await waitForUi(
      () =>
        router.currentRoute.value.path === `/projects/${projectId}` &&
        wrapper.text().includes("No characters"),
    );
    expect(wrapper.get("#project-heading").text()).toBe("The Lighthouse");
    expect(wrapper.text()).toContain("No episodes");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Add character")!
      .trigger("click");
    const characterForm = formFor(wrapper, "Add character");
    await characterForm.get("#character-name").setValue("Mara");
    await characterForm.trigger("submit");
    await waitForUi(() => wrapper.text().includes("Mara (Main)"));
    expect(wrapper.text()).not.toContain("No characters");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Add episode")!
      .trigger("click");
    const episodeForm = formFor(wrapper, "Add episode");
    await episodeForm.get("#episode-title").setValue("Arrival");
    await episodeForm.get("#episode-description").setValue("The first night");
    await episodeForm.trigger("submit");
    await waitForUi(() => wrapper.findAll("details").length === 1);
    expect(wrapper.get("details summary").text()).toContain("1. Arrival");
    await wrapper.get("details summary").trigger("click");
    expect(wrapper.get("details").element.open).toBe(true);
    await waitForUi(() => wrapper.text().includes("No scenes"));

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Add scene")!
      .trigger("click");
    await waitForUi(() =>
      wrapper.findAll("form").some((form) => form.text().includes("Add scene")),
    );
    const sceneForm = formFor(wrapper, "Add scene");
    await sceneForm.get("input").setValue("At the harbor");
    await sceneForm.trigger("submit");
    await waitForUi(() => wrapper.findAll("details").length === 2);
    expect(wrapper.findAll("details")[1]!.get("summary").text()).toContain(
      "1. At the harbor",
    );
    await wrapper.findAll("details")[1]!.get("summary").trigger("click");
    expect(wrapper.findAll("details")[1]!.element.open).toBe(true);
    await waitForUi(() => wrapper.text().includes("No cue points"));

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Add cue point")!
      .trigger("click");
    await waitForUi(() =>
      wrapper
        .findAll("form")
        .some((form) => form.text().includes("Add cue point")),
    );
    const cueForm = formFor(wrapper, "Add cue point");
    expect(cueForm.get("select").text()).toContain("Mara");
    await cueForm.get("select").setValue(characterId);
    await cueForm.get("textarea").setValue("Is anyone there?");
    await cueForm.trigger("submit");
    await waitForUi(() => wrapper.text().includes("Is anyone there?"));
    expect(wrapper.findAll("details")[1]!.text()).toContain("1. Mara");
    expect(wrapper.text()).not.toContain("No cue points");
    for (const [selector, icon] of [
      ["#project-heading", "folder"],
      ["#characters-heading", "users"],
      ["#episodes-heading", "clapperboard"],
      ['section[aria-label="Scenes"] h3', "panels-top-left"],
      ['section[aria-label="Cue points"] h4', "list-ordered"],
    ]) {
      expect(wrapper.get(`${selector} svg`).classes()).toContain(
        `lucide-${icon}`,
      );
    }
    expect(wrapper.find("svg.lucide-user-round").exists()).toBe(true);
    expect(wrapper.find("svg.lucide-music").exists()).toBe(true);
    expect(wrapper.find("svg.lucide-audio-lines").exists()).toBe(true);
    for (const [label, icon] of [
      ["Add character", "plus"],
      ["Edit project", "pencil"],
      ["Delete project", "trash-2"],
      ["Move Arrival up", "arrow-up"],
      ["Move Arrival down", "arrow-down"],
    ]) {
      const button = wrapper
        .findAll("button")
        .find((item) => item.text() === label);
      expect(button?.get("svg").classes()).toContain(`lucide-${icon}`);
    }

    expect(requests.filter((request) => request.method === "POST")).toEqual([
      {
        method: "POST",
        path: "/api/projects",
        body: {
          title: "The Lighthouse",
          genre: "Mystery",
          description: "A coastal story",
        },
      },
      {
        method: "POST",
        path: `/api/projects/${projectId}/characters`,
        body: { name: "Mara", type: "main" },
      },
      {
        method: "POST",
        path: `/api/projects/${projectId}/episodes`,
        body: { title: "Arrival", description: "The first night" },
      },
      {
        method: "POST",
        path: `/api/episodes/${episodeId}/scenes`,
        body: { title: "At the harbor", backgroundMusicId: null },
      },
      {
        method: "POST",
        path: `/api/scenes/${sceneId}/cue-points`,
        body: {
          characterId,
          spokenText: "Is anyone there?",
          soundEffectIds: [],
        },
      },
    ]);
    for (const path of [
      `/api/projects/${projectId}/characters`,
      `/api/projects/${projectId}/episodes`,
      `/api/episodes/${episodeId}/scenes`,
      `/api/scenes/${sceneId}/cue-points`,
    ]) {
      expect(
        requests.filter(
          (request) => request.method === "GET" && request.path === path,
        ).length,
      ).toBeGreaterThanOrEqual(2);
    }
  } finally {
    wrapper.unmount();
    queryClient.clear();
  }
});
