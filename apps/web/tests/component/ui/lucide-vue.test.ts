import { mount } from "@vue/test-utils";
import { House } from "@lucide/vue";
import { expect, test } from "vitest";

test("Lucide icons render as Vue components", () => {
  const wrapper = mount(House, { props: { size: 20 } });

  expect(wrapper.element.tagName.toLowerCase()).toBe("svg");
  expect(wrapper.attributes("width")).toBe("20");
  expect(wrapper.attributes("height")).toBe("20");
  wrapper.unmount();
});
