import { ref, watch, nextTick, onMounted, onUnmounted, type Ref } from 'vue'

interface UseAutoScrollOptions {
  /** 滚动容器的 ref */
  containerRef: Ref<HTMLElement | null>
  /** 当前正在流式输出的消息 ID */
  streamingMessageId: Ref<string | null | undefined>
  /** 锚定的用户问题消息 ID */
  anchorMessageId: Ref<string | null | undefined>
  /** 容器内容变化时的回调（DOM 变化时触发） */
  onContentChange?: () => void
}

/**
 * 自动滚动 + 智能锚定逻辑
 *
 * 核心行为：
 * 1. 常驻 MutationObserver 监听容器内容变化，用户在底部时自动滚底
 * 2. 流式输出时（streamingMessageId 有值），启用锚定检查
 * 3. 当 anchorMessageId 对应的消息滚到容器顶部时，停止自动滚动（锚定）
 * 4. 用户手动上滑时，停止自动滚动
 * 5. 用户点击"到底"按钮后，本轮流式跳过锚定检查，持续滚到底
 */
export function useAutoScroll({
  containerRef,
  streamingMessageId,
  anchorMessageId,
  onContentChange,
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
  /** 标记 smooth scroll 进行中，期间不判定用户上滑 */
  let isSmoothScrolling = false
  let smoothScrollTimer: ReturnType<typeof setTimeout> | null = null

  /** 是否正在流式输出 */
  function isStreaming(): boolean {
    return !!streamingMessageId.value
  }

  /** 执行自动滚动到底部 */
  function autoScrollToBottom() {
    const container = containerRef.value
    if (!container) return

    if (userScrolledUp.value) return

    // 锚定检查（未 bypass 时）：预判滚底后锚点是否会超出容器顶部
    if (!anchorBypassed && anchorMessageId.value) {
      const anchorEl = container.querySelector(
        `[data-message-user-id="${anchorMessageId.value}"]`
      ) as HTMLElement | null
      if (anchorEl && container.scrollHeight > container.clientHeight) {
        const containerRect = container.getBoundingClientRect()
        const anchorRect = anchorEl.getBoundingClientRect()
        const maxScrollTop = container.scrollHeight - container.clientHeight
        const scrollDelta = maxScrollTop - container.scrollTop
        // 滚底后锚点相对容器顶部的位置
        const futureAnchorTop = anchorRect.top - scrollDelta
        if (futureAnchorTop <= containerRect.top + 2) {
          // 改为滚到锚点对齐容器顶部
          const targetScrollTop = container.scrollTop + (anchorRect.top - containerRect.top)
          if (Math.abs(container.scrollTop - targetScrollTop) > 1) {
            isAutoScrolling = true
            container.scrollTop = targetScrollTop
            requestAnimationFrame(() => {
              isAutoScrolling = false
              lastScrollTop = container.scrollTop
            })
          }
          anchorReachedTop.value = true
          return
        }
      }
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

    // smooth scroll 进行中不判定为用户上滑
    if (!isSmoothScrolling && scrollTop < lastScrollTop - 5) {
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
      isSmoothScrolling = true
      if (smoothScrollTimer) clearTimeout(smoothScrollTimer)
      smoothScrollTimer = setTimeout(() => {
        isSmoothScrolling = false
        lastScrollTop = container.scrollTop
      }, 600)

      container.scrollTo({
        top: container.scrollHeight - container.clientHeight,
        behavior: 'smooth',
      })
    } else {
      container.scrollTop = container.scrollHeight - container.clientHeight
      lastScrollTop = container.scrollTop
    }
  }

  /** 滚动到指定消息的顶部对齐容器顶部 */
  function scrollToMessage(messageId: string) {
    const container = containerRef.value
    if (!container) return

    const el = container.querySelector(
      `[data-message-ai-id="${messageId}"]`
    ) as HTMLElement | null
    if (!el) return

    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const offset = elRect.top - containerRect.top

    isSmoothScrolling = true
    if (smoothScrollTimer) clearTimeout(smoothScrollTimer)
    smoothScrollTimer = setTimeout(() => {
      isSmoothScrolling = false
      lastScrollTop = container.scrollTop
    }, 600)

    container.scrollTo({
      top: container.scrollTop + offset,
      behavior: 'smooth',
    })
  }

  // ====== 常驻 MutationObserver ======
  let observer: MutationObserver | null = null

  function startObserver() {
    const container = containerRef.value
    if (!container || observer) return

    observer = new MutationObserver(() => {
      if (!anchorReachedTop.value || anchorBypassed) {
        // 非流式场景：内容一次性插入，直接检查滚底后锚点是否会超出顶部
        // 如果会，改为滚到锚点对齐位置
        if (!isStreaming() && !anchorBypassed && anchorMessageId.value) {
          const container = containerRef.value
          if (container && !userScrolledUp.value) {
            const anchorEl = container.querySelector(
              `[data-message-user-id="${anchorMessageId.value}"]`
            ) as HTMLElement | null
            if (anchorEl && container.scrollHeight > container.clientHeight) {
              const containerRect = container.getBoundingClientRect()
              const anchorRect = anchorEl.getBoundingClientRect()
              // 计算滚底后锚点的位置：滚底会让 scrollTop 增加 (scrollHeight - clientHeight - scrollTop)
              const maxScrollTop = container.scrollHeight - container.clientHeight
              const futureAnchorTop = anchorRect.top - (maxScrollTop - container.scrollTop)
              if (futureAnchorTop <= containerRect.top + 2) {
                // 滚底会让锚点超出顶部，改为滚到锚点对齐
                isAutoScrolling = true
                container.scrollTop = container.scrollTop + (anchorRect.top - containerRect.top)
                requestAnimationFrame(() => {
                  isAutoScrolling = false
                  lastScrollTop = container.scrollTop
                })
                anchorReachedTop.value = true
                onContentChange?.()
                return
              }
            }
          }
        }
        autoScrollToBottom()
      }
      onContentChange?.()
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  function stopObserver() {
    observer?.disconnect()
    observer = null
  }

  // 容器挂载后启动 observer
  onMounted(() => {
    nextTick(startObserver)
  })

  // anchorMessageId 变化（新一轮对话开始），重置锚定状态（流式和非流式均适用）
  watch(anchorMessageId, (newId, oldId) => {
    if (newId && newId !== oldId) {
      anchorReachedTop.value = false
      userScrolledUp.value = false
      anchorBypassed = false
    }
  })

  // 组件卸载时清理
  onUnmounted(() => {
    stopObserver()
    if (smoothScrollTimer) clearTimeout(smoothScrollTimer)
  })

  return {
    userScrolledUp,
    anchorReachedTop,
    onScroll,
    scrollToBottom,
    scrollToMessage,
  }
}
