# Patterns

## Standard Message Order

Default order:

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "demo-surface",
      "catalogId": "urn:a2ui:catalog:vant:v1",
      "sendDataModel": true
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "demo-surface",
      "components": []
    }
  },
  {
    "version": "v0.9",
    "updateDataModel": {
      "surfaceId": "demo-surface",
      "value": {}
    }
  }
]
```

If bindings depend on data, either order of `updateComponents` and `updateDataModel` is acceptable in this renderer, but keep the same `surfaceId`.

## Dynamic Lists

Use `{ componentId, path }` for arrays:

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

Inside the template:

- Use `name`, `priceText`, `description`
- Or use absolute paths only if the user explicitly requires them

Good:

```json
{
  "id": "product-name",
  "component": "Text",
  "text": { "path": "name" }
}
```

Avoid:

```json
{
  "id": "product-name",
  "component": "Text",
  "text": { "path": "/products/0/name" }
}
```

## Card Style

`Card` may receive inline style overrides:

```json
{
  "id": "hero-card",
  "component": "Card",
  "child": "hero-content",
  "style": {
    "backgroundColor": "#ecfeff",
    "border": "1px solid #99f6e4",
    "padding": "16px",
    "borderRadius": "16px",
    "boxShadow": "0 10px 30px rgba(20, 184, 166, 0.12)"
  }
}
```

Prefer `Card.style` for one-off visual tweaks instead of inventing unsupported fields.

## Button and Action

Preferred form:

```json
{
  "id": "submit-button",
  "component": "Button",
  "label": "提交",
  "variant": "primary",
  "action": {
    "event": {
      "name": "submit_form",
      "context": {
        "name": { "path": "/form/name" }
      }
    }
  }
}
```

## Clickable Row

Use `Row.action` when the entire row should trigger the action:

```json
{
  "id": "user-row",
  "component": "Row",
  "align": "center",
  "children": ["user-icon", "user-name"],
  "action": {
    "event": {
      "name": "open_user",
      "context": {
        "userId": { "path": "id" }
      }
    }
  }
}
```

## Markdown Caption

Use `Text` with `variant: "caption"` for markdown-style text:

```json
{
  "id": "summary",
  "component": "Text",
  "text": "## Summary\n\n- item 1\n- item 2",
  "variant": "caption"
}
```

## Theme Fields

Use only these theme names:

- `colorPrimary`
- `colorBackground`
- `colorSurface`
- `colorOnBackground`
- `colorOnSurface`
- `colorBorder`
- `borderRadius`
- `fontSize`
- `fontScale`
- `spacingM`
- `colorSuccess`
- `colorWarning`
- `colorDanger`
