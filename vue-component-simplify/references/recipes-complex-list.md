---
title: 复杂列表拆分食谱
impact: HIGH
impactDescription: 列表+搜索+筛选+分页是管理后台最常见的页面模式，正确拆分能显著提升可维护性
type: recipe
tags: [vue3, list, table, search, filter, pagination, refactoring]
---

# 复杂列表拆分食谱

**Impact: HIGH** - 带搜索、筛选、排序、分页的列表页面是最典型的臃肿页面组件。

## 典型臃肿列表

```vue
<!-- 👎 OrderListPage.vue - 300+ 行 -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

// ---- 数据获取 ----
const orders = ref<Order[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchOrders() {
  loading.value = true
  error.value = null
  try {
    const res = await api.getOrders({
      search: searchQuery.value,
      status: statusFilter.value,
      sort: sortBy.value,
      page: currentPage.value,
      pageSize: pageSize.value
    })
    orders.value = res.data
    totalItems.value = res.total
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// ---- 搜索 ----
const searchQuery = ref('')
watch(searchQuery, () => {
  currentPage.value = 1
  fetchOrders()
})

// ---- 筛选 ----
const statusFilter = ref('all')
watch(statusFilter, () => {
  currentPage.value = 1
  fetchOrders()
})

// ---- 排序 ----
const sortBy = ref('createdAt')
const sortOrder = ref<'asc' | 'desc'>('desc')
watch([sortBy, sortOrder], () => fetchOrders())

// ---- 分页 ----
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value))
watch(currentPage, () => fetchOrders())

// ---- 行操作 ----
const selectedOrder = ref<Order | null>(null)
const showDetail = ref(false)

function viewOrder(order: Order) {
  selectedOrder.value = order
  showDetail.value = true
}

async function deleteOrder(id: number) {
  await api.deleteOrder(id)
  await fetchOrders()
}

onMounted(fetchOrders)
</script>

<template>
  <div class="order-page">
    <!-- 搜索栏 -->
    <!-- 筛选器 -->
    <!-- 表格 -->
    <!-- 分页 -->
    <!-- 详情弹窗 -->
  </div>
</template>
```

## 拆分方案

### 数据流设计

```
OrderListPage (编排层)
├── useOrderList (composable: 数据获取 + 查询参数管理)
│   ├── 内部管理: orders, loading, error, totalItems
│   ├── 暴露: query params (searchQuery, statusFilter, sortBy, currentPage)
│   └── 暴露: actions (refresh, deleteOrder)
├── SearchBar (子组件)
│   └── v-model ← searchQuery
├── FilterBar (子组件)
│   └── v-model:status ← statusFilter
│   └── v-model:sort ← sortBy
├── OrderTable (子组件)
│   ├── props: orders, loading
│   ├── emit: view (查看详情)
│   └── emit: delete (删除)
├── PaginationBar (子组件)
│   ├── v-model:page ← currentPage
│   └── props: totalPages
└── OrderDetailDrawer (子组件)
    ├── v-model:open ← showDetail
    └── props: order
```

### 拆分后的代码

**composable：订单列表管理**
```ts
// composables/useOrderList.ts
import { ref, shallowRef, computed, watch, onMounted, readonly } from 'vue'

interface UseOrderListReturn {
  orders: Readonly<Ref<Order[]>>
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  searchQuery: Ref<string>
  statusFilter: Ref<string>
  sortBy: Ref<string>
  currentPage: Ref<number>
  totalPages: ComputedRef<number>
  refresh: () => Promise<void>
  deleteOrder: (id: number) => Promise<void>
}

export function useOrderList(): UseOrderListReturn {
  const orders = ref<Order[]>([])
  const loading = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const totalItems = shallowRef(0)

  // 查询参数 - 可写，供子组件通过 v-model 绑定
  const searchQuery = ref('')
  const statusFilter = ref('all')
  const sortBy = ref('createdAt')
  const currentPage = shallowRef(1)
  const pageSize = shallowRef(20)

  const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value))

  async function fetchOrders() {
    loading.value = true
    error.value = null
    try {
      const res = await api.getOrders({
        search: searchQuery.value,
        status: statusFilter.value,
        sort: sortBy.value,
        page: currentPage.value,
        pageSize: pageSize.value
      })
      orders.value = res.data
      totalItems.value = res.total
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  // 搜索/筛选/排序变化时重置页码并重新获取
  watch([searchQuery, statusFilter, sortBy], () => {
    currentPage.value = 1
    fetchOrders()
  })

  // 翻页时重新获取
  watch(currentPage, () => fetchOrders())

  async function deleteOrder(id: number) {
    await api.deleteOrder(id)
    await fetchOrders()
  }

  onMounted(fetchOrders)

  return {
    orders: readonly(orders),
    loading: readonly(loading),
    error: readonly(error),
    searchQuery,
    statusFilter,
    sortBy,
    currentPage,
    totalPages,
    refresh: fetchOrders,
    deleteOrder
  }
}
```

**子组件：订单表格**
```vue
<!-- components/OrderTable.vue -->
<script setup lang="ts">
import type { Order } from '@/types'

defineProps<{
  orders: Order[]
  loading: boolean
}>()

defineEmits<{
  view: [order: Order]
  delete: [id: number]
}>()
</script>

<template>
  <div v-if="loading" class="loading">加载中...</div>
  <table v-else>
    <thead>
      <tr>
        <th>订单号</th>
        <th>客户</th>
        <th>金额</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="order in orders" :key="order.id">
        <td>{{ order.orderNo }}</td>
        <td>{{ order.customer }}</td>
        <td>{{ order.amount }}</td>
        <td>{{ order.status }}</td>
        <td>
          <button @click="$emit('view', order)">查看</button>
          <button @click="$emit('delete', order.id)">删除</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
```

**编排层：重构后的页面**
```vue
<!-- OrderListPage.vue -->
<script setup lang="ts">
import { shallowRef } from 'vue'
import SearchBar from '@/components/SearchBar.vue'
import FilterBar from './components/FilterBar.vue'
import OrderTable from './components/OrderTable.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import OrderDetailDrawer from './components/OrderDetailDrawer.vue'
import { useOrderList } from './composables/useOrderList'

const {
  orders,
  loading,
  error,
  searchQuery,
  statusFilter,
  sortBy,
  currentPage,
  totalPages,
  deleteOrder
} = useOrderList()

// 纯 UI 状态：详情弹窗
const showDetail = shallowRef(false)
const selectedOrder = shallowRef<Order | null>(null)

function handleView(order: Order) {
  selectedOrder.value = order
  showDetail.value = true
}
</script>

<template>
  <div class="order-page">
    <div v-if="error" class="error-banner">{{ error }}</div>

    <SearchBar v-model="searchQuery" placeholder="搜索订单号/客户名" />
    <FilterBar v-model:status="statusFilter" v-model:sort="sortBy" />

    <OrderTable
      :orders="orders"
      :loading="loading"
      @view="handleView"
      @delete="deleteOrder"
    />

    <PaginationBar v-model:page="currentPage" :total-pages="totalPages" />

    <OrderDetailDrawer
      v-model:open="showDetail"
      :order="selectedOrder"
    />
  </div>
</template>
```

## 列表拆分要点

### 查询参数的所有权

查询参数（searchQuery、filter、sort、page）由 composable 持有，通过返回可写的 ref 给子组件绑定 v-model。

```
composable 持有 searchQuery (ref)
  ↓ 返回给编排层
编排层通过 v-model 传给 SearchBar
  ↓
SearchBar 修改 → 自动触发 composable 内部的 watch → 重新获取数据
```

这种模式的好处：
- 数据获取逻辑完全封装在 composable 中
- 子组件不需要知道"修改搜索词后要做什么"
- 编排层只负责连线，不参与具体逻辑

### 行操作的事件冒泡

表格行内的操作按钮（查看、编辑、删除）通过 emit 冒泡到编排层：

```
用户点击"删除" → OrderTable emit('delete', id) → 编排层调用 composable.deleteOrder(id)
```

不要让子组件直接调用 API，保持子组件是纯 UI。
