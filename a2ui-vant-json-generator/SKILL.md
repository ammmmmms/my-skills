---
name: a2ui-vant-json-generator
description: Generate A2UI v0.9 JSON for the local Vue 3 + Vant renderer at /Users/lee/a2ui-vant-renderer. Use when producing createSurface, updateComponents, and updateDataModel messages that must run against catalogId urn:a2ui:catalog:vant:v1. Follow the local renderer's supported components, theme fields, list-template pattern, markdown caption behavior, Row action support, and Vant Icon rules.
---

# A2UI Vant JSON Generator

Generate JSON for the local renderer in `/Users/lee/a2ui-vant-renderer`.

## Default Target

- Protocol version: `v0.9`
- Default catalog: `urn:a2ui:catalog:vant:v1`
- Default output shape: a `messages` array containing:
  1. `createSurface`
  2. `updateComponents`
  3. `updateDataModel`

If the user asks for only one update type, output only that update type.

## Output Rules

- Output valid JSON only unless the user explicitly asks for explanation.
- Prefer minimal runnable structures over exhaustive ones.
- Use `id: "root"` for the root component unless the user already established another root id.
- Keep component ids stable and readable.
- Every id referenced by `child`, `content`, `trigger`, `tabs[].child`, or `children[]` must exist.
- For dynamic text or form state, prefer `{ "path": "..." }` or `{ "path": "/..." }` instead of duplicating literals.
- Prefer `updateDataModel` for state changes and `updateComponents` for structure changes.

## Required References

Read these before generating non-trivial JSON:

- `references/catalog-vant.md`
- `references/patterns.md`

Read these when needed:

- `references/examples.md` for copyable message structures
- `references/theme.md` when the user asks for theme or style fields

## Renderer-Specific Rules

- Use only components documented in `references/catalog-vant.md`.
- `Text` with `variant: "caption"` is suitable for markdown content.
- `Card` supports a `style` object with inline CSS entries such as `backgroundColor`, `border`, `padding`, `borderRadius`, `color`, or `boxShadow`.
- `Row` supports `action`; use it when the whole row should be clickable.
- `Icon` must follow the local Vant icon rules in `references/catalog-vant.md`.
- Do not invent unsupported fields such as `loading` or `disabled` unless the user explicitly says the project has added them.
- Do not use old theme aliases like `primaryColor`, `backgroundColor`, or `surfaceColor`.

## Dynamic List Rule

For array rendering, prefer template children:

```json
{
  "id": "product-list",
  "component": "List",
  "children": {
    "componentId": "product-card",
    "path": "/products"
  }
}
```

Inside the template, use paths relative to the current item:

```json
{
  "id": "product-name",
  "component": "Text",
  "text": { "path": "name" }
}
```

Do not manually duplicate one card three times for array data unless the user explicitly wants a static layout.

## Action Rule

Prefer event actions:

```json
{
  "action": {
    "event": {
      "name": "add_to_cart",
      "context": {
        "productId": { "path": "id" }
      }
    }
  }
}
```

- In list templates, action context may bind directly to current item fields.
- Pass only the fields needed by the host app.

## Authoring Checklist

Before returning JSON, verify:

- The `catalogId` matches the intended renderer.
- The `surfaceId` is consistent across all messages.
- All component references resolve.
- Array lists use `{ componentId, path }` when appropriate.
- Template item bindings use relative paths.
- `theme` uses the local standardized field names.
- Components and fields are supported by the local renderer.
