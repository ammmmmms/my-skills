/**
 * ChatScroll 组件 Props
 */
export interface ChatScrollProps {
  /** 是否正在加载历史消息 */
  loading?: boolean
  /** 是否还有更多历史消息可加载 */
  hasMore?: boolean
  /** 当前正在流式输出的消息 ID，null 表示没有流式输出 */
  streamingMessageId?: string | null
  /** 锚定的用户问题消息 ID，当该消息滚到容器顶部时停止自动滚动 */
  anchorMessageId?: string | null
}

/**
 * ChatScroll 组件 Events
 */
export interface ChatScrollEmits {
  /** 需要加载更多历史消息时触发 */
  (e: 'load-more'): void
}

/**
 * ChatScroll 组件暴露的方法（通过 ref 调用）
 */
export interface ChatScrollExpose {
  /** 滚动到底部，smooth 控制是否平滑滚动 */
  scrollToBottom: (smooth?: boolean) => void
  /** 滚动到指定 AI 消息的顶部（需要消息元素有 data-message-ai-id 属性） */
  scrollToMessage: (messageId: string) => void
}
