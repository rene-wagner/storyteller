import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from "@lucide/vue";
import { mount } from "@vue/test-utils";
import { expect, test } from "vitest";
import BaseButton from "./BaseButton.vue";

for (const [label, icon] of Object.entries({
  Add: Plus,
  Edit: Pencil,
  Delete: Trash2,
  Save,
  Upload,
  "Move up": ArrowUp,
  "Move down": ArrowDown,
})) {
  test(`${label} button keeps its text and renders a decorative leading icon`, async () => {
    const wrapper = mount(BaseButton, {
      props: { icon },
      slots: { default: label },
    });
    const button = wrapper.get("button");
    expect(button.text()).toBe(label);
    expect(button.attributes("type")).toBe("button");
    const labelSpan = button.get("span");
    expect(labelSpan.text()).toBe(label);
    expect(labelSpan.classes()).toContain("sr-only");
    expect(labelSpan.classes()).toContain("md:not-sr-only");
    expect(labelSpan.attributes("aria-hidden")).toBeUndefined();
    const svg = button.get("svg");
    expect(svg.attributes("aria-hidden")).toBe("true");
    expect(svg.attributes("focusable")).toBe("false");
    expect(button.element.firstElementChild).toBe(svg.element);
    await button.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
    wrapper.unmount();
  });
}

test("buttons without an icon retain native disabled and submit behavior", () => {
  const wrapper = mount(BaseButton, {
    props: { type: "submit", disabled: true },
    slots: { default: "Cancel" },
  });
  expect(wrapper.find("svg").exists()).toBe(false);
  expect(wrapper.find(".sr-only").exists()).toBe(false);
  expect(wrapper.get("button").text()).toBe("Cancel");
  expect(wrapper.get("button").attributes("type")).toBe("submit");
  expect(wrapper.get("button").element.disabled).toBe(true);
  wrapper.unmount();
});
