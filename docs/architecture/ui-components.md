# Shared web UI components

Components live in `apps/web/src/components/ui`. Import them directly; they do not fetch data or manage CRUD operations.

- `FormField` takes `label`, `forId`, optional `hint` and `error`. Its default slot receives `{ describedBy, invalid }`; pass these to the control as `aria-describedby` and `aria-invalid`. The control's `id` must match `forId`. Error replaces hint when both are supplied. `ValidationMessage` is also available independently.
- `TextInput`, `TextareaInput`, `SelectInput` and `CheckboxInput` require `id` and accept `v-model` (string for text/textarea/select, boolean for checkbox). Native attributes and listeners can be passed through; select options are supplied in its default slot. `BaseButton` defaults to `type="button"`, with `primary`, `secondary`, and `danger` variants.
- `BaseAlert` accepts `info`, `success`, `warning` or `error`; only errors use an assertive alert role. `ErrorState` and `EmptyState` require `title` and `message` and offer an optional `action` slot. `LoadingState` takes an optional `label`.
- `ConfirmationDialog` accepts `v-model` (boolean), `title`, `message`, optional button labels, and emits `confirm`. It uses the native modal dialog for focus handling and Escape. The caller performs the confirmed operation; the dialog closes after confirmation, cancel or Escape.
- Compose `Accordion > AccordionItem > AccordionHeader + AccordionContent` in that order. `AccordionItem` accepts `defaultOpen` for its initial state. Native `details`/`summary` supply Enter/Space keyboard interaction and disclosure semantics; items expand independently without animation.
