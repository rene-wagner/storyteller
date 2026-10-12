import { mount } from "@vue/test-utils";
import { expect, test } from "vitest";
import { defineComponent, h } from "vue";

test("Vue components mount in the DOM test environment", () => {
  const component = defineComponent({
    setup: () => () => h("span", "Test component"),
  });
  const wrapper = mount(component);

  expect(wrapper.element.ownerDocument.defaultView).toBe(window);
  expect(wrapper.text()).toBe("Test component");
  wrapper.unmount();
});
