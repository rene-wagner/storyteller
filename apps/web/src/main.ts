import { VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { queryClient } from "./query-client";
import { routes } from "./router";
import "./style.css";

const router = createRouter({
  history: createWebHistory(),
  routes,
});

createApp(App)
  .use(createPinia())
  .use(VueQueryPlugin, { queryClient })
  .use(router)
  .mount("#app");
