import { mount } from "@vue/test-utils";
import { expect, test } from "vitest";
import ToolingCheck from "./ToolingCheck.vue";

test("Vue single-file components mount in the DOM test environment", () => {
  const wrapper = mount(ToolingCheck);

  expect(wrapper.element.ownerDocument.defaultView).toBe(window);
  expect(wrapper.text()).toBe("web");
  wrapper.unmount();
});
