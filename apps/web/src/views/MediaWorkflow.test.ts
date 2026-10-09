import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import type {
  Character,
  CuePoint,
  Episode,
  MediaItem,
  Project,
  Scene,
} from "@storyteller/shared";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
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
const musicId = "00000000-0000-4000-8000-000000000006";
const effectId = "00000000-0000-4000-8000-000000000007";
const timestamp = "2026-01-01T00:00:00.000Z";

type ApiRequest = {
  method: string;
  path: string;
  body: unknown;
  headers: Headers;
};

function mockMediaWorkflowApi(): ApiRequest[] {
  const requests: ApiRequest[] = [];
  const project: Project = {
    id: projectId,
    title: "The Lighthouse",
    genre: "Mystery",
    description: "A coastal story",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const character: Character = {
    id: characterId,
    projectId,
    name: "Mara",
    type: "main",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const episode: Episode = {
    id: episodeId,
    projectId,
    title: "Arrival",
    description: "The first night",
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  let scene: Scene = {
    id: sceneId,
    episodeId,
    title: "At the harbor",
    backgroundMusicId: null,
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  let cuePoint: CuePoint = {
    id: cuePointId,
    sceneId,
    characterId,
    spokenText: "Is anyone there?",
    soundEffectIds: [],
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const media: MediaItem[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const path = String(input);
        const method = init?.method ?? "GET";
        const body: unknown =
          init?.body instanceof FormData
            ? init.body
            : init?.body
              ? JSON.parse(String(init.body))
              : undefined;
        requests.push({
          method,
          path,
          body,
          headers: new Headers(init?.headers),
        });
        let data: unknown;
        if (method === "GET" && path === "/api/media") data = [...media];
        else if (method === "POST" && path === "/api/media") {
          if (!(body instanceof FormData))
            throw new Error("Expected multipart upload");
          const file = body.get("file");
          if (!(file instanceof File)) throw new Error("Expected audio file");
          const type = body.get("type");
          if (type !== "background_music" && type !== "sound_effect")
            throw new Error("Unexpected media type");
          const item: MediaItem = {
            id: type === "background_music" ? musicId : effectId,
            name: String(body.get("name")),
            type,
            fileName: file.name,
            mimeType: file.type,
            fileSize: String(file.size),
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          media.push(item);
          data = item;
        } else if (method === "GET" && path === `/api/projects/${projectId}`)
          data = project;
        else if (
          method === "GET" &&
          path === `/api/projects/${projectId}/characters`
        )
          data = [character];
        else if (
          method === "GET" &&
          path === `/api/projects/${projectId}/episodes`
        )
          data = [episode];
        else if (
          method === "GET" &&
          path === `/api/episodes/${episodeId}/scenes`
        )
          data = [scene];
        else if (
          method === "GET" &&
          path === `/api/scenes/${sceneId}/cue-points`
        )
          data = [cuePoint];
        else if (
          method === "GET" &&
          path === "/api/media?type=background_music"
        )
          data = media.filter((item) => item.type === "background_music");
        else if (method === "GET" && path === "/api/media?type=sound_effect")
          data = media.filter((item) => item.type === "sound_effect");
        else if (method === "PATCH" && path === `/api/scenes/${sceneId}`) {
          if (
            !body ||
            typeof body !== "object" ||
            !("backgroundMusicId" in body) ||
            typeof body.backgroundMusicId !== "string"
          )
            throw new Error("Missing music assignment");
          scene = { ...scene, backgroundMusicId: body.backgroundMusicId };
          data = scene;
        } else if (
          method === "PATCH" &&
          path === `/api/cue-points/${cuePointId}`
        ) {
          if (
            !body ||
            typeof body !== "object" ||
            !("soundEffectIds" in body) ||
            !Array.isArray(body.soundEffectIds) ||
            !body.soundEffectIds.every((id: unknown) => typeof id === "string")
          )
            throw new Error("Missing effect assignment");
          cuePoint = { ...cuePoint, soundEffectIds: body.soundEffectIds };
          data = cuePoint;
        } else throw new Error(`Unexpected API request: ${method} ${path}`);
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

function findForm(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAll("form")
    .find((item) => item.find('button[type="submit"]').text() === label);
}

function formFor(wrapper: VueWrapper, label: string) {
  const form = findForm(wrapper, label);
  if (!form) throw new Error(`Missing form: ${label}`);
  return form;
}

async function uploadFile(
  wrapper: VueWrapper,
  name: string,
  type: string,
  file: File,
) {
  const form = formFor(wrapper, "Upload media");
  await form.get('input[type="text"]').setValue(name);
  await form.get("select").setValue(type);
  const input = form.get('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  await input.trigger("change");
  await form.trigger("submit");
  await waitForUi(() => wrapper.text().includes(`File: ${file.name}`));
}

afterEach(() => vi.unstubAllGlobals());

test("blocked media deletion identifies the project, episode, scene and cue position", async () => {
  const originalShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  const originalClose = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "close",
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  const media: MediaItem[] = [
    {
      id: musicId,
      name: "Theme",
      type: "background_music",
      fileName: "theme.wav",
      mimeType: "audio/wav",
      fileSize: "5",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: effectId,
      name: "Static",
      type: "sound_effect",
      fileName: "static.wav",
      mimeType: "audio/wav",
      fileSize: "5",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      requests.push(`${init?.method ?? "GET"} ${path}`);
      if (path === "/api/media" && !init?.method) return Response.json(media);
      const usage = path.endsWith(musicId)
        ? {
            sceneIds: [sceneId],
            cuePointIds: [],
            scenes: [
              {
                id: sceneId,
                projectTitle: "The Lighthouse",
                episodeTitle: "Arrival",
                sceneTitle: "At the harbor",
              },
            ],
            cuePoints: [],
          }
        : {
            sceneIds: [],
            cuePointIds: [cuePointId],
            scenes: [],
            cuePoints: [
              {
                id: cuePointId,
                projectTitle: "The Lighthouse",
                episodeTitle: "Arrival",
                sceneTitle: "At the harbor",
                position: 0,
              },
            ],
          };
      return Response.json(
        {
          error: {
            code: "CONFLICT",
            message: "Media item is in use.",
            details: [],
            usage,
          },
        },
        { status: 409 },
      );
    }),
  );
  const { default: MediaView } = await import("./MediaView.vue");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(MediaView, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  try {
    await waitForUi(() => wrapper.text().includes("Static"));
    for (const [fileName, label] of [
      ["theme.wav", "The Lighthouse / Arrival / At the harbor"],
      ["static.wav", "The Lighthouse / Arrival / At the harbor / Cue 1"],
    ]) {
      const item = wrapper
        .findAll("li")
        .find((entry) => entry.text().includes(`File: ${fileName}`))!;
      await item
        .findAll("button")
        .find((button) => button.text() === "Delete")!
        .trigger("click");
      await wrapper.get("dialog[open] button:last-child").trigger("click");
      await waitForUi(() => wrapper.text().includes(label));
      expect(item.text()).toContain("Media item is in use.");
      expect(item.text()).toContain(label);
    }
    expect(requests.filter((request) => request.startsWith("DELETE"))).toEqual([
      `DELETE /api/media/${musicId}`,
      `DELETE /api/media/${effectId}`,
    ]);
  } finally {
    wrapper.unmount();
    queryClient.clear();
    for (const [name, descriptor] of [
      ["showModal", originalShowModal],
      ["close", originalClose],
    ] as const) {
      if (descriptor)
        Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  }
});

test("upload music and assign it to a scene, then upload an effect and assign it to a cue point", async () => {
  const requests = mockMediaWorkflowApi();
  await Promise.all([import("./MediaView.vue"), import("./ProjectView.vue")]);
  const router = createRouter({ history: createMemoryHistory(), routes });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await router.push("/media");
  await router.isReady();
  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), [VueQueryPlugin, { queryClient }], router],
    },
  });
  try {
    await waitForUi(() => wrapper.text().includes("No media items"));
    await uploadFile(
      wrapper,
      "Harbor ambience",
      "background_music",
      new File(["music"], "harbor.mp3", { type: "audio/mpeg" }),
    );
    expect(wrapper.text()).toContain("Harbor ambience");

    await router.push(`/projects/${projectId}`);
    await waitForUi(() => wrapper.findAll("details").length === 2);
    await wrapper.get("details summary").trigger("click");
    await wrapper.findAll("details")[1]!.get("summary").trigger("click");
    await waitForUi(() => wrapper.text().includes("Background music: None"));
    await wrapper
      .findAll("details")[1]!
      .findAll("button")
      .find((button) => button.text() === "Edit At the harbor")!
      .trigger("click");
    await waitForUi(
      () =>
        findForm(wrapper, "Save scene")
          ?.find("select")
          .text()
          .includes("Harbor ambience") ?? false,
    );
    const sceneForm = formFor(wrapper, "Save scene");
    await sceneForm.get("select").setValue(musicId);
    await sceneForm.trigger("submit");
    await waitForUi(() =>
      wrapper.text().includes("Background music: Harbor ambience"),
    );

    await wrapper.get('nav a[href="/media"]').trigger("click");
    await waitForUi(() => wrapper.get("h1").text() === "Media Library");
    await uploadFile(
      wrapper,
      "Harbor bell",
      "sound_effect",
      new File(["bell"], "bell.wav", { type: "audio/wav" }),
    );
    expect(wrapper.text()).toContain("Harbor bell");

    await router.push(`/projects/${projectId}`);
    await waitForUi(() => wrapper.findAll("details").length === 2);
    await wrapper.get("details summary").trigger("click");
    await wrapper.findAll("details")[1]!.get("summary").trigger("click");
    await waitForUi(() => wrapper.text().includes("Sound effects: None"));
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Edit cue point 1")!
      .trigger("click");
    await waitForUi(
      () =>
        findForm(wrapper, "Save cue point")?.text().includes("Harbor bell") ??
        false,
    );
    const cueForm = formFor(wrapper, "Save cue point");
    await cueForm.get('input[type="checkbox"]').setValue(true);
    await cueForm.trigger("submit");
    await waitForUi(() =>
      wrapper.text().includes("Sound effects: Harbor bell"),
    );

    const uploads = requests.filter((request) => request.method === "POST");
    expect(uploads).toHaveLength(2);
    for (const [index, name, type, fileName, mimeType] of [
      [0, "Harbor ambience", "background_music", "harbor.mp3", "audio/mpeg"],
      [1, "Harbor bell", "sound_effect", "bell.wav", "audio/wav"],
    ] as const) {
      const request = uploads[index]!;
      expect(request.path).toBe("/api/media");
      expect(request.headers.has("Content-Type")).toBe(false);
      if (!(request.body instanceof FormData))
        throw new Error("Expected multipart upload request");
      const formData = request.body;
      expect(formData.get("name")).toBe(name);
      expect(formData.get("type")).toBe(type);
      const file = formData.get("file");
      expect(file).toBeInstanceOf(File);
      expect(file).toMatchObject({ name: fileName, type: mimeType });
    }
    expect(
      requests
        .filter((request) => request.method === "PATCH")
        .map(({ path, body }) => ({ path, body })),
    ).toEqual([
      {
        path: `/api/scenes/${sceneId}`,
        body: { title: "At the harbor", backgroundMusicId: musicId },
      },
      {
        path: `/api/cue-points/${cuePointId}`,
        body: {
          characterId,
          spokenText: "Is anyone there?",
          soundEffectIds: [effectId],
        },
      },
    ]);
    for (const path of [
      "/api/media",
      "/api/media?type=background_music",
      "/api/media?type=sound_effect",
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
