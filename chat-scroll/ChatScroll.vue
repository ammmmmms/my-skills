<!--
  ChatScroll — AI 流式聊天滚动容器组件

  功能：
  1. 下拉加载历史消息（移动端弹性下拉 / PC loading spinner）
  2. 快速到底按钮（上滑超过 200px 或锚定触发时显示，流式输出中带 loading 外圈）
  3. 回到消息顶部按钮（一条消息占满整个可视区域时显示）
  4. 智能锚定（AI 流式输出时自动滚底，用户问题到达容器顶部时停止）

  使用示例：
  ```vue
  <ChatScroll
    :messages="messages"
    :streaming-message-id="streamingId"
    :anchor-message-id="currentQuestionId"
    :loading="loadingHistory"
    :has-more="hasMore"
    @load-more="loadHistory"
  >
    <template #message="{ message }">
      <YourChatMessage :message="message" />
    </template>
  </ChatScroll>
  ```

  Props：
  - messages:            消息数组，每条必须有 id 字段
  - streamingMessageId:  当前流式输出的消息 ID，传 null 表示没有流式输出
  - anchorMessageId:     锚定的用户问题 ID，流式输出时该消息到顶则停止滚动
  - loading:             是否正在加载历史消息
  - hasMore:             是否还有更多历史消息

  Events：
  - load-more:           需要加载历史消息时触发

  Expose（通过 ref 调用）：
  - scrollToBottom(smooth?: boolean)
  - scrollToMessage(messageId: string)
-->
<script setup lang="ts">
import { ref, computed, toRef, watch } from 'vue'
import type { ChatMessage } from './types'
import { useAutoScroll } from './useAutoScroll'
import { usePullToLoad } from './usePullToLoad'

const props = withDefaults(
  defineProps<{
    messages: ChatMessage[]
    loading?: boolean
    hasMore?: boolean
    streamingMessageId?: string | null
    anchorMessageId?: string | null
  }>(),
  {
    loading: false,
    hasMore: true,
    streamingMessageId: null,
    anchorMessageId: null,
  }
)

const emit = defineEmits<{
  (e: 'load-more'): void
}>()

const containerRef = ref<HTMLElement | null>(null)

// ====== 自动滚动 + 锚定 ======
const {
  userScrolledUp,
  anchorReachedTop,
  onScroll: onAutoScroll,
  scrollToBottom,
  scrollToMessage,
} = useAutoScroll({
  containerRef,
  streamingMessageId: toRef(props, 'streamingMessageId'),
  anchorMessageId: toRef(props, 'anchorMessageId'),
})

// ====== 下拉加载 ======
const {
  isMobile,
  pullDistance,
  pullTriggered,
  onScroll: onPullScroll,
  resetPull,
} = usePullToLoad({
  containerRef,
  loading: toRef(props, 'loading'),
  hasMore: toRef(props, 'hasMore'),
  onLoadMore: () => emit('load-more'),
})

// loading 结束时重置下拉距离
watch(() => props.loading, (val) => { if (!val) resetPull() })

// ====== 快速到底按钮 ======
const distanceToBottom = ref(0)
const isStreaming = computed(() => !!props.streamingMessageId)
// 上滑超过 200px 或锚定触发时显示
const showScrollToBottom = computed(
  () => distanceToBottom.value > 200 || anchorReachedTop.value
)

// ====== 回到消息顶部按钮 ======
const fullScreenMessageId = ref<string | null>(null)

/** 检测是否有一条消息占满整个可视区域（顶部被裁切 >30px 且底部超出容器） */
function detectFullScreenMessage() {
  const container = containerRef.value
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const wrappers = container.querySelectorAll('[data-message-id]')
  let found: string | null = null

  for (const el of wrappers) {
    const rect = (el as HTMLElement).getBoundingClientRect()
    if (rect.top < containerRect.top - 30 && rect.bottom >= containerRect.bottom - 2) {
      found = (el as HTMLElement).dataset.messageId || null
      break
    }
  }

  fullScreenMessageId.value = found
}

// ====== 统一 scroll 处理 ======
function onScroll() {
  const container = containerRef.value
  if (!container) return

  distanceToBottom.value = container.scrollHeight - container.scrollTop - container.clientHeight
  onAutoScroll()
  onPullScroll()
  detectFullScreenMessage()
}

function onScrollToTop() {
  if (fullScreenMessageId.value) {
    scrollToMessage(fullScreenMessageId.value)
  }
}

defineExpose({ scrollToBottom, scrollToMessage })
</script>

<template>
  <div class="chat-scroll-wrapper">
    <!-- 移动端弹性下拉指示器 -->
    <div
      v-if="isMobile"
      class="pull-indicator"
      :style="{ height: pullDistance + 'px', opacity: pullDistance > 0 ? 1 : 0 }"
    >
      <div class="pull-indicator-content">
        <span v-if="loading" class="spinner" />
        <span v-else-if="pullTriggered">释放加载</span>
        <span v-else>下拉加载更多</span>
      </div>
    </div>

    <!-- 滚动容器 -->
    <div ref="containerRef" class="chat-scroll-container" @scroll="onScroll">
      <!-- PC 端顶部 loading -->
      <div v-if="!isMobile && loading && hasMore" class="top-loading">
        <span class="spinner" />
        <span>加载中...</span>
      </div>

      <!-- 消息列表：自动包裹 wrapper div 添加 data-message-id -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        :data-message-id="msg.id"
        class="message-wrapper"
      >
        <slot name="message" :message="msg" />
      </div>
    </div>

    <!-- 回到消息顶部按钮（↑） -->
    <Transition name="fade">
      <button
        v-if="fullScreenMessageId"
        class="scroll-btn scroll-to-top-btn"
        title="回到消息顶部"
        @click="onScrollToTop"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </Transition>

    <!-- 快速到底按钮（↓），流式输出中带旋转外圈 -->
    <Transition name="fade">
      <button
        v-if="showScrollToBottom"
        class="scroll-btn scroll-to-bottom-btn"
        :title="isStreaming ? 'AI 输出中，点击回到底部' : '回到底部'"
        @click="scrollToBottom(true)"
      >
        <span v-if="isStreaming" class="btn-spinner-ring" />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style>
@import './chat-scroll.css';
</style>
