import { ref, watch, nextTick, type Ref } from 'vue'

interface UseAutoScrollOptions {
  /** 滚动容器的 ref */
  containerRef: Ref<HTMLElement | null>
  /** 当前正在流式输出的消息 ID */
  streamingMessageId: Ref<string | null | undefined>
  /** 锚定的用户问题消息 ID */
  anchorMessageId: Ref<string | null | undefined>
}

/**
 * 自动滚动 + 智能锚定逻辑
 *
 * 核心行为：
 * 1. AI 流式输出时，通过 MutationObserver 监听内容变化，自动滚到底部
 * 2. 当 anchorMessageId 对应的消息滚到容器顶部时，停止自动滚动（锚定）
 * 3. 用户手动上滑时，停止自动滚动
 * 4. 用户点击"到底"按钮后，本轮流式跳过锚定检查，持续滚到底
 */
export function useAutoScroll({
  containerRef,
  streamingMessageId,
  anchorMessageId,
}: UseAutoScrollOptions) {
  /** 用户是否主动上滑（手动接管了滚动） */
  const userScrolledUp = ref(false)
  /** 锚定消息是否已到达容器顶部 */
  const anchorReachedTop = ref(false)
  /** 用户点击了到底按钮，本轮流式输出跳过锚定检查 */
  let anchorBypassed = false

  let lastScrollTop = 0
  /** 标记当前滚动是程序触发的，避免 scroll 事件误判为用户行为 */
  let isAutoScrolling = false

  /**
   * 检查锚定消息是否已到达容器顶部
   * 条件：容器可滚动 + 锚定消息的 top <= 容器 top
   */
  function checkAnchorPosition(): boolean {
    const container = containerRef.value
    if (!container || !anchorMessageId.value) return false

    const anchorEl = container.querySelector(
      `[data-message-id="${anchorMessageId.value}"]`
    ) as HTMLElement | null
    if (!anchorEl) return false

    // 内容未溢出（不可滚动）时不触发锚定
    if (container.scrollHeight <= container.clientHeight) return false

    const containerRect = container.getBoundingClientRect()
    const anchorRect = anchorEl.getBoundingClientRect()

    return anchorRect.top <= containerRect.top + 2 // 2px 容差
  }

  /** 执行自动滚动到底部 */
  function autoScrollToBottom() {
    const container = containerRef.value
    if (!container) return

    if (userScrolledUp.value) return

    // 锚定检查（bypass 时跳过）
    if (!anchorBypassed && checkAnchorPosition()) {
      anchorReachedTop.value = true
      return
    }

    isAutoScrolling = true
    container.scrollTop = container.scrollHeight - container.clientHeight
    requestAnimationFrame(() => {
      isAutoScrolling = false
      lastScrollTop = container.scrollTop
    })
  }

  /** 处理 scroll 事件 — 检测用户手动上滑 / 回到底部 */
  function onScroll() {
    const container = containerRef.value
    if (!container || isAutoScrolling) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceToBottom = scrollHeight - scrollTop - clientHeight

    // 用户向上滚动超过 5px 判定为手动上滑
    if (scrollTop < lastScrollTop - 5) {
      userScrolledUp.value = true
    }

    // 用户手动滚到接近底部（<30px），恢复自动滚动状态
    if (distanceToBottom < 30) {
      userScrolledUp.value = false
      anchorReachedTop.value = false
    }

    lastScrollTop = scrollTop
  }

  /**
   * 手动滚动到底部（用户点击"到底"按钮时调用）
   * 会跳过本轮流式输出的锚定检查
   */
  function scrollToBottom(smooth = true) {
    const container = containerRef.value
    if (!container) return

    userScrolledUp.value = false
    anchorReachedTop.value = false
    anchorBypassed = true

    if (smooth) {
      container.scrollTo({
        top: container.scrollHeight - container.clientHeight,
        behavior: 'smooth',
      })
    } else {
      container.scrollTop = container.scrollHeight - container.clientHeight
    }
    lastScrollTop = container.scrollTop
  }

  /** 滚动到指定消息的顶部对齐容器顶部 */
  function scrollToMessage(messageId: string) {
    const container = containerRef.value
    if (!container) return

    const el = container.querySelector(
      `[data-message-id="${messageId}"]`
    ) as HTMLElement | null
    if (!el) return

    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const offset = elRect.top - containerRect.top

    container.scrollTo({
      top: container.scrollTop + offset,
      behavior: 'smooth',
    })
  }

  // 监听 streamingMessageId 变化，启动/停止 MutationObserver
  let observer: MutationObserver | null = null

  watch(
    streamingMessageId,
    (newId) => {
      observer?.disconnect()

      if (!newId) {
        observer = null
        return
      }

      // 新一轮流式输出开始，重置所有状态
      anchorReachedTop.value = false
      userScrolledUp.value = false
      anchorBypassed = false

      nextTick(() => {
        const container = containerRef.value
        if (!container) return

        autoScrollToBottom()

        // 监听容器内 DOM 变化（流式内容追加），自动滚到底
        observer = new MutationObserver(() => {
          if (!anchorReachedTop.value || anchorBypassed) {
            autoScrollToBottom()
          }
        })

        observer.observe(container, {
          childList: true,
          subtree: true,
          characterData: true,
        })
      })
    },
    { immediate: true }
  )

  return {
    userScrolledUp,
    anchorReachedTop,
    onScroll,
    scrollToBottom,
    scrollToMessage,
  }
}
