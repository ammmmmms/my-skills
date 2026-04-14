export type ScrollAlignment = 'start' | 'center' | 'end'
export type ScrollTargetIndex = number | 'LAST'

export interface ItemLocationWithAlign {
  index: ScrollTargetIndex
  align?: ScrollAlignment
  behavior?: ScrollBehavior
}

export type ItemLocation = ScrollTargetIndex | ItemLocationWithAlign

export interface ListScrollLocation {
  bottomOffset: number
  listOffset: number
  scrollHeight: number
  viewportHeight: number
}

export interface AutoScrollToBottomParams<T = Record<string, unknown>> {
  atBottom: boolean
  data: T[]
  scrollInProgress: boolean
  scrollLocation: ListScrollLocation
}

export type AutoScrollToBottom<T = Record<string, unknown>> =
  | boolean
  | ScrollBehavior
  | ItemLocation
  | ((params: AutoScrollToBottomParams<T>) => boolean | ScrollBehavior | ItemLocation)

export type ItemsChangeBehavior =
  | ScrollBehavior
  | {
      location: () => ItemLocation | null | undefined
    }

export type ScrollModifier<T = Record<string, unknown>> =
  | null
  | undefined
  | {
      type: 'item-location'
      location: ItemLocation
      purgeItemSizes?: boolean
    }
  | {
      type: 'auto-scroll-to-bottom'
      autoScroll?: AutoScrollToBottom<T>
    }
  | {
      type: 'items-change'
      behavior?: ItemsChangeBehavior
    }
  | 'prepend'
  | 'remove-from-start'
  | 'remove-from-end'

export interface ChatItemsState<T = Record<string, unknown>> {
  data: T[]
  scrollModifier?: ScrollModifier<T>
}

export interface ChatItemsScrollProps<T = Record<string, unknown>> {
  state: ChatItemsState<T>
  getItemKey: (item: T, index: number) => string | number
  getAnchorId?: (item: T, index: number) => string | null | undefined
  getMessageId?: (item: T, index: number) => string | null | undefined
  loading?: boolean
  hasMore?: boolean
  isStreaming?: boolean
  anchorMessageId?: string | null
}

export interface ChatItemsScrollEmits {
  (e: 'load-more'): void
}

export interface ChatItemsScrollExpose {
  scrollToBottom: (smooth?: boolean) => void
  scrollToMessage: (messageId: string) => void
}
