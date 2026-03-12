---
title: 薄编排层模式
impact: MEDIUM
impactDescription: 父组件保持为薄编排层可以显著降低维护难度和认知负担
type: best-practice
tags: [vue3, architecture, component-design, orchestration, composition]
---

# 薄编排层模式

**Impact: MEDIUM** - 重构后的父组件应该是一个"薄编排层"：只负责组合子组件和 composable，不包含具体的业务逻辑或复杂 UI。

## 什么是薄编排层

薄编排层组件的职责**仅限于**：

1. 调用 composables 获取状态和方法
2. 将状态通过 props 分发给子组件
3. 监听子组件的 emits 并调用对应方法
4. 控制布局和子组件的显隐

## 反模式 vs 正确模式

**反模式：父组件仍然臃肿**
```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import ItemList from './ItemList.vue'

// 👎 父组件仍然包含大量业务逻辑
const items = ref([])
const loading = ref(false)
const error = ref(null)
const searchQuery = ref('')
const sortBy = ref('name')

const filteredItems = computed(() => {
  let result = items.value
  if (searchQuery.value) {
    result = result.filter(item =>
      item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }
  return [...result].sort((a, b) => a[sortBy.value].localeCompare(b[sortBy.value]))
})

onMounted(async () => {
  loading.value = true
  try {
    items.value = await fetchItems()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
})

async function deleteItem(id: number) {
  await api.delete(id)
  items.value = items.value.filter(item => item.id !== id)
}

async function updateItem(id: number, data: Partial<Item>) {
  const updated = await api.update(id, data)
  const index = items.value.findIndex(item => item.id === id)
  if (index !== -1) items.value[index] = updated
}
</script>
```

**正确模式：薄编排层**
```vue
<script setup lang="ts">
import SearchBar from './SearchBar.vue'
import SortSelect from './SortSelect.vue'
import ItemList from './ItemList.vue'
import ErrorBanner from '@/components/ErrorBanner.vue'
import { useItemManager } from '@/composables/useItemManager'

// 薄编排层：只做组合，不做具体实现
const {
  items,
  loading,
  error,
  searchQuery,
  sortBy,
  filteredItems,
  deleteItem,
  updateItem
} = useItemManager()
</script>

<template>
  <div class="item-page">
    <ErrorBanner v-if="error" :error="error" />
    <SearchBar v-model="searchQuery" />
    <SortSelect v-model="sortBy" />
    <ItemList
      :items="filteredItems"
      :loading="loading"
      @delete="deleteItem"
      @update="updateItem"
    />
  </div>
</template>
```

## 薄编排层的自检标准

编排层组件的 `<script setup>` 应该满足：

| 检查项 | 预期 |
|--------|------|
| 直接声明的 ref/reactive | 0-2 个（仅用于纯 UI 状态如 sidebar 展开/收起） |
| computed | 0-1 个（仅用于简单的 UI 派生，如布局类名） |
| watch | 0 个（副作用应在 composable 内部管理） |
| 方法/函数 | 0-3 个（仅做简单的事件转发或 composable 方法调用） |
| 代码行数 | < 30 行 |

如果编排层不满足上述标准，说明还有逻辑没有提取到 composable 中。

## 编排层中允许保留的逻辑

以下逻辑可以留在编排层：

1. **跨关注点的简单协调**：一个事件需要触发多个 composable 的操作
```vue
<script setup lang="ts">
const { items, refresh } = useItems()
const { showSuccess } = useNotification()

// 跨关注点协调：删除后刷新列表并提示
async function handleDelete(id: number) {
  await deleteItem(id)
  await refresh()
  showSuccess('删除成功')
}
</script>
```

2. **纯 UI 状态**：不涉及业务逻辑的界面状态
```vue
<script setup lang="ts">
const isSidebarOpen = shallowRef(true)
</script>
```
