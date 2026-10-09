import { mount } from "@vue/test-utils";
import { h } from "vue";
import { expect, test } from "vitest";
import Accordion from "./Accordion.vue";
import AccordionContent from "./AccordionContent.vue";
import AccordionHeader from "./AccordionHeader.vue";
import AccordionItem from "./AccordionItem.vue";

test("accordion summaries toggle their own content", async () => {
  const wrapper = mount(Accordion, {
    slots: {
      default: () => [
        h(AccordionItem, null, {
          default: () => [
            h(AccordionHeader, null, { default: () => "First" }),
            h(AccordionContent, null, { default: () => "First content" }),
          ],
        }),
        h(
          AccordionItem,
          { defaultOpen: true },
          {
            default: () => [
              h(AccordionHeader, null, { default: () => "Second" }),
              h(AccordionContent, null, { default: () => "Second content" }),
            ],
          },
        ),
      ],
    },
  });
  const items = wrapper.findAll("details");
  expect(items[0]?.element.open).toBe(false);
  expect(items[1]?.element.open).toBe(true);
  expect(items[0]?.get("summary").text()).toContain("First");
  expect(items[1]?.text()).toContain("Second content");
  const chevron = wrapper.get("summary svg");
  expect(chevron.classes()).toContain("lucide-chevron-down");
  expect(chevron.attributes("aria-hidden")).toBe("true");
  expect(chevron.attributes("focusable")).toBe("false");

  await items[0]?.get("summary").trigger("click");
  expect(items[0]?.element.open).toBe(true);
  expect(items[1]?.element.open).toBe(true);
  await items[0]?.get("summary").trigger("click");
  expect(items[0]?.element.open).toBe(false);
});
