import { useMessageStore } from '#/store/message';

/**
 * 兼容既有调用：消息状态与 SSE 生命周期统一由共享 store 管理。
 */
export function useMessages() {
  return useMessageStore();
}
