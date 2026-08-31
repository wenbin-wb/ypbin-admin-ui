import type { AiApi } from './types';

import { requestClient } from '#/api/request';

// 会话管理（新引擎）
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

export function updateSessionTitle(id: string, title: string) {
  return requestClient.put(`/ai/chat/sessions/${id}/title`, null, {
    params: { title },
  });
}

export function toggleSessionPin(id: string) {
  return requestClient.put(`/ai/chat/sessions/${id}/pin`);
}
