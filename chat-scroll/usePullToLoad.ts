import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface UsePullToLoadOptions {
  /** 滚动容器的 ref */
  containerRef: Ref<HTMLElement | null>
  /** 是否正在加载 */
  loading: Ref<boolean>
  /** 是否还有更多数据 */
  hasMore: Ref<boolean>
  /** 触发加载的回调 */
  onLoadMore: () => void
}

/**
 * 下拉加载逻辑
 *
 * - 移动端：touch 弹性下拉，松手后触发加载（类似原生 App 体验）
 * - PC 端：滚动到顶部附近（<50px）自动触发加载，显示 loading spinner
 */
export function usePullToLoad({
  containerRef,
  loading,
  hasMore,
  onLoadMore,
}: UsePullToLoadOptions) {
  const isMobile = ref(false)
  /** 下拉距离（px），用于移动端弹性动画 */
  const pullDistance = ref(0)
  /** 是否正在下拉中 */
  const isPulling = ref(false)
  /** 下拉距离是否已超过阈值（松手即触发加载） */
  const pullTriggered = ref(false)

  /** 触发加载的下拉距离阈值（px） */
  const PULL_THRESHOLD = 60
  /** 下拉阻尼系数，越小越难拉 */
  const DAMPING = 0.4

  let touchStartY = 0

  function detectMobile() {
    isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  // ====== 移动端 touch 弹性下拉 ======

  function onTouchStart(e: TouchEvent) {
    const container = containerRef.value
    if (!container || loading.value || !hasMore.value) return
    touchStartY = e.touches[0].clientY
  }

  function onTouchMove(e: TouchEvent) {
    const container = containerRef.value
    if (!container || loading.value || !hasMore.value) return

    const diff = e.touches[0].clientY - touchStartY

    // 只有已滚到顶部且向下拉时才触发弹性效果
    if (container.scrollTop <= 0 && diff > 0) {
      isPulling.value = true
      pullDistance.value = Math.max(0, diff * DAMPING)
      pullTriggered.value = pullDistance.value > PULL_THRESHOLD
      if (pullDistance.value > 0) e.preventDefault()
    }
  }

  function onTouchEnd() {
    if (!isPulling.value) return

    if (pullTriggered.value && hasMore.value && !loading.value) {
      pullDistance.value = PULL_THRESHOLD // 保持在阈值位置显示 loading
      onLoadMore()
    } else {
      pullDistance.value = 0
    }

    isPulling.value = false
    pullTriggered.value = false
  }

  // ====== PC 端滚到顶部自动加载 ======

  /** 防止 scroll 期间重复触发 onLoadMore */
  let loadMoreFired = false

  function onScroll() {
    if (isMobile.value) return
    const container = containerRef.value
    if (!container || loading.value || !hasMore.value) return

    if (container.scrollTop < 50) {
      if (!loadMoreFired) {
        loadMoreFired = true
        onLoadMore()
      }
    } else {
      // 滚离顶部后重置，下次再到顶可以再触发
      loadMoreFired = false
    }
  }

  /** 加载完成后调用，重置下拉距离 */
  function resetPull() {
    pullDistance.value = 0
  }

  // ====== 生命周期 ======

  onMounted(() => {
    detectMobile()
    const container = containerRef.value
    if (!container || !isMobile.value) return

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    const container = containerRef.value
    if (!container) return
    container.removeEventListener('touchstart', onTouchStart)
    container.removeEventListener('touchmove', onTouchMove)
    container.removeEventListener('touchend', onTouchEnd)
  })

  return {
    isMobile,
    pullDistance,
    isPulling,
    pullTriggered,
    onScroll,
    resetPull,
  }
}
