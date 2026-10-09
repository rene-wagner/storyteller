import { mount } from "@vue/test-utils";
import { describe, expect, test } from "vitest";
import EmptyState from "./EmptyState.vue";
import ErrorState from "./ErrorState.vue";

describe("empty states", () => {
  test("shows an empty message without an action when none is provided", () => {
    const wrapper = mount(EmptyState, {
      props: { title: "No scenes", message: "Add a scene to get started." },
    });
    expect(wrapper.get("h2").text()).toBe("No scenes");
    expect(wrapper.get("p").text()).toBe("Add a scene to get started.");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  test("renders an optional action", () => {
    const wrapper = mount(EmptyState, {
      props: { title: "No scenes", message: "Add a scene to get started." },
      slots: { action: '<button type="button">Add scene</button>' },
    });
    expect(wrapper.get("button").text()).toBe("Add scene");
  });

  test("error state presents its message as an alert with a retry action", () => {
    const wrapper = mount(ErrorState, {
      props: { title: "Could not load scenes", message: "Try again." },
      slots: { action: '<button type="button">Retry</button>' },
    });
    expect(wrapper.get('[role="alert"] h2').text()).toBe(
      "Could not load scenes",
    );
    expect(wrapper.get("p").text()).toBe("Try again.");
    expect(wrapper.get("button").text()).toBe("Retry");
  });
});
