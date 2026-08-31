import type { AiApi } from './types';

import { requestClient } from '#/api/request';

// 模型配置
/**
 * 查询模型配置列表。
 *
 * @param modelType 模型类型过滤：CHAT 对话 | EMBEDDING 向量化，缺省返回全部
 */
export function getModelList(modelType?: AiApi.ModelType) {
  return requestClient.get<AiApi.ModelConfig[]>('/ai/models', {
    params: modelType ? { modelType } : undefined,
  });
}

export function createModel(data: AiApi.ModelConfigSaveReq) {
  return requestClient.post('/ai/models', data);
}

export function updateModel(id: string, data: AiApi.ModelConfigSaveReq) {
  return requestClient.put(`/ai/models/${id}`, data);
}

export function deleteModel(id: string) {
  return requestClient.delete(`/ai/models/${id}`);
}

export function setDefaultModel(id: string) {
  return requestClient.put(`/ai/models/${id}/default`);
}

export function updateModelStatus(id: string, status: 0 | 1) {
  return requestClient.put(`/ai/models/${id}/status/${status}`);
}

export function duplicateModel(id: string) {
  return requestClient.post(`/ai/models/${id}/duplicate`);
}

export function testModel(id: string) {
  return requestClient.post<{ latencyMs: number }>(`/ai/models/${id}/test`);
}
