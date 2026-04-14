import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface UsePullToLoadOptions {
  containerRef: Ref<HTMLElement | null>
  loading: Ref<boolean>
  hasMore: Ref<boolean>
  onLoadMore: () => void
}

export function usePullToLoad({
  containerRef,
  loading,
  hasMore,
  onLoadMore,
}: UsePullToLoadOptions) {
  const isMobile = ref(false)
  const pullDistance = ref(0)
  const isPulling = ref(false)
  const pullTriggered = ref(false)

  const PULL_THRESHOLD = 60
  const DAMPING = 0.4

  let touchStartY = 0
  let loadMoreFired = false

  function detectMobile() {
    isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  function onTouchStart(e: TouchEvent) {
    const container = containerRef.value
    if (!container || loading.value || !hasMore.value) return
    touchStartY = e.touches[0].clientY
  }

  function onTouchMove(e: TouchEvent) {
    const container = containerRef.value
    if (!container || loading.value || !hasMore.value) return

    const diff = e.touches[0].clientY - touchStartY
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
      pullDistance.value = PULL_THRESHOLD
      onLoadMore()
    } else {
      pullDistance.value = 0
    }

    isPulling.value = false
    pullTriggered.value = false
  }

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
      loadMoreFired = false
    }
  }

  function resetPull() {
    pullDistance.value = 0
  }

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
