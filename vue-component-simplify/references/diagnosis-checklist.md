---
title: 组件臃肿诊断清单
impact: HIGH
impactDescription: 准确诊断是精简的前提，误判会导致过度拆分或遗漏真正的问题
type: best-practice
tags: [vue3, refactoring, diagnosis, code-smell, component-design]
---

# 组件臃肿诊断清单

**Impact: HIGH** - 在动手拆分之前，先用这个清单系统化地分析组件的问题。不是所有大组件都需要拆分，关键是识别职责混杂。

## 臃肿信号检测

按以下维度逐项检查目标组件：

### 信号 1：多组不相关的状态

`<script setup>` 中存在多组互不依赖的响应式状态。

**臃肿示例：**
```vue
<script setup lang="ts">
// 👎 三组互不相关的状态混在一起
// ---- 表单状态 ----
const formData = ref({ name: '', email: '' })
const formErrors = ref({})
const isSubmitting = ref(false)

// ---- 列表状态 ----
const items = ref([])
const searchQuery = ref('')
const currentPage = ref(1)

// ---- 弹窗状态 ----
const showModal = ref(false)
const modalContent = ref(null)
</script>
```

**判定**：如果能把某一组状态及其相关逻辑整体删除，其余代码仍然正常工作，说明这些是不同职责，应该拆分。

### 信号 2：模板中有多个独立 UI 区域

`<template>` 中有 3 个以上彼此独立的区域块。

**臃肿示例：**
```vue
<template>
  <div>
    <!-- 区域1: 搜索栏 -->
    <div class="search-bar">...</div>

    <!-- 区域2: 筛选器 -->
    <div class="filters">...</div>

    <!-- 区域3: 数据表格 -->
    <table class="data-table">...</table>

    <!-- 区域4: 分页 -->
    <div class="pagination">...</div>

    <!-- 区域5: 详情弹窗 -->
    <div v-if="showDetail" class="detail-modal">...</div>
  </div>
</template>
```

**判定**：每个独立区域如果有自己的交互逻辑，就应该成为独立组件。

### 信号 3：重复的模板片段

同一结构的模板片段出现 2 次以上。

```vue
<template>
  <!-- 👎 相同结构重复出现 -->
  <div class="card">
    <h3>{{ item1.title }}</h3>
    <p>{{ item1.description }}</p>
    <span :class="statusClass(item1.status)">{{ item1.status }}</span>
  </div>
  <div class="card">
    <h3>{{ item2.title }}</h3>
    <p>{{ item2.description }}</p>
    <span :class="statusClass(item2.status)">{{ item2.status }}</span>
  </div>
</template>
```

**判定**：提取为独立子组件，通过 props 传入差异数据。

### 信号 4：组件同时承担获取、处理、渲染

一个组件同时包含 API 调用、数据转换、业务逻辑和 UI 渲染。

```vue
<script setup lang="ts">
// 👎 数据获取
const { data } = await useFetch('/api/users')

// 👎 业务逻辑
const activeUsers = computed(() => data.value?.filter(u => u.active))
const stats = computed(() => ({
  total: data.value?.length,
  active: activeUsers.value?.length,
  ratio: activeUsers.value?.length / data.value?.length
}))

// 👎 UI 状态
const sortBy = ref('name')
const showExportDialog = ref(false)

// 👎 操作方法
async function deleteUser(id: number) { /* ... */ }
async function exportCsv() { /* ... */ }
</script>
```

**判定**：数据获取和业务逻辑提取为 composable，UI 状态留在组件或拆分到子组件。

### 信号 5：行数与复杂度

| 指标 | 正常范围 | 需要关注 | 强烈建议拆分 |
|------|---------|---------|-------------|
| 总行数 | < 150 行 | 150-300 行 | > 300 行 |
| script 行数 | < 80 行 | 80-150 行 | > 150 行 |
| template 嵌套层级 | < 5 层 | 5-8 层 | > 8 层 |
| ref/reactive 声明数 | < 5 个 | 5-10 个 | > 10 个 |
| 方法/函数数量 | < 5 个 | 5-10 个 | > 10 个 |

注意：行数只是参考，核心判断标准是**职责数量**，而非代码量。一个 200 行但职责单一的组件可能不需要拆分。

## 诊断输出格式

分析完成后，按以下格式记录结果：

```
目标组件: XxxPage.vue (总行数 / script 行数)
识别的职责:
  1. [职责名] - 一句话描述
  2. [职责名] - 一句话描述
  ...
拆分建议:
  - composable: useXxx (管理 xxx 状态和逻辑)
  - 子组件: XxxForm (表单区域)
  - 子组件: XxxList (列表区域)
  - utils: xxxFormatter (纯格式化函数)
```
