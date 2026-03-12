---
title: 大型表单拆分食谱
impact: HIGH
impactDescription: 表单组件是最容易膨胀的组件类型，拆分方式直接影响表单的可维护性和数据一致性
type: recipe
tags: [vue3, form, refactoring, v-model, validation, composable]
---

# 大型表单拆分食谱

**Impact: HIGH** - 大型表单（字段超过 8 个、表单分多个区域）是最常见的臃肿组件。本食谱提供从诊断到拆分的完整示例。

## 典型臃肿表单

```vue
<!-- 👎 UserSettingsForm.vue - 250+ 行的臃肿表单 -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

// ---- 基本信息 ----
const name = ref('')
const email = ref('')
const phone = ref('')
const avatar = ref('')

// ---- 密码修改 ----
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordStrength = computed(() => {
  if (newPassword.value.length < 6) return 'weak'
  if (newPassword.value.length < 12) return 'medium'
  return 'strong'
})

// ---- 通知偏好 ----
const emailNotify = ref(true)
const smsNotify = ref(false)
const pushNotify = ref(true)
const notifyFrequency = ref('daily')

// ---- 表单验证 ----
const errors = ref<Record<string, string>>({})
function validateEmail(email: string) { /* ... */ }
function validatePhone(phone: string) { /* ... */ }
function validatePassword(pw: string) { /* ... */ }

// ---- 提交逻辑 ----
const isSubmitting = ref(false)
async function handleSubmit() {
  errors.value = {}
  if (!validateEmail(email.value)) errors.value.email = '邮箱格式错误'
  if (!validatePhone(phone.value)) errors.value.phone = '手机号格式错误'
  if (newPassword.value && !validatePassword(newPassword.value))
    errors.value.password = '密码强度不够'
  if (newPassword.value !== confirmPassword.value)
    errors.value.confirmPassword = '两次输入不一致'
  if (Object.keys(errors.value).length > 0) return

  isSubmitting.value = true
  try {
    await api.updateProfile({ name, email, phone, avatar })
    if (newPassword.value) await api.changePassword(currentPassword, newPassword)
    await api.updateNotificationPrefs({ emailNotify, smsNotify, pushNotify, notifyFrequency })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- 基本信息区域 50+ 行模板 -->
    <!-- 密码区域 40+ 行模板 -->
    <!-- 通知偏好区域 30+ 行模板 -->
    <!-- 提交按钮 -->
  </form>
</template>
```

## 诊断结果

```
目标组件: UserSettingsForm.vue (250 行)
识别的职责:
  1. 基本信息编辑 - 姓名、邮箱、手机、头像
  2. 密码修改 - 当前密码、新密码、确认密码、强度校验
  3. 通知偏好设置 - 邮件/短信/推送开关、频率
  4. 表单验证 - 各字段校验规则
  5. 提交编排 - 调用多个 API 保存不同区域的数据
```

## 拆分方案

### 数据流设计

```
UserSettingsForm (编排层)
├── useFormSubmit (composable: 提交状态管理)
├── ProfileSection (子组件: 基本信息)
│   ├── v-model:profile ← { name, email, phone, avatar }
│   └── 内部验证
├── PasswordSection (子组件: 密码修改)
│   ├── v-model:passwords ← { current, new, confirm }
│   ├── emit: valid (密码校验通过状态)
│   └── 内部验证 + 密码强度
└── NotificationSection (子组件: 通知偏好)
    └── v-model:prefs ← { email, sms, push, frequency }
```

### 拆分后的代码

**composable：表单提交管理**
```ts
// composables/useFormSubmit.ts
import { shallowRef, readonly } from 'vue'

export function useFormSubmit<T>(submitFn: (data: T) => Promise<void>) {
  const isSubmitting = shallowRef(false)
  const submitError = shallowRef<Error | null>(null)

  async function submit(data: T) {
    isSubmitting.value = true
    submitError.value = null
    try {
      await submitFn(data)
    } catch (e) {
      submitError.value = e as Error
      throw e
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    isSubmitting: readonly(isSubmitting),
    submitError: readonly(submitError),
    submit
  }
}
```

**子组件：基本信息区域**
```vue
<!-- components/ProfileSection.vue -->
<script setup lang="ts">
import { computed } from 'vue'

interface ProfileData {
  name: string
  email: string
  phone: string
  avatar: string
}

const model = defineModel<ProfileData>({ required: true })

// 验证逻辑内聚在子组件中
const errors = computed(() => {
  const errs: Partial<Record<keyof ProfileData, string>> = {}
  if (model.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(model.value.email)) {
    errs.email = '邮箱格式错误'
  }
  if (model.value.phone && !/^1\d{10}$/.test(model.value.phone)) {
    errs.phone = '手机号格式错误'
  }
  return errs
})

const isValid = computed(() => Object.keys(errors.value).length === 0)

defineExpose({ isValid })
</script>

<template>
  <fieldset>
    <legend>基本信息</legend>
    <div>
      <label>姓名</label>
      <input v-model="model.name" />
    </div>
    <div>
      <label>邮箱</label>
      <input v-model="model.email" type="email" />
      <span v-if="errors.email" class="error">{{ errors.email }}</span>
    </div>
    <div>
      <label>手机</label>
      <input v-model="model.phone" type="tel" />
      <span v-if="errors.phone" class="error">{{ errors.phone }}</span>
    </div>
  </fieldset>
</template>
```

**子组件：密码修改区域**
```vue
<!-- components/PasswordSection.vue -->
<script setup lang="ts">
import { computed } from 'vue'

interface PasswordData {
  current: string
  new: string
  confirm: string
}

const model = defineModel<PasswordData>({ required: true })

const strength = computed(() => {
  const len = model.value.new.length
  if (len === 0) return ''
  if (len < 6) return 'weak'
  if (len < 12) return 'medium'
  return 'strong'
})

const errors = computed(() => {
  const errs: Record<string, string> = {}
  if (model.value.new && model.value.new.length < 6) {
    errs.new = '密码至少 6 位'
  }
  if (model.value.new && model.value.confirm && model.value.new !== model.value.confirm) {
    errs.confirm = '两次输入不一致'
  }
  return errs
})

const isValid = computed(() => {
  if (!model.value.new) return true // 不修改密码也合法
  return Object.keys(errors.value).length === 0
})

defineExpose({ isValid })
</script>

<template>
  <fieldset>
    <legend>修改密码</legend>
    <div>
      <label>当前密码</label>
      <input v-model="model.current" type="password" />
    </div>
    <div>
      <label>新密码</label>
      <input v-model="model.new" type="password" />
      <span v-if="strength" :class="['strength', strength]">{{ strength }}</span>
      <span v-if="errors.new" class="error">{{ errors.new }}</span>
    </div>
    <div>
      <label>确认密码</label>
      <input v-model="model.confirm" type="password" />
      <span v-if="errors.confirm" class="error">{{ errors.confirm }}</span>
    </div>
  </fieldset>
</template>
```

**子组件：通知偏好区域**
```vue
<!-- components/NotificationSection.vue -->
<script setup lang="ts">
interface NotificationPrefs {
  email: boolean
  sms: boolean
  push: boolean
  frequency: 'realtime' | 'daily' | 'weekly'
}

const model = defineModel<NotificationPrefs>({ required: true })
</script>

<template>
  <fieldset>
    <legend>通知偏好</legend>
    <label><input v-model="model.email" type="checkbox" /> 邮件通知</label>
    <label><input v-model="model.sms" type="checkbox" /> 短信通知</label>
    <label><input v-model="model.push" type="checkbox" /> 推送通知</label>
    <div>
      <label>通知频率</label>
      <select v-model="model.frequency">
        <option value="realtime">实时</option>
        <option value="daily">每日汇总</option>
        <option value="weekly">每周汇总</option>
      </select>
    </div>
  </fieldset>
</template>
```

**编排层：重构后的父组件**
```vue
<!-- UserSettingsForm.vue -->
<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import ProfileSection from './components/ProfileSection.vue'
import PasswordSection from './components/PasswordSection.vue'
import NotificationSection from './components/NotificationSection.vue'
import { useFormSubmit } from '@/composables/useFormSubmit'

// 表单数据 - 按区域组织
const profile = ref({
  name: '', email: '', phone: '', avatar: ''
})
const passwords = ref({
  current: '', new: '', confirm: ''
})
const notifications = ref({
  email: true, sms: false, push: true, frequency: 'daily' as const
})

// 子组件引用 - 用于提交前校验
const profileRef = useTemplateRef('profileRef')
const passwordRef = useTemplateRef('passwordRef')

// 提交
const { isSubmitting, submit } = useFormSubmit(async () => {
  // 校验所有区域
  if (!profileRef.value?.isValid || !passwordRef.value?.isValid) return

  await api.updateProfile(profile.value)
  if (passwords.value.new) {
    await api.changePassword(passwords.value.current, passwords.value.new)
  }
  await api.updateNotificationPrefs(notifications.value)
})
</script>

<template>
  <form @submit.prevent="submit">
    <ProfileSection ref="profileRef" v-model="profile" />
    <PasswordSection ref="passwordRef" v-model="passwords" />
    <NotificationSection v-model="notifications" />
    <button type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? '保存中...' : '保存设置' }}
    </button>
  </form>
</template>
```

## 表单拆分要点

### 数据流选择

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 表单字段 ≤ 3 个 | 多个 `v-model:xxx` | 字段少时更直观 |
| 表单字段 > 3 个 | 对象 `v-model` | 避免 props 过多 |
| 子表单有独立提交 | 子组件内部状态 + `emit('submit', data)` | 隔离数据，提交时才上报 |
| 多区域统一提交 | 父组件持有状态 + `v-model` 下发 | 父组件统一校验和提交 |

### 验证逻辑的归属

- **字段级验证**（格式校验、必填）：放在子组件内部，通过 `defineExpose` 暴露 `isValid`
- **跨字段验证**（密码确认一致）：放在拥有这两个字段的子组件中
- **跨区域验证**（如邮箱不能与某字段重复）：放在父组件的提交逻辑中
