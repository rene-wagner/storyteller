import { mount } from "@vue/test-utils";
import { h } from "vue";
import { describe, expect, test } from "vitest";
import CheckboxInput from "./CheckboxInput.vue";
import FormField from "./FormField.vue";
import SelectInput from "./SelectInput.vue";
import TextareaInput from "./TextareaInput.vue";
import TextInput from "./TextInput.vue";
import ValidationMessage from "./ValidationMessage.vue";

describe("FormField", () => {
  test("connects the label and hint to its input", () => {
    const wrapper = mount(FormField, {
      props: { label: "Title", forId: "title", hint: "Give it a name" },
      slots: {
        default: ({
          describedBy,
          invalid,
        }: {
          describedBy?: string;
          invalid: boolean;
        }) =>
          h(TextInput, {
            id: "title",
            "aria-describedby": describedBy,
            "aria-invalid": invalid,
          }),
      },
    });

    expect(wrapper.get("label").attributes("for")).toBe("title");
    expect(wrapper.get("input").attributes("aria-describedby")).toBe(
      "title-hint",
    );
    expect(wrapper.get("input").attributes("aria-invalid")).toBe("false");
    expect(wrapper.get("#title-hint").text()).toBe("Give it a name");
  });

  test("replaces the hint with a validation error and marks the input invalid", async () => {
    const wrapper = mount(FormField, {
      props: { label: "Title", forId: "title", hint: "Give it a name" },
      slots: {
        default: ({
          describedBy,
          invalid,
        }: {
          describedBy?: string;
          invalid: boolean;
        }) =>
          h(TextInput, {
            id: "title",
            "aria-describedby": describedBy,
            "aria-invalid": invalid,
          }),
      },
    });

    await wrapper.setProps({ error: "Title is required" });
    expect(wrapper.find("#title-hint").exists()).toBe(false);
    expect(wrapper.get("input").attributes("aria-describedby")).toBe(
      "title-error",
    );
    expect(wrapper.get("input").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get("#title-error").text()).toBe("Title is required");
  });
});

test("ValidationMessage renders its supplied message", () => {
  expect(
    mount(ValidationMessage, {
      slots: { default: "Please select a character" },
    }).text(),
  ).toBe("Please select a character");
});

describe("form inputs", () => {
  test("TextInput accepts text and emits model updates", async () => {
    const wrapper = mount(TextInput, { props: { id: "name", type: "email" } });
    const input = wrapper.get("input");
    expect(input.attributes("type")).toBe("email");
    await input.setValue("hello@example.com");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      "hello@example.com",
    ]);
  });

  test("TextareaInput accepts text and emits model updates", async () => {
    const wrapper = mount(TextareaInput, { props: { id: "description" } });
    await wrapper.get("textarea").setValue("A short description");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      "A short description",
    ]);
  });

  test("SelectInput renders choices and emits the selected value", async () => {
    const wrapper = mount(SelectInput, {
      props: { id: "genre" },
      slots: {
        default:
          '<option value="drama">Drama</option><option value="comedy">Comedy</option>',
      },
    });
    expect(wrapper.findAll("option").map((option) => option.text())).toEqual([
      "Drama",
      "Comedy",
    ]);
    await wrapper.get("select").setValue("comedy");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["comedy"]);
  });

  test("CheckboxInput emits checked state and honors disabled", async () => {
    const wrapper = mount(CheckboxInput, { props: { id: "enabled" } });
    await wrapper.get("input").setValue(true);
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([true]);
    await wrapper.setProps({ disabled: true });
    expect(wrapper.get("input").element).toHaveProperty("disabled", true);
  });
});
