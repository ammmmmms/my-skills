<script setup lang="ts">
/**
 * ChatScroll — AI 流式聊天滚动容器组件（纯容器，不负责消息渲染）
 *
 * 功能：
 * 1. 下拉加载历史消息（移动端弹性下拉 / PC loading spinner）
 * 2. 快速到底按钮（上滑超过 200px 或锚定触发时显示，流式输出中带 loading 外圈）
 * 3. 回到消息顶部按钮（一条消息占满整个可视区域时显示）
 * 4. 智能锚定（AI 流式输出时自动滚底，用户问题到达容器顶部时停止）
 *
 * 使用示例：
 *
 *   <ChatScroll
 *     :streaming-message-id="streamingId"
 *     :anchor-message-id="currentQuestionId"
 *     :loading="loadingHistory"
 *     :has-more="hasMore"
 *     @load-more="loadHistory"
 *   >
 *     <ChatList :messages="messages" />
 *   </ChatScroll>
 *
 * 同事需要配合：
 * 每条消息的根元素上添加 data-message-id 属性，值为消息 ID。
 * 例如：div data-message-id="msg-123"
 * 锚定定位和"回到消息顶部"功能依赖此属性。
 *
 * Props：
 * - streamingMessageId:  当前流式输出的消息 ID，null 表示无流式输出
 * - anchorMessageId:     锚定的用户问题 ID，流式输出时该消息到顶则停止滚动
 * - loading:             是否正在加载历史消息
 * - hasMore:             是否还有更多历史消息
 *
 * Events：
 * - load-more:           需要加载历史消息时触发
 *
 * Expose（通过 ref 调用）：
 * - scrollToBottom(smooth?: boolean)
 * - scrollToMessage(messageId: string)
 */
import { ref, computed, toRef, watch, nextTick, onUnmounted } from 'vue'
import { useAutoScroll } from './useAutoScroll'
import { usePullToLoad } from './usePullToLoad'

/** 简易节流：间隔内最多执行一次 */
function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    }
  }) as T
}

const props = withDefaults(
  defineProps<{
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

/**
 * 加载历史消息前记录 scrollHeight，加载完成后补偿 scrollTop
 * 补偿后再往上偏移 30px，让用户感知到新消息已加载
 * 移动端和 PC 端都适用
 */
let prevScrollHeight = 0
const LOAD_OFFSET = 30

watch(() => props.loading, (val) => {
  const container = containerRef.value
  if (val && container) {
    prevScrollHeight = container.scrollHeight
  }
  if (!val) {
    resetPull()
    // 等 DOM 更新后再补偿 scrollTop
    nextTick(() => {
      if (container && prevScrollHeight > 0) {
        const delta = container.scrollHeight - prevScrollHeight
        if (delta > 0) {
          container.scrollTop += delta - LOAD_OFFSET
        }
        prevScrollHeight = 0
      }
    })
  }
})

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
const detectFullScreenMessage = throttle(() => {
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
}, 100) // 100ms 节流，避免消息多时卡顿

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

      <!-- 默认插槽：放入同事的 ChatList 组件 -->
      <slot />
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
