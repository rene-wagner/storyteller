import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("./views/HomeView.vue"),
  },
  {
    path: "/projects",
    name: "projects",
    component: () => import("./views/ProjectsView.vue"),
  },
  {
    path: "/projects/new",
    name: "new-project",
    component: () => import("./views/NewProjectView.vue"),
  },
  {
    path: "/projects/:projectId",
    name: "project",
    component: () => import("./views/ProjectView.vue"),
  },
  {
    path: "/media",
    name: "media",
    component: () => import("./views/MediaView.vue"),
  },
];
