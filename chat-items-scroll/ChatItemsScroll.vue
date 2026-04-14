<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { usePullToLoad } from './usePullToLoad'
import type {
  AutoScrollToBottom,
  AutoScrollToBottomParams,
  ChatItemsState,
  ItemLocation,
  ItemLocationWithAlign,
  ListScrollLocation,
  ScrollModifier,
} from './types'

type ChatItem = any

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

interface ScrollSnapshot {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
  bottomOffset: number
  atBottom: boolean
}

const props = withDefaults(
  defineProps<{
    state: ChatItemsState<any>
    getItemKey: (item: ChatItem, index: number) => string | number
    getAnchorId?: (item: ChatItem, index: number) => string | null | undefined
    getMessageId?: (item: ChatItem, index: number) => string | null | undefined
    loading?: boolean
    hasMore?: boolean
    isStreaming?: boolean
    anchorMessageId?: string | null
  }>(),
  {
    loading: false,
    hasMore: true,
    isStreaming: false,
    anchorMessageId: null,
    getAnchorId: undefined,
    getMessageId: undefined,
  }
)

const emit = defineEmits<{
  (e: 'load-more'): void
}>()

const containerRef = ref<HTMLElement | null>(null)

const userScrolledUp = ref(false)
const anchorReachedTop = ref(false)
const distanceToBottom = ref(0)
const fullScreenMessageId = ref<string | null>(null)
const isStreaming = computed(() => props.isStreaming)
const items = computed(() => props.state.data)
const showScrollToBottom = computed(
  () => distanceToBottom.value > 200 || anchorReachedTop.value
)

const DISTANCE_EPSILON = 2
const BOTTOM_RESET_THRESHOLD = 30
const DEFAULT_ITEM_CHANGE_BEHAVIOR: ScrollBehavior = 'auto'

let anchorBypassed = false
let lastScrollTop = 0
let isAutoScrolling = false
let isSmoothScrolling = false
let smoothScrollTimer: ReturnType<typeof setTimeout> | null = null

const itemElements = new Map<string, HTMLElement>()
const itemHeights = new Map<string, number>()
let itemResizeObserver: ResizeObserver | null = null

function getItemKeyValue(item: ChatItem, index: number) {
  return String(props.getItemKey(item, index))
}

function getDistanceToBottom(container: HTMLElement) {
  const raw = container.scrollHeight - container.clientHeight - container.scrollTop
  return raw <= DISTANCE_EPSILON ? 0 : raw
}

function getScrollSnapshot(container: HTMLElement): ScrollSnapshot {
  const bottomOffset = getDistanceToBottom(container)
  return {
    clientHeight: container.clientHeight,
    scrollHeight: container.scrollHeight,
    scrollTop: container.scrollTop,
    bottomOffset,
    atBottom: bottomOffset <= DISTANCE_EPSILON,
  }
}

function toListScrollLocation(snapshot: ScrollSnapshot): ListScrollLocation {
  return {
    bottomOffset: snapshot.bottomOffset,
    listOffset: snapshot.scrollTop,
    scrollHeight: snapshot.scrollHeight,
    viewportHeight: snapshot.clientHeight,
  }
}

function updateDistanceToBottom() {
  const container = containerRef.value
  if (!container) return
  distanceToBottom.value = getDistanceToBottom(container)
}

function getAlignOffset(
  container: HTMLElement,
  element: HTMLElement,
  align: ItemLocationWithAlign['align']
) {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const currentTop = container.scrollTop + (elementRect.top - containerRect.top)

  if (align === 'center') {
    return currentTop - (container.clientHeight - elementRect.height) / 2
  }

  if (align === 'end') {
    return currentTop - (container.clientHeight - elementRect.height)
  }

  return currentTop
}

function resolveLocation(location: ItemLocation): ItemLocationWithAlign {
  if (typeof location === 'number' || location === 'LAST') {
    return { index: location, align: 'start', behavior: 'auto' }
  }
  return {
    align: 'start',
    behavior: 'auto',
    ...location,
  }
}

function scrollToAbsolute(top: number, behavior: ScrollBehavior = 'auto') {
  const container = containerRef.value
  if (!container) return

  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
  const nextTop = Math.max(0, Math.min(top, maxTop))

  if (behavior === 'smooth') {
    isSmoothScrolling = true
    if (smoothScrollTimer) clearTimeout(smoothScrollTimer)
    smoothScrollTimer = setTimeout(() => {
      isSmoothScrolling = false
      lastScrollTop = container.scrollTop
      updateDistanceToBottom()
    }, 600)
  }

  isAutoScrolling = behavior !== 'smooth'
  container.scrollTo({ top: nextTop, behavior })

  requestAnimationFrame(() => {
    if (behavior !== 'smooth') {
      isAutoScrolling = false
      lastScrollTop = container.scrollTop
      updateDistanceToBottom()
    }
  })
}

function scrollToBottom(behavior: ScrollBehavior = 'auto', focus = true) {
  const container = containerRef.value
  if (!container) return

  if (focus) {
    userScrolledUp.value = false
    anchorReachedTop.value = false
    anchorBypassed = true
  }

  scrollToAbsolute(container.scrollHeight - container.clientHeight, behavior)
}

function scrollToLocation(location: ItemLocation) {
  const container = containerRef.value
  if (!container || items.value.length === 0) return

  const resolved = resolveLocation(location)
  const index =
    resolved.index === 'LAST' ? Math.max(0, items.value.length - 1) : resolved.index

  if (index < 0 || index >= items.value.length) return

  const item = items.value[index]
  const key = getItemKeyValue(item, index)
  const element = itemElements.get(key)
  if (!element) return

  scrollToAbsolute(
    getAlignOffset(container, element, resolved.align),
    resolved.behavior ?? 'auto'
  )
}

function scrollToMessage(messageId: string) {
  const container = containerRef.value
  if (!container) return

  const element = container.querySelector(
    `[data-chat-message-id="${messageId}"]`
  ) as HTMLElement | null
  if (!element) return

  scrollToAbsolute(getAlignOffset(container, element, 'start'), 'smooth')
}

function maybeClampScrollAfterResize() {
  const container = containerRef.value
  if (!container) return
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
  if (container.scrollTop > maxTop) {
    container.scrollTop = maxTop
  }
}

function maybeStopAtAnchorBeforeBottom() {
  const container = containerRef.value
  if (!container || !props.anchorMessageId || anchorBypassed) return false

  const anchorEl = container.querySelector(
    `[data-chat-anchor-id="${props.anchorMessageId}"]`
  ) as HTMLElement | null
  if (!anchorEl || container.scrollHeight <= container.clientHeight) return false

  const containerRect = container.getBoundingClientRect()
  const anchorRect = anchorEl.getBoundingClientRect()
  const maxScrollTop = container.scrollHeight - container.clientHeight
  const scrollDelta = maxScrollTop - container.scrollTop
  const futureAnchorTop = anchorRect.top - scrollDelta

  if (futureAnchorTop - containerRect.top <= DISTANCE_EPSILON) {
    const targetScrollTop = Math.max(
      0,
      container.scrollTop + (anchorRect.top - containerRect.top)
    )

    if (Math.abs(container.scrollTop - targetScrollTop) > 1) {
      scrollToAbsolute(targetScrollTop, 'auto')
    }

    anchorReachedTop.value = true
    return true
  }

  return false
}

function shouldFollowOutput(snapshot: ScrollSnapshot) {
  if (userScrolledUp.value) return false
  if (anchorReachedTop.value && !anchorBypassed) return false
  return snapshot.atBottom || isSmoothScrolling || isAutoScrolling
}

function applyAutoScrollDecision(
  decision: boolean | ScrollBehavior | ItemLocation,
  focus: boolean
) {
  if (decision === false) return

  if (typeof decision === 'boolean') {
    if (decision) {
      if (!maybeStopAtAnchorBeforeBottom()) {
        scrollToBottom('auto', focus)
      }
    }
    return
  }

  if (decision === 'auto' || decision === 'smooth' || decision === 'instant') {
    if (!maybeStopAtAnchorBeforeBottom()) {
      scrollToBottom(decision, focus)
    }
    return
  }

  scrollToLocation(decision)
}

function resolveAutoScrollDecision(
  autoScroll: AutoScrollToBottom<any> | undefined,
  snapshot: ScrollSnapshot,
  nextState: ChatItemsState<any>
) {
  if (!autoScroll) {
    return shouldFollowOutput(snapshot) ? 'auto' : false
  }

  if (typeof autoScroll === 'function') {
    const params: AutoScrollToBottomParams<any> = {
      atBottom: snapshot.atBottom,
      data: nextState.data,
      scrollInProgress: isSmoothScrolling || isAutoScrolling,
      scrollLocation: toListScrollLocation(snapshot),
    }
    return autoScroll(params)
  }

  if (typeof autoScroll === 'boolean') {
    return autoScroll && shouldFollowOutput(snapshot)
  }

  if (autoScroll === 'auto' || autoScroll === 'smooth' || autoScroll === 'instant') {
    return shouldFollowOutput(snapshot) ? autoScroll : false
  }

  return autoScroll
}

const detectFullScreenMessage = throttle(() => {
  const container = containerRef.value
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const wrappers = container.querySelectorAll('[data-chat-message-id]')
  let found: string | null = null

  for (const element of wrappers) {
    const rect = (element as HTMLElement).getBoundingClientRect()
    if (rect.top < containerRect.top - 30 && rect.bottom >= containerRect.bottom - 20) {
      found = (element as HTMLElement).dataset.chatMessageId || null
      break
    }
  }

  fullScreenMessageId.value = found
}, 30)

function preserveResizeAroundViewport(entries: ResizeObserverEntry[]) {
  const container = containerRef.value
  if (!container) return

  const before = getScrollSnapshot(container)
  let deltaAboveViewport = 0
  let changed = false

  for (const entry of entries) {
    const target = entry.target as HTMLElement
    const key = target.dataset.chatItemKey
    if (!key) continue

    const previousHeight = itemHeights.get(key) ?? target.offsetHeight
    const nextHeight = entry.contentRect.height
    const delta = nextHeight - previousHeight

    itemHeights.set(key, nextHeight)

    if (Math.abs(delta) < 0.5) continue
    changed = true

    const topInContent =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop

    if (topInContent + previousHeight <= before.scrollTop + DISTANCE_EPSILON) {
      deltaAboveViewport += delta
    }
  }

  if (!changed) return

  if (!before.atBottom && !userScrolledUp.value && deltaAboveViewport !== 0) {
    container.scrollTop += deltaAboveViewport
  } else if (deltaAboveViewport !== 0 && userScrolledUp.value) {
    container.scrollTop += deltaAboveViewport
  }

  maybeClampScrollAfterResize()
  updateDistanceToBottom()

  if (before.atBottom || isSmoothScrolling || isAutoScrolling) {
    if (!maybeStopAtAnchorBeforeBottom()) {
      scrollToBottom('auto', false)
    }
  }

  detectFullScreenMessage()
}

function setItemElement(
  key: string,
  el: Element | ComponentPublicInstance | null
) {
  const previous = itemElements.get(key)
  if (previous && itemResizeObserver) {
    itemResizeObserver.unobserve(previous)
  }

  if (el instanceof HTMLElement) {
    itemElements.set(key, el)
    el.dataset.chatItemKey = key
    itemHeights.set(key, el.offsetHeight)
    itemResizeObserver?.observe(el)
    return
  }

  itemElements.delete(key)
  itemHeights.delete(key)
}

function onScroll() {
  const container = containerRef.value
  if (!container) return

  updateDistanceToBottom()

  if (!isAutoScrolling) {
    if (!isSmoothScrolling && container.scrollTop < lastScrollTop - 5) {
      userScrolledUp.value = true
    }

    if (distanceToBottom.value < BOTTOM_RESET_THRESHOLD) {
      userScrolledUp.value = false
      anchorReachedTop.value = false
    }
  }

  lastScrollTop = container.scrollTop
  onPullScroll()
  detectFullScreenMessage()
}

function onScrollToTop() {
  if (fullScreenMessageId.value) {
    scrollToMessage(fullScreenMessageId.value)
  }
}

function onScrollToBottom() {
  scrollToBottom('smooth', true)
}

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

function hasPrependShape(
  previousData: ChatItem[],
  nextData: ChatItem[]
) {
  if (previousData.length === 0 || nextData.length <= previousData.length) return false

  const offset = nextData.length - previousData.length
  return previousData.every((item, index) => {
    const prevKey = getItemKeyValue(item, index)
    const nextKey = getItemKeyValue(nextData[index + offset], index + offset)
    return prevKey === nextKey
  })
}

function applyModifier(
  modifier: ScrollModifier<any>,
  previousState: ChatItemsState<any>,
  nextState: ChatItemsState<any>,
  snapshot: ScrollSnapshot
) {
  const container = containerRef.value
  if (!container) return

  if (!modifier) {
    updateDistanceToBottom()
    detectFullScreenMessage()
    return
  }

  if (typeof modifier === 'string') {
    if (modifier === 'prepend') {
      if (hasPrependShape(previousState.data, nextState.data)) {
        const delta = container.scrollHeight - snapshot.scrollHeight
        container.scrollTop = snapshot.scrollTop + delta
      } else {
        container.scrollTop = 0
      }
    } else if (modifier === 'remove-from-start') {
      const delta = snapshot.scrollHeight - container.scrollHeight
      container.scrollTop = Math.max(0, snapshot.scrollTop - delta)
    } else if (modifier === 'remove-from-end') {
      maybeClampScrollAfterResize()
    }

    updateDistanceToBottom()
    detectFullScreenMessage()
    return
  }

  if (modifier.type === 'item-location') {
    if (modifier.purgeItemSizes) {
      itemHeights.clear()
    }
    scrollToLocation(modifier.location)
    detectFullScreenMessage()
    return
  }

  if (modifier.type === 'auto-scroll-to-bottom') {
    const decision = resolveAutoScrollDecision(modifier.autoScroll, snapshot, nextState)
    applyAutoScrollDecision(decision, false)
    detectFullScreenMessage()
    return
  }

  if (modifier.type === 'items-change') {
    const behavior = modifier.behavior ?? DEFAULT_ITEM_CHANGE_BEHAVIOR

    if (!shouldFollowOutput(snapshot)) {
      updateDistanceToBottom()
      detectFullScreenMessage()
      return
    }

    if (typeof behavior === 'string') {
      if (!maybeStopAtAnchorBeforeBottom()) {
        scrollToBottom(behavior, false)
      }
      detectFullScreenMessage()
      return
    }

    const location = behavior.location()
    if (location) {
      scrollToLocation(location)
    } else if (!maybeStopAtAnchorBeforeBottom()) {
      scrollToBottom('auto', false)
    }

    detectFullScreenMessage()
  }
}

watch(
  () => props.loading,
  (value) => {
    if (!value) {
      resetPull()
    }
  }
)

watch(
  () => props.anchorMessageId,
  (nextId, previousId) => {
    if (nextId && nextId !== previousId) {
      anchorReachedTop.value = false
      userScrolledUp.value = false
      anchorBypassed = false
    }
  }
)

watch(
  () => props.state,
  (nextState, previousState) => {
    const container = containerRef.value
    const snapshot = container ? getScrollSnapshot(container) : null

    nextTick(() => {
      if (!snapshot) return
      applyModifier(
        nextState.scrollModifier,
        previousState ?? { data: [] },
        nextState,
        snapshot
      )
    })
  },
  { deep: false }
)

onMounted(() => {
  itemResizeObserver = new ResizeObserver((entries) => {
    preserveResizeAroundViewport(entries)
  })

  nextTick(() => {
    const container = containerRef.value
    if (!container) return
    lastScrollTop = container.scrollTop
    updateDistanceToBottom()
    detectFullScreenMessage()
  })
})

onUnmounted(() => {
  itemResizeObserver?.disconnect()
  itemResizeObserver = null

  if (smoothScrollTimer) clearTimeout(smoothScrollTimer)
})

defineExpose({
  scrollToBottom: (smooth = true) => scrollToBottom(smooth ? 'smooth' : 'auto', true),
  scrollToMessage,
})
</script>

<template>
  <div class="chat-items-scroll-wrapper">
    <div
      v-if="isMobile"
      class="chat-items-pull-indicator"
      :style="{ height: pullDistance + 'px', opacity: pullDistance > 0 ? 1 : 0 }"
    >
      <div class="chat-items-pull-indicator-content">
        <span v-if="loading" class="chat-items-spinner" />
        <span v-else-if="pullTriggered">释放加载</span>
        <span v-else>下拉加载更多</span>
      </div>
    </div>

    <div ref="containerRef" class="chat-items-scroll-container" @scroll="onScroll">
      <div v-if="!isMobile && loading && hasMore" class="chat-items-top-loading">
        <span class="chat-items-spinner" />
        <span>加载中...</span>
      </div>

      <div class="chat-items-scroll-content">
        <div
          v-for="(item, index) in items"
          :key="getItemKeyValue(item, index)"
          :ref="(el) => setItemElement(getItemKeyValue(item, index), el)"
          class="chat-items-scroll-item"
          :data-chat-anchor-id="getAnchorId?.(item, index) ?? undefined"
          :data-chat-message-id="getMessageId?.(item, index) ?? undefined"
        >
          <slot name="item" :item="item" :index="index" />
        </div>
        <div class="chat-items-scroll-bottom-spacer" aria-hidden="true" />
      </div>
    </div>

    <Transition name="chat-items-fade">
      <button
        v-if="fullScreenMessageId"
        class="chat-items-scroll-btn chat-items-scroll-to-top-btn"
        title="回到消息顶部"
        @click="onScrollToTop"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </Transition>

    <Transition name="chat-items-fade">
      <button
        v-if="showScrollToBottom"
        class="chat-items-scroll-btn chat-items-scroll-to-bottom-btn"
        :title="isStreaming ? 'AI 输出中，点击回到底部' : '回到底部'"
        @click="onScrollToBottom"
      >
        <span v-if="isStreaming" class="chat-items-btn-spinner-ring" />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </Transition>
  </div>
</template>

<style>
@import './chat-items-scroll.css';
</style>
