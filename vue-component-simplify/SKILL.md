---
name: vue-component-simplify
description: "精简臃肿 Vue 组件。当用户要求简化、拆分、瘦身、重构 Vue 组件，或组件职责混杂、体积过大时使用。提供系统化的诊断→拆分→提取→验证工作流。"
license: MIT
metadata:
  author: github.com/vuejs-ai
  version: "1.0.0"
---

# Vue 组件精简工作流

按顺序执行以下步骤，将臃肿组件重构为可维护的组件树。

## 核心原则

- **单一职责**：每个组件只做一件事，每个 composable 只管一个关注点。
- **数据流清晰**：props 向下、events 向上，拆分后数据流向必须可追溯。
- **功能不变**：精简是重构，不是重写。行为和外观必须与重构前一致。
- **渐进拆分**：一次提取一个关注点，每步验证，不要一次性重写整个组件。

## 1) 诊断臃肿点（必须）

在动手之前，先分析目标组件的问题所在。

- 必读参考：[诊断清单](references/diagnosis-checklist.md)
- 阅读完整组件代码，标记以下信号：
  - `<script setup>` 中有多个不相关的状态组（如表单状态 + 列表状态 + 弹窗状态）
  - `<template>` 中有 3 个以上独立 UI 区域
  - 存在重复的模板片段（列表项、卡片、表单字段组）
  - 组件行数超过 200 行
  - 同一组件同时处理数据获取、业务逻辑和 UI 渲染
- 列出所有识别出的职责，每个职责用一句话描述

## 2) 制定拆分计划（必须）

根据诊断结果，画出目标组件树。

- 确定哪些逻辑提取为 composable（状态管理、副作用、业务规则）
- 确定哪些 UI 片段拆分为子组件（独立区域、重复模板、可复用块）
- 确定哪些纯函数提取为 utils（格式化、验证、计算）
- 为每个子组件定义 props/emits 契约草案
- 明确数据流方向：哪些数据从父组件流向子组件（props），哪些事件从子组件冒泡（emits）
- 必读参考：[拆分后数据流](references/data-flow-after-split.md)

## 3) 提取 Composables（按需）

将状态逻辑和副作用从组件中提取到 composable。

- 必读参考：[提取 Composable 模式](references/extract-composable-patterns.md)
- 每个 composable 管理一个关注点的状态
- 返回值使用 `readonly()` 保护内部状态，通过显式方法修改
- composable 之间通过参数传递依赖，不使用隐式共享

## 4) 拆分子组件（按需）

将 UI 片段拆分为独立子组件。

- 必读参考：[子组件拆分模式](references/split-component-patterns.md)
- 必读参考：[薄编排层模式](references/thin-orchestrator-pattern.md)
- 子组件通过 props 接收数据，通过 emits 通知父组件
- 表单类场景优先使用 `v-model` 双向绑定
- 父组件保持为薄编排层：只做组合，不做具体实现

## 5) 清理与验证（必须）

确认重构结果符合预期。

- 父组件已成为薄编排层，核心逻辑在 composables 中，UI 在子组件中
- 所有数据流方向清晰：props 向下、events 向上、跨层级用 provide/inject
- 没有引入新的 prop drilling（超过 2 层传递同一数据时考虑 provide/inject）
- 功能行为与重构前完全一致
- TypeScript 类型完整，props/emits 有明确类型定义

## 场景重构食谱

根据具体场景选择对应的食谱参考：

- 大型表单组件（多字段、多区域表单）→ [大型表单拆分食谱](references/recipes-large-form.md)
- 复杂列表组件（列表 + 搜索 + 筛选 + 分页）→ [复杂列表拆分食谱](references/recipes-complex-list.md)
- 标签页组件（多 Tab 内容切换）→ [标签页拆分食谱](references/recipes-tab-pages.md)
- 弹窗组件（Modal/Dialog/Drawer）→ [弹窗拆分食谱](references/recipes-modal-dialog.md)
