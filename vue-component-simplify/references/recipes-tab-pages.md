---
title: 标签页拆分食谱
impact: MEDIUM
impactDescription: 多标签页组件容易把所有 Tab 的逻辑堆在一个文件里，拆分后每个 Tab 独立维护
type: recipe
tags: [vue3, tabs, refactoring, dynamic-component, keep-alive]
---

# 标签页拆分食谱

**Impact: MEDIUM** - 多 Tab 页面把每个 Tab 的模板和逻辑都写在同一个组件里，随着 Tab 数量增加会快速膨胀。

## 典型臃肿标签页

```vue
<!-- 👎 UserManagePage.vue - 400+ 行 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const activeTab = ref('profile')

// ---- Tab 1: 个人资料 ----
const profileForm = ref({ name: '', bio: '', website: '' })
const profileLoading = ref(false)
async function saveProfile() { /* 30 行 */ }

// ---- Tab 2: 安全设置 ----
const twoFAEnabled = ref(false)
const sessions = ref([])
async function loadSessions() { /* 20 行 */ }
async function revokeSession(id: string) { /* 10 行 */ }
async function toggleTwoFA() { /* 15 行 */ }

// ---- Tab 3: 账单信息 ----
const billingPlan = ref('free')
const invoices = ref([])
const paymentMethod = ref(null)
async function loadBilling() { /* 20 行 */ }
async function upgradePlan(plan: string) { /* 15 行 */ }
async function downloadInvoice(id: string) { /* 10 行 */ }

// ---- Tab 4: 团队管理 ----
const teamMembers = ref([])
const inviteEmail = ref('')
async function loadTeam() { /* 15 行 */ }
async function inviteMember() { /* 15 行 */ }
async function removeMember(id: string) { /* 10 行 */ }

onMounted(() => {
  // 加载所有 tab 数据...
})
</script>

<template>
  <div>
    <div class="tabs">
      <button v-for="tab in tabs" @click="activeTab = tab.key">{{ tab.label }}</button>
    </div>

    <!-- 每个 tab 的模板 50-80 行 -->
    <div v-if="activeTab === 'profile'"><!-- ... --></div>
    <div v-else-if="activeTab === 'security'"><!-- ... --></div>
    <div v-else-if="activeTab === 'billing'"><!-- ... --></div>
    <div v-else-if="activeTab === 'team'"><!-- ... --></div>
  </div>
</template>
```

## 拆分方案

### 数据流设计

```
UserManagePage (编排层)
├── activeTab (shallowRef: 当前选中 Tab)
├── TabBar (子组件: Tab 切换栏)
│   ├── props: tabs, activeTab
│   └── emit: change
└── <component :is="..."> 或 v-if (动态渲染当前 Tab)
    ├── ProfileTab (子组件: 个人资料)
    │   └── 内部管理自己的状态和 API 调用
    ├── SecurityTab (子组件: 安全设置)
    │   └── 内部管理自己的状态和 API 调用
    ├── BillingTab (子组件: 账单信息)
    │   └── 内部管理自己的状态和 API 调用
    └── TeamTab (子组件: 团队管理)
        └── 内部管理自己的状态和 API 调用
```

**关键区别**：Tab 内容组件与表单子组件不同——每个 Tab 是独立的功能模块，拥有自己的状态和 API 调用，不需要向父组件暴露数据。

### 拆分后的代码

**Tab 内容组件（示例：安全设置）**
```vue
<!-- components/SecurityTab.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const twoFAEnabled = ref(false)
const sessions = ref<Session[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [faStatus, sessionList] = await Promise.all([
      api.getTwoFAStatus(),
      api.getSessions()
    ])
    twoFAEnabled.value = faStatus.enabled
    sessions.value = sessionList
  } finally {
    loading.value = false
  }
})

async function toggleTwoFA() {
  twoFAEnabled.value = !twoFAEnabled.value
  await api.setTwoFA(twoFAEnabled.value)
}

async function revokeSession(id: string) {
  await api.revokeSession(id)
  sessions.value = sessions.value.filter(s => s.id !== id)
}
</script>

<template>
  <div v-if="loading">加载中...</div>
  <div v-else>
    <div class="two-fa">
      <label>
        <input v-model="twoFAEnabled" type="checkbox" @change="toggleTwoFA" />
        启用两步验证
      </label>
    </div>
    <div class="sessions">
      <h3>活跃会话</h3>
      <div v-for="session in sessions" :key="session.id">
        <span>{{ session.device }} - {{ session.lastActive }}</span>
        <button @click="revokeSession(session.id)">撤销</button>
      </div>
    </div>
  </div>
</template>
```

**编排层：重构后的页面**
```vue
<!-- UserManagePage.vue -->
<script setup lang="ts">
import { shallowRef, markRaw } from 'vue'
import ProfileTab from './components/ProfileTab.vue'
import SecurityTab from './components/SecurityTab.vue'
import BillingTab from './components/BillingTab.vue'
import TeamTab from './components/TeamTab.vue'

const tabs = [
  { key: 'profile', label: '个人资料', component: markRaw(ProfileTab) },
  { key: 'security', label: '安全设置', component: markRaw(SecurityTab) },
  { key: 'billing', label: '账单信息', component: markRaw(BillingTab) },
  { key: 'team', label: '团队管理', component: markRaw(TeamTab) }
]

const activeTab = shallowRef(tabs[0])

function switchTab(tab: typeof tabs[number]) {
  activeTab.value = tab
}
</script>

<template>
  <div class="manage-page">
    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ active: activeTab.key === tab.key }"
        @click="switchTab(tab)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- KeepAlive 保留已访问 Tab 的状态，避免切换时丢失表单填写 -->
    <KeepAlive>
      <component :is="activeTab.component" :key="activeTab.key" />
    </KeepAlive>
  </div>
</template>
```

## 标签页拆分要点

### Tab 之间需要共享数据时

如果多个 Tab 需要访问同一份数据（如用户信息），使用 provide/inject 或 Pinia：

```vue
<!-- 父组件提供共享数据 -->
<script setup lang="ts">
import { provide, ref, onMounted } from 'vue'
import { UserKey } from '@/keys'

const user = ref<User | null>(null)
onMounted(async () => {
  user.value = await api.getCurrentUser()
})

provide(UserKey, user)
</script>
```

```vue
<!-- Tab 子组件消费 -->
<script setup lang="ts">
import { inject } from 'vue'
import { UserKey } from '@/keys'

const user = inject(UserKey)!
</script>
```

### 使用 KeepAlive 的注意事项

- 使用 `<KeepAlive>` 可以保留切换走的 Tab 状态，避免重复加载
- 如果 Tab 数据需要实时刷新，在 `onActivated` 钩子中重新获取
- 通过 `:max` 限制缓存的 Tab 数量，避免内存增长

```vue
<KeepAlive :max="3">
  <component :is="activeTab.component" :key="activeTab.key" />
</KeepAlive>
```

### 使用 markRaw 包装组件引用

动态组件存储在响应式变量中时，必须使用 `markRaw()` 包装，避免 Vue 将组件对象转为响应式代理导致警告和性能问题。

```ts
// 👎 组件会被代理
const tabs = ref([{ component: ProfileTab }])

// 👍 用 markRaw 标记
const tabs = [{ component: markRaw(ProfileTab) }]
```
