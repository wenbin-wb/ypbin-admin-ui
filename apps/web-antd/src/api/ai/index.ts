import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
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

  export type ModelType = 'CHAT' | 'EMBEDDING';

  export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    modelType?: ModelType;
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
    modelType?: ModelType;
    apiKey?: string;
    baseUrl?: string;
    modelName: string;
    remark?: string;
  }

  export interface KnowledgeBase {
    id: string;
    name: string;
    description?: string;
    /** emoji 或图标名，供卡片展示 */
    icon?: string;
    docCount: number;
    createTime: string;
  }

  export interface KnowledgeBaseSaveReq {
    name: string;
    description?: string;
    icon?: string;
    remark?: string;
  }

  export interface KnowledgeBaseUpdateReq {
    name: string;
    description?: string;
    icon?: string;
    remark?: string;
  }

  export interface KbDocument {
    id: string;
    knowledgeBaseId: string;
    filename: string;
    fileSize: number;
    chunkCount: number;
    /** 0 处理中 | 1 就绪 | 2 失败 */
    status: number;
    errorMsg?: string;
    createTime: string;
    updateTime?: string;
    sourceType?: string;
    sourceUrl?: string;
  }

  export interface KbImportReq {
    /** URL / SITEMAP / RSS */
    sourceType: 'RSS' | 'SITEMAP' | 'URL';
    url: string;
    maxUrls?: number;
    customTitle?: string;
  }

  export interface KbSourceFragment {
    source?: string;
    content: string;
    metadata?: Record<string, any>;
  }

  export interface KbQueryResult {
    answer: string;
    sources: KbSourceFragment[];
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

  /** 对话会话（新引擎） */
  export interface ChatSession {
    id: string;
    title: string;
    roleId?: string;
    roleName?: string;
    roleAvatar?: string;
    modelId?: string;
    messageCount: number;
    totalTokens: number;
    isPinned: number;
    lastMessageAt?: string;
    createTime: string;
  }

  /** 对话消息（新引擎） */
  export interface ChatMessage {
    id: string;
    role: 'assistant' | 'system' | 'tool' | 'user';
    content: string;
    tokens?: number;
    modelName?: string;
    finishReason?: string;
    toolCalls?: string;
    images?: string[];
    createTime: string;
  }

  /** 对话角色 */
  export interface ChatRole {
    id: string;
    name: string;
    description?: string;
    avatar?: string;
    category: string;
    modelPreference?: string;
    temperature?: number;
    isBuiltin: number;
    isFavorite: boolean;
    sort: number;
  }

  export interface ChatRoleSaveReq {
    name: string;
    description?: string;
    avatar?: string;
    systemPrompt: string;
    category?: string;
    modelPreference?: string;
    temperature?: number;
  }

  export interface ChatSendReq {
    sessionId?: string;
    roleId?: string;
    modelId?: string;
    content: string;
    images?: string[];
  }
}
export function getConversationList() {
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

export function getMessageList(
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
 * 这里直接用 fetch 按标准 SSE 帧格式解析：
 * - 剥离 data: 前缀，逐帧回调节点后让出一帧渲染（保持视觉流式）；
 * - 识别 event:error 错误帧并交给 onError（后端流式失败时推送）；
 * - 非 SSE 响应（如统一异常 JSON）解析出 message 后抛出，避免静默无输出。
 */
export async function chat(
  data: AiApi.ChatReq,
  onMessage: (token: string) => void,
  onEnd?: () => void,
  signal?: AbortSignal,
  onError?: (error: Error) => void,
) {
  const accessStore = useAccessStore();
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  // 后端统一流式接口 POST /ai/chat/stream，入参 AiChatSendReq（sessionId/content/roleId）
  // ChatReq 的 conversationId→sessionId、message→content、promptTemplateId→roleId 语义对应
  const streamBody = {
    sessionId: data.conversationId,
    content: data.message,
    roleId: data.promptTemplateId,
    knowledgeBaseId: data.knowledgeBaseId,
  };
  const response = await fetch(`${apiURL}/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessStore.accessToken}`,
      'Accept-Language': preferences.app.locale,
    },
    body: JSON.stringify(streamBody),
    signal,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No reader');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let sawFrame = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    // 非 SSE 响应（统一异常 JSON）：解析出业务消息并抛出，避免当成空流
    if (!sawFrame && !contentType.includes('text/event-stream')) {
      try {
        const json = JSON.parse(buffer);
        const message = json?.message || json?.error || '请求失败，请稍后重试';
        throw new Error(String(message));
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          continue;
        }
        throw parseError;
      }
    }
    // SSE 帧以空行分隔；一帧可能跨多个 chunk，缓冲后统一切分
    let sep = buffer.indexOf('\n\n');
    while (sep >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      sawFrame = true;
      const lines = frame.split('\n');
      const eventName = lines
        .find((line) => line.startsWith('event:'))
        ?.slice(6)
        .trim();
      const dataText = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5))
        .join('\n');
      if (eventName === 'error') {
        onError?.(new Error(dataText || '对话出错，请稍后重试'));
      } else if (dataText.length > 0) {
        onMessage(dataText);
        // 等待一帧渲染：同一网络块内的多帧若同步回调，浏览器会把 DOM 更新合并成一次性输出；
        // 附带超时兜底，避免后台标签页 rAF 暂停时流式解析被卡住
        await Promise.race([
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
          new Promise<void>((resolve) => {
            setTimeout(resolve, 100);
          }),
        ]);
      }
      sep = buffer.indexOf('\n\n');
    }
  }
  onEnd?.();
}

// 知识库
export function getKnowledgeBaseList() {
  return requestClient.get<AiApi.KnowledgeBase[]>('/ai/knowledge-bases');
}

export function createKnowledgeBase(data: AiApi.KnowledgeBaseSaveReq) {
  return requestClient.post<AiApi.KnowledgeBase>('/ai/knowledge-bases', data);
}

export function updateKnowledgeBase(
  id: string,
  data: AiApi.KnowledgeBaseUpdateReq,
) {
  return requestClient.put(`/ai/knowledge-bases/${id}`, data);
}

export function deleteKnowledgeBase(id: string) {
  return requestClient.delete(`/ai/knowledge-bases/${id}`);
}

export function getDocumentList(kbId: string, params?: Record<string, any>) {
  return requestClient.get<{ items: AiApi.KbDocument[]; total: number }>(
    `/ai/knowledge-bases/${kbId}/documents`,
    { params },
  );
}

export function retryDocument(kbId: string, docId: string) {
  return requestClient.post(
    `/ai/knowledge-bases/${kbId}/documents/${docId}/retry`,
  );
}

export function deleteDocument(kbId: string, docId: string) {
  return requestClient.delete(`/ai/knowledge-bases/${kbId}/documents/${docId}`);
}

export function importDocumentFromUrl(kbId: string, req: AiApi.KbImportReq) {
  return requestClient.post<AiApi.KbDocument[]>(
    `/ai/knowledge-bases/${kbId}/import-url`,
    req,
  );
}

export async function batchUploadDocuments(kbId: string, files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return requestClient.post<AiApi.KbDocument[]>(
    `/ai/knowledge-bases/${kbId}/documents/batch`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

export function queryKnowledgeBase(kbId: string, question: string) {
  return requestClient.post<string>(`/ai/knowledge-bases/${kbId}/query`, {
    question,
  });
}

export function searchKnowledgeBaseTest(
  kbId: string,
  question: string,
  topK = 5,
) {
  return requestClient.post<
    Array<{ content: string; metadata: Record<string, any>; source?: string }>
  >(`/ai/knowledge-bases/${kbId}/search-test`, {
    question,
    topK,
  });
}

export function searchKnowledgeBaseMultiple(
  kbIds: string[],
  question: string,
  topKPerKb = 5,
) {
  return requestClient.post<
    Array<{ content: string; metadata: Record<string, any>; source?: string }>
  >('/ai/knowledge-bases/search-multiple-test', {
    knowledgeBaseIds: kbIds,
    question,
    topKPerKb,
  });
}

export function searchKnowledgeBaseRerank(
  kbId: string,
  question: string,
  topK = 5,
) {
  return requestClient.post<
    Array<{ content: string; metadata: Record<string, any>; source?: string }>
  >(`/ai/knowledge-bases/${kbId}/search-rerank-test`, {
    question,
    topK,
  });
}

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

// Prompt 模板
export function getPromptTemplateList() {
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

// Wiki 阅读页
export function queryKnowledgeBaseWithSources(kbId: string, question: string) {
  return requestClient.post<AiApi.KbQueryResult>(
    `/ai/knowledge-bases/${kbId}/query-with-sources`,
    { question },
  );
}

export function getDocumentContent(kbId: string, docId: string) {
  return requestClient.get<string>(
    `/ai/knowledge-bases/${kbId}/documents/${docId}/content`,
  );
}
