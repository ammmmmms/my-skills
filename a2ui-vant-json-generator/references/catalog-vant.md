# Catalog Summary

This renderer targets `catalogId: "urn:a2ui:catalog:vant:v1"`.

Use these components and fields by default.

## Layout

`Column`
- `children`: array of child ids or `{ componentId, path }`
- `justify`: `start | center | end | spaceBetween`
- `align`: `start | center | end | stretch`
- `gap`: number, rendered as px
- `style`: inline style object with string or number values

`Row`
- `children`: array of child ids or `{ componentId, path }`
- `justify`: `start | center | end | spaceBetween`
- `align`: `start | center | end | stretch`
- `gap`: number, rendered as px
- `style`: inline style object with string or number values
- `action`: optional event action for clickable row

`List`
- `children`: array of child ids or `{ componentId, path }`
- `direction`: `vertical | horizontal`
- `align`: `start | center | end | stretch`
- `gap`: number, rendered as px
- `style`: inline style object with string or number values
- `collapse`: optional object for collapsed lists
- `collapse.limit`: number of visible children before folding
- `collapse.expandText`: optional text, defaults to `展开全部`
- `collapse.collapseText`: optional PC expanded text, defaults to `收起`
- `collapse.popupTitle`: optional title shown at the top of the app popup
- `collapse.style`: inline style object for the bottom toggle area

`Card`
- `child`: single child id
- `style`: inline style object with string or number values, for example `backgroundColor`, `border`, `padding`, `borderRadius`, `boxShadow`, `marginBottom`

`CellGroup`
- `title`
- `children`
- `inset`

`Tabs`
- `tabs`: array of `{ title, child }`
- `action`

`Modal`
- `trigger`: child id
- `content`: child id
- `action`

`Divider`
- no main fields

## Text and Media

`Text`
- `text`: literal string or `{ path: ... }`
- `variant`: `h1 | h2 | h3 | h4 | h5 | caption | body`
- `style`: inline style object with string or number values
- `lines`: number, clamps to that many lines and shows ellipsis on overflow
- `caption` is appropriate for markdown text

`Image`
- `url`
- `fit`
- `variant`

`Icon`
- `name`: icon name, data binding, or function call
- `size`: number
- `type`: `default | primary | success | warning | danger`
- Literal icon names must come from either the Vant icon set or the official A2UI basic icon set.
- If the name matches a Vant icon, the built-in Vant icon is used.
- If the name matches an A2UI basic icon, the renderer uses the custom `a2ui` icon font prefix automatically, for example `edit` -> `a2ui-edit`.

`Tag`
- `text`
- `type`: `default | primary | success | warning | danger`
- `plain`

## Inputs

`Button`
- `label` or `text` or `child`
- `variant`: `default | primary | borderless | danger | success`
- `size`: `large | normal | small | mini`
- `action`
- `block`
- `checks`

`TextField`
- `label`
- `value`
- `placeholder`
- `variant`: `shortText | longText | number | obscured`
- `action`
- `checks`

`CheckBox`
- `label`
- `value`
- `action`
- `checks`

`ChoicePicker`
- `label`
- `options`: array of strings or numbers
- `value`
- `variant`: `mutuallyExclusive | multipleSelection`
- `displayStyle`: `list | dropdown`
- `action`
- `checks`

`Slider`
- `value`
- `min`
- `max`
- `step`
- `action`

`DateTimeInput`
- `label`
- `value`
- `enableTime`
- `min`
- `max`
- `action`

## Avoid

- Do not use unsupported fields such as `loading`, `disabled`, or arbitrary style props unless the user explicitly says they have been added locally.
- Do not invent arbitrary icon names outside the Vant and A2UI basic icon sets.
- Do not mix old theme field names with the local standardized names.
