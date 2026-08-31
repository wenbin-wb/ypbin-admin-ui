import type { AiApi } from './types';

import { requestClient } from '#/api/request';

// 对话角色（新引擎）
export function getRoleList() {
  return requestClient.get<AiApi.ChatRole[]>('/ai/roles');
}

export function createRole(data: AiApi.ChatRoleSaveReq) {
  return requestClient.post<string>('/ai/roles', data);
}

export function updateRole(id: string, data: AiApi.ChatRoleSaveReq) {
  return requestClient.put(`/ai/roles/${id}`, data);
}

export function deleteRole(id: string) {
  return requestClient.delete(`/ai/roles/${id}`);
}

export function toggleRoleFavorite(id: string) {
  return requestClient.put(`/ai/roles/${id}/favorite`);
}
