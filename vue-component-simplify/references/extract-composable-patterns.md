---
title: 从臃肿组件提取 Composable 的模式
impact: HIGH
impactDescription: 正确提取 composable 是精简组件的核心手段，提取不当会导致逻辑碎片化或隐式耦合
type: best-practice
tags: [vue3, composables, refactoring, extraction, state-management]
---

# 从臃肿组件提取 Composable 的模式

**Impact: HIGH** - Composable 提取是组件精简的第一步。把状态逻辑从组件中剥离，让组件只关心 UI 渲染和组合。

## 任务清单

- 识别可提取的逻辑组：一组相关的 ref + computed + watch + 方法
- 每个 composable 管理一个关注点
- 用 readonly 保护内部状态
- 通过参数传递依赖，避免隐式共享

## 提取判定标准

当以下条件**任一**满足时，应提取为 composable：

1. 一组状态（ref/reactive）和操作它们的方法在逻辑上属于同一关注点
2. 包含副作用（API 调用、定时器、事件监听）
3. 逻辑在多个组件中复用或可能复用
4. 提取后能让组件的 `<script setup>` 更清晰地表达意图

## 提取步骤

### 步骤 1：圈定关注点边界

在组件中标记哪些 ref、computed、watch、方法属于同一关注点。

**提取前：**
```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

// ---- 搜索关注点 ----
const searchQuery = ref('')
const searchResults = ref<Item[]>([])
const isSearching = ref(false)

watch(searchQuery, async (query) => {
  if (!query) { searchResults.value = []; return }
  isSearching.value = true
  searchResults.value = await api.search(query)
  isSearching.value = false
})

// ---- 分页关注点 ----
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value))

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}
</script>
```

### 步骤 2：提取为独立 composable

**提取后：**
```ts
// composables/useSearch.ts
import { ref, watch, type Ref } from 'vue'

interface UseSearchOptions {
  immediate?: boolean
}

export function useSearch(queryFn: (q: string) => Promise<Item[]>, options: UseSearchOptions = {}) {
  const query = ref('')
  const results = ref<Item[]>([])
  const isSearching = ref(false)

  watch(query, async (q, _prev, onCleanup) => {
    if (!q) { results.value = []; return }
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    isSearching.value = true
    try {
      results.value = await queryFn(q)
    } finally {
      isSearching.value = false
    }
  }, { immediate: options.immediate })

  return {
    query,
    results: readonly(results),
    isSearching: readonly(isSearching)
  }
}
```

```ts
// composables/usePagination.ts
import { shallowRef, computed, readonly } from 'vue'

interface UsePaginationOptions {
  initialPage?: number
  initialPageSize?: number
}

export function usePagination(total: Ref<number>, options: UsePaginationOptions = {}) {
  const currentPage = shallowRef(options.initialPage ?? 1)
  const pageSize = shallowRef(options.initialPageSize ?? 20)
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

  function goToPage(page: number) {
    currentPage.value = Math.max(1, Math.min(page, totalPages.value))
  }

  function nextPage() { goToPage(currentPage.value + 1) }
  function prevPage() { goToPage(currentPage.value - 1) }

  return {
    currentPage: readonly(currentPage),
    pageSize: readonly(pageSize),
    totalPages,
    goToPage,
    nextPage,
    prevPage
  }
}
```

### 步骤 3：在组件中组合

```vue
<script setup lang="ts">
import { useSearch } from '@/composables/useSearch'
import { usePagination } from '@/composables/usePagination'

const { query, results, isSearching } = useSearch((q) => api.search(q))
const { currentPage, totalPages, goToPage } = usePagination(totalItems)
</script>
```

## 提取时的注意事项

### 不要过度拆分

**反模式：** 一个 ref 一个 composable
```ts
// 👎 过度拆分，没有意义
function useLoading() {
  const loading = ref(false)
  return { loading }
}
```

**正确做法：** composable 应该封装一个**完整的关注点**，包括状态 + 操作 + 派生值。

### 通过参数传递依赖

**反模式：** composable 之间通过外部变量隐式共享状态
```ts
// 👎 隐式依赖外部变量
const items = ref([])

function useFilter() {
  // 直接访问外部 items，不可复用，依赖不透明
  const filtered = computed(() => items.value.filter(/* ... */))
  return { filtered }
}
```

**正确做法：**
```ts
// 👍 通过参数显式传递
function useFilter(items: Ref<Item[]>) {
  const filtered = computed(() => items.value.filter(/* ... */))
  return { filtered }
}
```

### 纯函数不需要包装成 composable

不使用 Vue 响应式 API（ref、computed、watch、生命周期钩子）的纯函数，放在 `utils/` 目录即可。

```ts
// 👎 没有使用任何响应式 API
function useFormatDate() {
  const format = (date: Date) => date.toLocaleDateString()
  return { format }
}

// 👍 直接导出纯函数
// utils/format.ts
export function formatDate(date: Date): string {
  return date.toLocaleDateString()
}
```
