import type { AiApi } from './types';

import { requestClient } from '#/api/request';

// 会话管理（新引擎）
/** 重新生成等待模型输出的上限：远超实例默认 10s 请求超时（AI 生成耗时不可控） */
const REGENERATE_TIMEOUT_MS = 120_000;

export function getSessionList() {
  return requestClient.get<AiApi.ChatSession[]>('/ai/chat/sessions');
}

export function createSession(data?: {
  modelId?: string;
  roleId?: string;
  title?: string;
}) {
  return requestClient.post<string>('/ai/chat/sessions', data ?? {});
}

export function deleteSession(id: string) {
  return requestClient.delete(`/ai/chat/sessions/${id}`);
}

export function getSessionMessages(id: string) {
  return requestClient.get<AiApi.ChatMessage[]>(
    `/ai/chat/sessions/${id}/messages`,
  );
}

/**
 * 重新生成会话最后一条 AI 回复。
 *
 * 后端语义：删除最后一条助手回复，以最后一条用户消息重新生成并落库，返回新消息；
 * 前端调用后需重新拉取消息列表保持一致。
 */
export function regenerateSessionMessage(id: string) {
  return requestClient.post<AiApi.ChatMessage>(
    `/ai/chat/sessions/${id}/regenerate`,
    null,
    { timeout: REGENERATE_TIMEOUT_MS },
  );
}

export function updateSessionTitle(id: string, title: string) {
  return requestClient.put(`/ai/chat/sessions/${id}/title`, null, {
    params: { title },
  });
}

export function toggleSessionPin(id: string) {
  return requestClient.put(`/ai/chat/sessions/${id}/pin`);
}
