import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { expect, test } from "vitest";
import { projectKeys } from "../projects";
import HomeView from "./HomeView.vue";
import ProjectsView from "./ProjectsView.vue";

for (const [name, view, labels] of [
  ["home", HomeView, ["Projects", "Media Library"]],
  ["projects", ProjectsView, ["New project", "Create project"]],
] as const) {
  test(`${name} action links retain accessible labels on small screens`, async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: HomeView },
        { path: "/projects", component: ProjectsView },
        { path: "/media", component: HomeView },
        { path: "/projects/new", component: HomeView },
      ],
    });
    await router.push("/");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    queryClient.setQueryData(projectKeys.list, []);
    const wrapper = mount(view, {
      global: {
        plugins: [router, [VueQueryPlugin, { queryClient }]],
      },
    });
    try {
      for (const label of labels) {
        const link = wrapper.findAll("a").find((item) => item.text() === label);
        expect(link).toBeDefined();
        expect(link?.get("svg").attributes("aria-hidden")).toBe("true");
        const labelSpan = link?.get("span");
        expect(labelSpan?.text()).toBe(label);
        expect(labelSpan?.classes()).toContain("sr-only");
        expect(labelSpan?.classes()).toContain("md:not-sr-only");
        expect(labelSpan?.attributes("aria-hidden")).toBeUndefined();
      }
    } finally {
      wrapper.unmount();
      queryClient.clear();
    }
  });
}
