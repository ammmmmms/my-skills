# Catalog Summary

This renderer targets `catalogId: "urn:a2ui:catalog:vant:v1"`.

Use these components and fields by default.

## Layout

`Column`
- `children`: array of child ids or `{ componentId, path }`
- `justify`: `start | center | end | spaceBetween`
- `align`: `start | center | end | stretch`

`Row`
- `children`: array of child ids or `{ componentId, path }`
- `justify`: `start | center | end | spaceBetween`
- `align`: `start | center | end | stretch`
- `action`: optional event action for clickable row

`List`
- `children`: array of child ids or `{ componentId, path }`
- `direction`: `vertical | horizontal`
- `align`: `start | center | end | stretch`

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
- `caption` is appropriate for markdown text

`Image`
- `url`
- `fit`
- `variant`

`Icon`
- `name`: Vant icon name, data binding, or function call
- `size`: number
- `type`: `default | primary | success | warning | danger`
- Use Vant icon names such as `success`, `warning-o`, `setting-o`, `arrow-left`, `info-o`, `cart-o`

`Tag`
- `text`
- `type`: `default | primary | success | warning | danger`
- `plain`

## Inputs

`Button`
- `label` or `text` or `child`
- `variant`: `default | primary | borderless | danger | success`
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
- Do not use old basic icon semantics.
- Do not mix old theme field names with the local standardized names.
