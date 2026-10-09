import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ConfirmationDialog from "./ConfirmationDialog.vue";

// jsdom does not implement the native dialog methods; preserve their open/close effect.
const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
});
afterEach(() => {
  for (const [name, descriptor] of [
    ["showModal", originalShowModal],
    ["close", originalClose],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

function mountDialog(initialOpen = false) {
  const open = ref(initialOpen);
  const confirm = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(ConfirmationDialog, {
          modelValue: open.value,
          "onUpdate:modelValue": (value: boolean) => {
            open.value = value;
          },
          onConfirm: confirm,
          title: "Delete scene?",
          message: "This cannot be undone.",
          confirmLabel: "Delete scene",
          cancelLabel: "Keep scene",
        }),
    }),
  );
  return { wrapper, open, confirm, dialog: wrapper.get("dialog") };
}

test("opens with accessible title and description when requested", async () => {
  const { wrapper, open, dialog } = mountDialog();
  expect(dialog.element.open).toBe(false);
  open.value = true;
  await nextTick();
  expect(dialog.element.open).toBe(true);
  expect(wrapper.get(`#${dialog.attributes("aria-labelledby")}`).text()).toBe(
    "Delete scene?",
  );
  expect(wrapper.get(`#${dialog.attributes("aria-describedby")}`).text()).toBe(
    "This cannot be undone.",
  );
  wrapper.unmount();
});

test("cancel closes without confirming, and confirmation emits once", async () => {
  const { wrapper, open, confirm, dialog } = mountDialog(true);
  expect(dialog.element.open).toBe(true);
  await wrapper.get("button:nth-child(1)").trigger("click");
  await nextTick();
  expect(open.value).toBe(false);
  expect(dialog.element.open).toBe(false);
  expect(confirm).not.toHaveBeenCalled();

  open.value = true;
  await nextTick();
  await wrapper.get("button:nth-child(2)").trigger("click");
  await nextTick();
  expect(confirm).toHaveBeenCalledOnce();
  expect(open.value).toBe(false);
  expect(dialog.element.open).toBe(false);
  wrapper.unmount();
});

test("native cancel dismisses without confirming", async () => {
  const { wrapper, open, confirm, dialog } = mountDialog(true);
  await dialog.trigger("cancel");
  await nextTick();
  expect(open.value).toBe(false);
  expect(dialog.element.open).toBe(false);
  expect(confirm).not.toHaveBeenCalled();
  wrapper.unmount();
});
