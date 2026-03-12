---
title: 拆分后数据流指南
impact: HIGH
impactDescription: 拆分后数据流混乱是重构失败的最常见原因，正确的数据流设计直接决定可维护性
type: best-practice
tags: [vue3, data-flow, props, emits, v-model, provide-inject, refactoring]
---

# 拆分后数据流指南

**Impact: HIGH** - 组件拆分后最容易出问题的是数据流。必须确保每一个数据的流向是清晰的、可追溯的。

## 数据流选型决策树

根据场景选择正确的数据流方式：

```
数据需要向下传递？
  ├─ 是：只传 1-2 层 → props
  ├─ 是：传 3 层以上 → provide/inject
  └─ 否：组件需要向上通知？
       ├─ 是：通知事件/动作 → emits
       ├─ 是：双向绑定单个值 → v-model
       ├─ 是：双向绑定多个值 → 多个 v-model (v-model:xxx)
       └─ 否：多个组件共享状态？
            ├─ 是：同一子树 → provide/inject
            └─ 是：跨子树/全局 → Pinia store
```

## 模式 1：Props 向下（单向数据流）

最基本、最优先使用的模式。父组件拥有数据，子组件只读。

```vue
<!-- 父组件 -->
<script setup lang="ts">
const user = ref({ name: 'Alice', role: 'admin' })
</script>

<template>
  <UserCard :name="user.name" :role="user.role" />
</template>
```

```vue
<!-- UserCard.vue -->
<script setup lang="ts">
// 子组件通过 props 接收，不可修改
defineProps<{
  name: string
  role: string
}>()
</script>
```

**注意**：不要在子组件中直接修改 props 值，Vue 会发出警告。

## 模式 2：Emits 向上（事件通知）

子组件通知父组件发生了某个动作，由父组件决定如何响应。

```vue
<!-- 子组件 -->
<script setup lang="ts">
const emit = defineEmits<{
  delete: [id: number]
  select: [item: Item]
}>()

function handleDelete(id: number) {
  emit('delete', id)
}
</script>
```

```vue
<!-- 父组件 -->
<template>
  <ItemList
    :items="items"
    @delete="handleDelete"
    @select="handleSelect"
  />
</template>
```

**注意**：事件命名使用 kebab-case（模板中）或 camelCase（defineEmits 中），保持一致。

## 模式 3：v-model 双向绑定

适用于表单类子组件，子组件需要修改父组件的数据。

### 单个 v-model

```vue
<!-- 父组件 -->
<template>
  <SearchInput v-model="searchQuery" />
  <!-- 等价于: <SearchInput :modelValue="searchQuery" @update:modelValue="searchQuery = $event" /> -->
</template>
```

```vue
<!-- SearchInput.vue -->
<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>

<template>
  <input v-model="model" placeholder="搜索..." />
</template>
```

### 多个 v-model（命名 v-model）

当子组件需要双向绑定多个值时使用：

```vue
<!-- 父组件 -->
<template>
  <UserForm
    v-model:name="formData.name"
    v-model:email="formData.email"
    v-model:role="formData.role"
  />
</template>
```

```vue
<!-- UserForm.vue -->
<script setup lang="ts">
const name = defineModel<string>('name', { required: true })
const email = defineModel<string>('email', { required: true })
const role = defineModel<string>('role', { required: true })
</script>

<template>
  <form>
    <input v-model="name" />
    <input v-model="email" type="email" />
    <select v-model="role">
      <option value="admin">管理员</option>
      <option value="user">用户</option>
    </select>
  </form>
</template>
```

### 传递整个对象的 v-model

当表单字段很多时，传对象比传多个字段更简洁：

```vue
<!-- 父组件 -->
<template>
  <UserForm v-model="formData" @submit="handleSubmit" />
</template>
```

```vue
<!-- UserForm.vue -->
<script setup lang="ts">
interface UserFormData {
  name: string
  email: string
  role: string
}

const model = defineModel<UserFormData>({ required: true })

defineEmits<{
  submit: []
}>()
</script>

<template>
  <form @submit.prevent="$emit('submit')">
    <input v-model="model.name" />
    <input v-model="model.email" type="email" />
    <select v-model="model.role">
      <option value="admin">管理员</option>
      <option value="user">用户</option>
    </select>
  </form>
</template>
```

**注意**：传递对象 v-model 时，子组件对对象属性的修改会直接反映到父组件（因为是同一个响应式对象的引用）。如果需要隔离，子组件应拷贝一份内部状态，在提交时才 emit 完整对象。

## 模式 4：Provide/Inject（跨层级传递）

当数据需要穿过多层组件传递时，避免 prop drilling。

```ts
// keys.ts - 共享的注入 key
import type { InjectionKey, Ref } from 'vue'

export const ThemeKey: InjectionKey<Ref<'light' | 'dark'>> = Symbol('theme')
export const UserKey: InjectionKey<Ref<User | null>> = Symbol('user')
```

```vue
<!-- 顶层提供者 -->
<script setup lang="ts">
import { provide, ref } from 'vue'
import { ThemeKey } from '@/keys'

const theme = ref<'light' | 'dark'>('light')
provide(ThemeKey, theme)
</script>
```

```vue
<!-- 深层子组件消费 -->
<script setup lang="ts">
import { inject } from 'vue'
import { ThemeKey } from '@/keys'

const theme = inject(ThemeKey)!
</script>
```

**使用时机**：
- 主题、语言、用户信息等全局上下文
- 表单组上下文（FormGroup → FormItem）
- 树形组件的层级上下文

**不要滥用**：provide/inject 会让数据流变得隐式，只在 prop drilling 超过 2 层时考虑。

## 常见数据流错误

### 错误 1：子组件直接修改父组件传入的数组/对象 props

```vue
<!-- 👎 直接修改 props 引用的数组 -->
<script setup lang="ts">
const props = defineProps<{ items: Item[] }>()

function remove(index: number) {
  props.items.splice(index, 1) // ❌ 直接修改了父组件的数据
}
</script>
```

```vue
<!-- 👍 通过 emit 通知父组件 -->
<script setup lang="ts">
const props = defineProps<{ items: Item[] }>()
const emit = defineEmits<{ remove: [index: number] }>()

function remove(index: number) {
  emit('remove', index) // ✅ 让父组件决定如何处理
}
</script>
```

### 错误 2：prop drilling 超过 2 层

```
<!-- 👎 数据穿过 3 层传递 -->
Page → Layout → Sidebar → UserAvatar (需要 user.avatar)

<!-- 👍 使用 provide/inject 跳过中间层 -->
Page (provide user) → Layout → Sidebar → UserAvatar (inject user)
```

### 错误 3：子组件通过 emit 向上传递过多内部细节

```vue
<!-- 👎 暴露了内部实现细节 -->
emit('update', { field: 'name', value: 'Alice', previousValue: 'Bob', timestamp: Date.now() })

<!-- 👍 emit 只传递父组件关心的信息 -->
emit('update', { name: 'Alice' })
```
