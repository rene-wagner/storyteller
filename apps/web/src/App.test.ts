import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.vue";
import { useSidebarStore } from "./sidebar";

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(() => {
  for (const wrapper of mounted) wrapper.unmount();
  mounted.length = 0;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function setup() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<p>Home view</p>" } },
      { path: "/projects", component: { template: "<p>Projects view</p>" } },
      { path: "/media", component: { template: "<p>Media view</p>" } },
    ],
  });
  await router.push("/");
  await router.isReady();
  const pinia = createPinia();
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  });
  mounted.push(wrapper);
  return { wrapper, router, sidebar: useSidebarStore(pinia) };
}

test("mobile menu opens, traps focus and closes with Escape", async () => {
  const { wrapper, sidebar } = await setup();
  const menu = wrapper.get('button[aria-controls="app-sidebar"]');
  const panel = wrapper.get("#app-sidebar");
  expect(sidebar.isSidebarOpen).toBe(false);
  expect(menu.attributes("aria-expanded")).toBe("false");
  expect(panel.classes()).toContain("hidden");
  const close = wrapper.get('button[aria-label="Close navigation menu"]');
  expect(menu.attributes("aria-label")).toBe("Open navigation menu");
  for (const [button, icon] of [
    [menu, "menu"],
    [close, "x"],
  ] as const) {
    expect(button.text()).toBe("");
    const svg = button.get("svg");
    expect(svg.classes()).toContain(`lucide-${icon}`);
    expect(svg.attributes("aria-hidden")).toBe("true");
    expect(svg.attributes("focusable")).toBe("false");
  }

  await menu.trigger("click");
  await flushPromises();
  expect(sidebar.isSidebarOpen).toBe(true);
  expect(menu.attributes("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(
    wrapper.get('button[aria-label="Close navigation menu"]').element,
  );

  const links = panel.findAll("a");
  links[links.length - 1]?.element.focus();
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(document.activeElement).toBe(
    wrapper.get('button[aria-label="Close navigation menu"]').element,
  );

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await flushPromises();
  expect(sidebar.isSidebarOpen).toBe(false);
  expect(document.activeElement).toBe(menu.element);
});

test("close button and navigation link dismiss the mobile sidebar", async () => {
  const { wrapper, router, sidebar } = await setup();
  const menu = wrapper.get('button[aria-controls="app-sidebar"]');
  await menu.trigger("click");
  await wrapper
    .get('button[aria-label="Close navigation menu"]')
    .trigger("click");
  await flushPromises();
  expect(sidebar.isSidebarOpen).toBe(false);
  expect(document.activeElement).toBe(menu.element);

  await menu.trigger("click");
  await wrapper
    .get('nav[aria-label="Primary navigation"] a[href="/projects"]')
    .trigger("click");
  await flushPromises();
  expect(router.currentRoute.value.path).toBe("/projects");
  expect(wrapper.text()).toContain("Projects view");
  expect(sidebar.isSidebarOpen).toBe(false);

  await menu.trigger("click");
  await wrapper.get('header a[href="/"]').trigger("click");
  await flushPromises();
  expect(router.currentRoute.value.path).toBe("/");
  expect(sidebar.isSidebarOpen).toBe(false);
});

test("desktop resize keeps navigation visible independently of mobile state", async () => {
  let onChange: ((event: { matches: boolean }) => void) | undefined;
  const desktopQuery = {
    matches: false,
    addEventListener: vi.fn(
      (_event: string, callback: (event: { matches: boolean }) => void) => {
        onChange = callback;
      },
    ),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => desktopQuery),
  );
  const { wrapper, sidebar } = await setup();
  await wrapper.get('button[aria-controls="app-sidebar"]').trigger("click");
  desktopQuery.matches = true;
  onChange?.({ matches: true });
  await flushPromises();
  expect(sidebar.isSidebarOpen).toBe(false);
  expect(wrapper.get("#app-sidebar").classes()).toContain("md:block");
  expect(
    wrapper.get('button[aria-controls="app-sidebar"]').classes(),
  ).toContain("md:hidden");
  expect(wrapper.get("main").text()).toContain("Home view");
});

test("sidebar links pair their labels with decorative resource icons", async () => {
  const { wrapper } = await setup();
  for (const [path, label, icon] of [
    ["/projects", "Projects", "folder"],
    ["/media", "Media Library", "library"],
  ]) {
    const link = wrapper.get(`nav a[href="${path}"]`);
    expect(link.text()).toBe(label);
    const svg = link.get("svg");
    expect(svg.classes()).toContain(`lucide-${icon}`);
    expect(svg.attributes("aria-hidden")).toBe("true");
    expect(svg.attributes("focusable")).toBe("false");
  }
});

test("sidebar store provides open, close and toggle actions", () => {
  const sidebar = useSidebarStore(createPinia());
  expect(sidebar.isSidebarOpen).toBe(false);
  sidebar.openSidebar();
  expect(sidebar.isSidebarOpen).toBe(true);
  sidebar.toggleSidebar();
  expect(sidebar.isSidebarOpen).toBe(false);
  sidebar.openSidebar();
  sidebar.closeSidebar();
  expect(sidebar.isSidebarOpen).toBe(false);
});
