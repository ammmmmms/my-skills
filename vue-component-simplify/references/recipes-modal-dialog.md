---
title: 弹窗拆分食谱
impact: MEDIUM
impactDescription: 弹窗逻辑与页面逻辑混在一起会严重增加组件复杂度，正确拆分能保持页面组件清晰
type: recipe
tags: [vue3, modal, dialog, drawer, refactoring, teleport, v-model]
---

# 弹窗拆分食谱

**Impact: MEDIUM** - 弹窗（Modal/Dialog/Drawer）的状态、内容、交互逻辑容易和页面组件混在一起，导致页面组件急剧膨胀。

## 典型臃肿模式

```vue
<!-- 👎 ProductPage.vue - 弹窗逻辑与页面混杂 -->
<script setup lang="ts">
import { ref } from 'vue'

// ---- 页面数据 ----
const products = ref<Product[]>([])

// ---- 新增弹窗 ----
const showCreateModal = ref(false)
const createForm = ref({ name: '', price: 0, category: '' })
const createErrors = ref({})
const isCreating = ref(false)
async function handleCreate() { /* 20 行 */ }

// ---- 编辑弹窗 ----
const showEditModal = ref(false)
const editForm = ref({ id: 0, name: '', price: 0, category: '' })
const editErrors = ref({})
const isEditing = ref(false)
async function openEdit(product: Product) { /* 5 行 */ }
async function handleEdit() { /* 20 行 */ }

// ---- 删除确认弹窗 ----
const showDeleteConfirm = ref(false)
const deletingProduct = ref<Product | null>(null)
const isDeleting = ref(false)
async function confirmDelete() { /* 10 行 */ }

// ---- 详情弹窗 ----
const showDetailDrawer = ref(false)
const detailProduct = ref<Product | null>(null)
async function openDetail(id: number) { /* 10 行 */ }
</script>

<template>
  <div>
    <!-- 页面主体内容 -->

    <!-- 4 个弹窗的模板，每个 30-50 行 -->
    <div v-if="showCreateModal" class="modal"><!-- ... --></div>
    <div v-if="showEditModal" class="modal"><!-- ... --></div>
    <div v-if="showDeleteConfirm" class="modal"><!-- ... --></div>
    <div v-if="showDetailDrawer" class="drawer"><!-- ... --></div>
  </div>
</template>
```

**问题**：4 个弹窗带来了 8 个 ref、4 组方法、120+ 行弹窗模板，页面组件的核心逻辑被淹没。

## 拆分方案

### 数据流设计

```
ProductPage (编排层)
├── useProductList (composable: 产品列表管理)
├── ProductTable (子组件: 列表展示)
│   ├── props: products, loading
│   ├── emit: create (打开新增弹窗)
│   ├── emit: edit (打开编辑弹窗)
│   ├── emit: delete (打开删除确认)
│   └── emit: view (打开详情)
├── ProductFormModal (子组件: 新增/编辑弹窗)
│   ├── v-model:open ← showFormModal
│   ├── props: product (null=新增, 有值=编辑)
│   └── emit: saved (保存成功，通知刷新列表)
├── ConfirmDialog (通用子组件: 确认弹窗)
│   ├── v-model:open ← showDeleteConfirm
│   ├── props: title, message
│   └── emit: confirm
└── ProductDetailDrawer (子组件: 详情抽屉)
    ├── v-model:open ← showDetail
    └── props: productId
```

### 拆分后的代码

**弹窗子组件：产品表单弹窗（新增 + 编辑合一）**
```vue
<!-- components/ProductFormModal.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Product } from '@/types'

const props = defineProps<{
  /** null 表示新增，有值表示编辑 */
  product: Product | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEditing = computed(() => props.product !== null)
const title = computed(() => isEditing.value ? '编辑产品' : '新增产品')

// 内部表单状态 - 与外部隔离
const form = ref({ name: '', price: 0, category: '' })
const errors = ref<Record<string, string>>({})
const isSaving = ref(false)

// 打开时初始化表单
watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.product) {
    form.value = { ...props.product }
  } else {
    form.value = { name: '', price: 0, category: '' }
  }
  errors.value = {}
})

function validate(): boolean {
  errors.value = {}
  if (!form.value.name.trim()) errors.value.name = '名称不能为空'
  if (form.value.price <= 0) errors.value.price = '价格必须大于 0'
  return Object.keys(errors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return

  isSaving.value = true
  try {
    if (isEditing.value) {
      await api.updateProduct(props.product!.id, form.value)
    } else {
      await api.createProduct(form.value)
    }
    open.value = false
    emit('saved')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="open = false">
      <div class="modal">
        <h2>{{ title }}</h2>
        <form @submit.prevent="handleSubmit">
          <div>
            <label>名称</label>
            <input v-model="form.name" />
            <span v-if="errors.name" class="error">{{ errors.name }}</span>
          </div>
          <div>
            <label>价格</label>
            <input v-model.number="form.price" type="number" />
            <span v-if="errors.price" class="error">{{ errors.price }}</span>
          </div>
          <div>
            <label>分类</label>
            <input v-model="form.category" />
          </div>
          <div class="actions">
            <button type="button" @click="open = false">取消</button>
            <button type="submit" :disabled="isSaving">
              {{ isSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
```

**通用确认弹窗**
```vue
<!-- components/ConfirmDialog.vue -->
<script setup lang="ts">
defineProps<{
  title: string
  message: string
  confirmText?: string
  danger?: boolean
}>()

defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="open = false">
      <div class="confirm-dialog">
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="actions">
          <button @click="open = false">取消</button>
          <button
            :class="{ danger }"
            @click="$emit('confirm'); open = false"
          >
            {{ confirmText ?? '确认' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
```

**编排层：重构后的页面**
```vue
<!-- ProductPage.vue -->
<script setup lang="ts">
import { shallowRef } from 'vue'
import ProductTable from './components/ProductTable.vue'
import ProductFormModal from './components/ProductFormModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ProductDetailDrawer from './components/ProductDetailDrawer.vue'
import { useProductList } from './composables/useProductList'

const { products, loading, refresh, deleteProduct } = useProductList()

// 表单弹窗状态
const showFormModal = shallowRef(false)
const editingProduct = shallowRef<Product | null>(null)

function openCreate() {
  editingProduct.value = null
  showFormModal.value = true
}

function openEdit(product: Product) {
  editingProduct.value = product
  showFormModal.value = true
}

// 删除确认状态
const showDeleteConfirm = shallowRef(false)
const deletingId = shallowRef<number | null>(null)

function openDelete(id: number) {
  deletingId.value = id
  showDeleteConfirm.value = true
}

async function handleConfirmDelete() {
  if (deletingId.value !== null) {
    await deleteProduct(deletingId.value)
  }
}

// 详情抽屉状态
const showDetail = shallowRef(false)
const detailProductId = shallowRef<number | null>(null)

function openDetail(product: Product) {
  detailProductId.value = product.id
  showDetail.value = true
}
</script>

<template>
  <div class="product-page">
    <button @click="openCreate">新增产品</button>

    <ProductTable
      :products="products"
      :loading="loading"
      @edit="openEdit"
      @delete="(p) => openDelete(p.id)"
      @view="openDetail"
    />

    <ProductFormModal
      v-model:open="showFormModal"
      :product="editingProduct"
      @saved="refresh"
    />

    <ConfirmDialog
      v-model:open="showDeleteConfirm"
      title="删除产品"
      message="确定要删除此产品吗？此操作不可撤销。"
      confirm-text="删除"
      danger
      @confirm="handleConfirmDelete"
    />

    <ProductDetailDrawer
      v-model:open="showDetail"
      :product-id="detailProductId"
    />
  </div>
</template>
```

## 弹窗拆分要点

### v-model:open 模式

所有弹窗统一使用 `v-model:open` 控制显隐，这样父组件和子组件都可以关闭弹窗：
- 父组件通过修改绑定值打开/关闭
- 子组件内部通过 `open.value = false` 关闭（取消按钮、遮罩层点击）

### 弹窗内部状态隔离

弹窗的表单状态应该在弹窗**内部**管理，不要放在父组件中：

```
👎 父组件管理弹窗表单状态 → 父组件臃肿，状态泄漏
👍 弹窗内部管理表单状态 → watch(open) 时初始化，关闭时自动清理
```

弹窗通过 props 接收初始数据（如编辑模式的原始数据），在 `watch(open)` 中拷贝到内部状态。操作完成后通过 emit 通知父组件结果（如 `saved`、`confirm`）。

### 新增和编辑复用同一弹窗

通过 `product: Product | null` prop 区分模式：
- `null` → 新增模式，表单初始为空
- 有值 → 编辑模式，表单初始为传入数据的拷贝

这样避免维护两个几乎相同的弹窗组件。

### 使用 Teleport

弹窗组件使用 `<Teleport to="body">` 将 DOM 渲染到 body 下，避免被父组件的 `overflow: hidden` 或 `z-index` 上下文影响。
