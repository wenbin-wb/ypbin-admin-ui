import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

export namespace AiApi {
  export interface Conversation {
    id: string;
    modelId?: string;
    title: string;
    createTime: string;
    updateTime: string;
  }

  export interface Message {
    id: string;
    conversationId: string;
    role: 'assistant' | 'user';
    content: string;
    tokens: number;
    createTime: string;
  }

  export interface ChatReq {
    conversationId?: string;
    message: string;
    knowledgeBaseId?: string;
    promptTemplateId?: string;
  }

  export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    baseUrl?: string;
    modelName: string;
    isDefault: number;
    status: number;
    remark?: string;
    apiKeyMasked?: string;
    createTime: string;
  }

  export interface ModelConfigSaveReq {
    name: string;
    provider: string;
    apiKey?: string;
    baseUrl?: string;
    modelName: string;
    remark?: string;
  }

  export interface KnowledgeBase {
    id: string;
    name: string;
    description?: string;
    docCount: number;
    status: number;
    createTime: string;
  }

  export interface KnowledgeBaseSaveReq {
    name: string;
    description?: string;
    remark?: string;
  }

  export interface KbDocument {
    id: string;
    knowledgeBaseId: string;
    filename: string;
    fileSize: number;
    chunkCount: number;
    status: number; // 0处理中 1就绪 2失败
    errorMsg?: string;
    createTime: string;
  }
  export interface PromptTemplate {
    id: string;
    name: string;
    category?: string;
    template: string;
    description?: string;
    status: number;
    createTime: string;
  }

  export interface PromptTemplateSaveReq {
    name: string;
    category?: string;
    template: string;
    description?: string;
  }
}
export function listConversations() {
  return requestClient.get<AiApi.Conversation[]>('/ai/chat/conversations');
}

export function createConversation(modelId?: string) {
  return requestClient.post<AiApi.Conversation>(
    '/ai/chat/conversations',
    null,
    {
      params: { modelId },
    },
  );
}

export function deleteConversation(id: string) {
  return requestClient.delete(`/ai/chat/conversations/${id}`);
}

export function renameConversation(id: string, title: string) {
  return requestClient.put(`/ai/chat/conversations/${id}/title`, { title });
}

export function listMessages(
  conversationId: string,
  params?: Record<string, any>,
) {
  return requestClient.get<{ items: AiApi.Message[]; total: number }>(
    `/ai/chat/conversations/${conversationId}/messages`,
    { params },
  );
}

/**
 * 流式对话（SSE）。vben 的 postSSE 只做原始分块转发、不解析 SSE 帧，
 * 这里直接用 fetch 按标准 SSE 帧格式解析（剥离 data: 前缀），支持 AbortController 中断。
 */
export async function chat(
  data: AiApi.ChatReq,
  onMessage: (token: string) => void,
  onEnd?: () => void,
  signal?: AbortSignal,
) {
  const accessStore = useAccessStore();
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const response = await fetch(apiURL + '/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessStore.accessToken,
    },
    body: JSON.stringify(data),
    signal,
  });
  if (!response.ok) {
    throw new Error('HTTP error! status: ' + response.status);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    // SSE 帧以空行分隔；一帧可能跨多个 chunk，缓冲后统一切分
    let sep = buffer.indexOf('\n\n');
    while (sep >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5));
      if (dataLines.length > 0) {
        onMessage(dataLines.join('\n'));
      }
      sep = buffer.indexOf('\n\n');
    }
  }
  onEnd?.();
}

// 知识库
export function listKnowledgeBases() {
  return requestClient.get<AiApi.KnowledgeBase[]>('/ai/knowledge-bases');
}

export function createKnowledgeBase(data: AiApi.KnowledgeBaseSaveReq) {
  return requestClient.post<AiApi.KnowledgeBase>('/ai/knowledge-bases', data);
}

export function deleteKnowledgeBase(id: string) {
  return requestClient.delete(`/ai/knowledge-bases/${id}`);
}

export function listDocuments(kbId: string, params?: Record<string, any>) {
  return requestClient.get<{ items: AiApi.KbDocument[]; total: number }>(
    `/ai/knowledge-bases/${kbId}/documents`,
    { params },
  );
}

export function deleteDocument(kbId: string, docId: string) {
  return requestClient.delete(`/ai/knowledge-bases/${kbId}/documents/${docId}`);
}

export function queryKnowledgeBase(kbId: string, question: string) {
  return requestClient.post<string>(`/ai/knowledge-bases/${kbId}/query`, {
    question,
  });
}

// 模型配置
export function listModels() {
  return requestClient.get<AiApi.ModelConfig[]>('/ai/models');
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

export function testModel(id: string) {
  return requestClient.post<{ latencyMs: number }>(`/ai/models/${id}/test`);
}

// Prompt 模板
export function listPromptTemplates() {
  return requestClient.get<AiApi.PromptTemplate[]>('/ai/prompt-templates');
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

// 用量统计
export function getUsageSummary() {
  return requestClient.get<{
    avgLatencyMs: number;
    totalCalls: number;
    totalTokens: number;
  }>('/ai/usage/summary');
}

export function getDailyUsage(params?: {
  endDate?: string;
  startDate?: string;
}) {
  return requestClient.get<Array<{ date: string; tokens: number }>>(
    '/ai/usage/daily',
    { params },
  );
}

export function getUsageByModel() {
  return requestClient.get<Array<{ model: string; tokens: number }>>(
    '/ai/usage/by-model',
  );
}
