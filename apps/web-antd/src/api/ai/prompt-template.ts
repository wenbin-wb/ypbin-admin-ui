import type { AiApi } from './types';

import { requestClient } from '#/api/request';

/**
 * 查询 Prompt 模板列表。
 *
 * @param status 状态过滤：1 启用 / 0 停用；缺省由后端默认（仅启用）。
 *   管理端要检索已停用模板并重新启用时须显式传 0。
 */
export function getPromptTemplateList(status?: 0 | 1) {
  return requestClient.get<AiApi.PromptTemplate[]>('/ai/prompt-templates', {
    params: status === undefined ? undefined : { status },
  });
}

export function createPromptTemplate(data: AiApi.PromptTemplateSaveReq) {
  return requestClient.post('/ai/prompt-templates', data);
}

export function updatePromptTemplate(
  id: string,
  data: AiApi.PromptTemplateSaveReq,
) {
  return requestClient.put(`/ai/prompt-templates/${id}`, data);
}

export function deletePromptTemplate(id: string) {
  return requestClient.delete(`/ai/prompt-templates/${id}`);
}

export function togglePromptTemplate(id: string, status: 0 | 1) {
  return requestClient.put(`/ai/prompt-templates/${id}/status/${status}`);
}
