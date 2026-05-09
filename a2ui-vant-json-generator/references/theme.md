# Theme

When the user asks for theme values, use only these fields inside `createSurface.theme`:

```json
{
  "colorPrimary": "#14b8a6",
  "colorBackground": "#f8fafc",
  "colorSurface": "#ffffff",
  "colorOnBackground": "#0f172a",
  "colorOnSurface": "#111827",
  "colorBorder": "#dbe4ee",
  "borderRadius": "12px",
  "fontSize": "16px",
  "fontScale": "1.2",
  "spacingM": "8px",
  "colorSuccess": "#16a34a",
  "colorWarning": "#f59e0b",
  "colorDanger": "#ef4444"
}
```

Avoid old aliases such as:

- `primaryColor`
- `backgroundColor`
- `surfaceColor`

Use px-based values when specifying sizes in theme examples.
