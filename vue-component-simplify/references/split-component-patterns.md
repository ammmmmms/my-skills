---
title: 子组件拆分模式
impact: HIGH
impactDescription: 正确的拆分粒度和契约设计决定了重构后代码的可维护性
type: best-practice
tags: [vue3, components, refactoring, props, emits, splitting]
---

# 子组件拆分模式

**Impact: HIGH** - 将 UI 片段从臃肿组件中拆分为独立子组件。关键是定义清晰的 props/emits 契约，保持数据流可追溯。

## 任务清单

- 按 UI 区域拆分，每个子组件对应一个视觉/交互区域
- 为每个子组件定义明确的 props（输入）和 emits（输出）
- 表单类子组件使用 v-model 双向绑定
- 重复模板提取为可复用子组件

## 拆分粒度判定

### 应该拆分的情况

1. **独立交互区域**：有自己的用户交互逻辑（点击、输入、选择）
2. **重复结构**：同一模板结构出现 2 次以上
3. **条件渲染的大块内容**：`v-if` 控制的大段模板（> 20 行）
4. **可独立测试的 UI 单元**：如表单、列表项、卡片

### 不应拆分的情况

1. **纯展示无交互的小片段**（< 10 行模板）
2. **拆分后 props 数量超过 5 个且都是同一对象的字段**（说明拆分粒度过细）
3. **只在一个地方使用且逻辑简单的模板**

## 拆分示例

### 按区域拆分

**拆分前：**
```vue
<template>
  <div class="user-page">
    <!-- 用户信息区 -->
    <div class="user-info">
      <img :src="user.avatar" />
      <h2>{{ user.name }}</h2>
      <p>{{ user.bio }}</p>
      <button @click="editProfile">编辑</button>
    </div>

    <!-- 用户文章列表 -->
    <div class="articles">
      <div v-for="article in articles" :key="article.id" class="article-card">
        <h3>{{ article.title }}</h3>
        <p>{{ article.summary }}</p>
        <span>{{ formatDate(article.createdAt) }}</span>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination">
      <button :disabled="page === 1" @click="page--">上一页</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button :disabled="page === totalPages" @click="page++">下一页</button>
    </div>
  </div>
</template>
```

**拆分后 - 子组件定义：**

```vue
<!-- components/UserProfile.vue -->
<script setup lang="ts">
interface Props {
  avatar: string
  name: string
  bio: string
}

defineProps<Props>()
defineEmits<{
  edit: []
}>()
</script>

<template>
  <div class="user-info">
    <img :src="avatar" />
    <h2>{{ name }}</h2>
    <p>{{ bio }}</p>
    <button @click="$emit('edit')">编辑</button>
  </div>
</template>
```

```vue
<!-- components/ArticleList.vue -->
<script setup lang="ts">
import type { Article } from '@/types'
import ArticleCard from './ArticleCard.vue'

defineProps<{
  articles: Article[]
}>()
</script>

<template>
  <div class="articles">
    <ArticleCard
      v-for="article in articles"
      :key="article.id"
      :article="article"
    />
  </div>
</template>
```

```vue
<!-- components/ArticleCard.vue -->
<script setup lang="ts">
import type { Article } from '@/types'
import { formatDate } from '@/utils/format'

defineProps<{
  article: Article
}>()
</script>

<template>
  <div class="article-card">
    <h3>{{ article.title }}</h3>
    <p>{{ article.summary }}</p>
    <span>{{ formatDate(article.createdAt) }}</span>
  </div>
</template>
```

**拆分后 - 父组件（编排层）：**

```vue
<!-- UserPage.vue -->
<script setup lang="ts">
import UserProfile from './components/UserProfile.vue'
import ArticleList from './components/ArticleList.vue'
import PaginationBar from './components/PaginationBar.vue'
import { useUserArticles } from '@/composables/useUserArticles'

const { user, articles, page, totalPages } = useUserArticles()

function handleEditProfile() {
  // 编辑逻辑
}
</script>

<template>
  <div class="user-page">
    <UserProfile
      :avatar="user.avatar"
      :name="user.name"
      :bio="user.bio"
      @edit="handleEditProfile"
    />
    <ArticleList :articles="articles" />
    <PaginationBar v-model:page="page" :total-pages="totalPages" />
  </div>
</template>
```

## Props 设计原则

### 传对象还是传字段？

**传字段**（解构传递）：子组件只需要对象的部分属性，且子组件可以复用于不同数据源。
```vue
<UserAvatar :src="user.avatar" :name="user.name" />
```

**传对象**：子组件需要对象的大部分属性，且与该对象类型强绑定。
```vue
<ArticleCard :article="article" />
```

**判定标准**：如果传字段导致 props 超过 4-5 个，改为传对象。
