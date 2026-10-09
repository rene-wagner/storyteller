import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { pinia } from "./pinia";
import { queryClient } from "./query-client";
import { routes } from "./router";
import "./style.css";

const router = createRouter({
  history: createWebHistory(),
  routes,
});

createApp(App)
  .use(pinia)
  .use(VueQueryPlugin, { queryClient })
  .use(router)
  .mount("#app");
