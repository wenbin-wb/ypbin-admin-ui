import type { AiApi } from './types';

import { useAppConfig } from '@vben/hooks';

import { requestClient } from '#/api/request';

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

export function setWidgetEnabled(kbId: string, enabled: boolean) {
  return requestClient.put<string>(`/ai/knowledge-bases/${kbId}/widget`, null, {
    params: { enabled },
  });
}

// 知识库公开分享
export function setShareSetting(kbId: string, req: AiApi.ShareSettingReq) {
  return requestClient.put<string>(`/ai/knowledge-bases/${kbId}/share`, req);
}

/**
 * 公开分享接口（免登录）统一请求。
 * 后端统一响应 HTTP 恒 200，靠 body.code 区分：200 成功、其余失败（message 为原因）。
 */
async function shareRequest(
  path: string,
  options: { body?: unknown; method?: string; password?: string } = {},
) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.password) {
    headers['X-Share-Password'] = options.password;
  }
  const response = await fetch(`${apiURL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const json = (await response.json()) as {
    code?: number;
    data?: unknown;
    message?: string;
  };
  if (json?.code !== 200) {
    throw new Error(json?.message || '请求失败，请稍后重试');
  }
  return json?.data;
}

/** 分享配置：知识库名称、是否需要密码、是否过期等 */
export function getShareConfig(token: string) {
  return shareRequest(`/share/${token}/config`) as Promise<{
    description: string;
    docCount: number;
    expired: boolean;
    expireTime: string;
    icon: string;
    name: string;
    requirePassword: boolean;
  }>;
}

/** 分享文档分页列表 */
export function getShareDocuments(
  token: string,
  params: { page?: number; pageSize?: number },
  password?: string,
) {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 100));
  return shareRequest(`/share/${token}/documents?${qs.toString()}`, {
    password,
  }) as Promise<{ items: AiApi.KbDocument[]; total: number }>;
}

/** 分享文档原文 */
export function getShareDocumentContent(
  token: string,
  docId: string,
  password?: string,
) {
  return shareRequest(`/share/${token}/documents/${docId}/content`, {
    password,
  }) as Promise<string>;
}

/** 分享知识库匿名问答 */
export function shareAsk(token: string, question: string, password?: string) {
  return shareRequest(`/share/${token}/ask`, {
    method: 'POST',
    body: { question },
    password,
  }) as Promise<string>;
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
  return requestClient.post<AiApi.KbSearchHit[]>(
    `/ai/knowledge-bases/${kbId}/search-test`,
    {
      question,
      topK,
    },
  );
}

export function searchKnowledgeBaseMultiple(
  kbIds: string[],
  question: string,
  topKPerKb = 5,
) {
  return requestClient.post<AiApi.KbSearchHit[]>(
    '/ai/knowledge-bases/search-multiple-test',
    {
      knowledgeBaseIds: kbIds,
      question,
      topKPerKb,
    },
  );
}

export function searchKnowledgeBaseRerank(
  kbId: string,
  question: string,
  topK = 5,
) {
  return requestClient.post<AiApi.KbSearchHit[]>(
    `/ai/knowledge-bases/${kbId}/search-rerank-test`,
    {
      question,
      topK,
    },
  );
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

export function getDocumentChunks(kbId: string, docId: string) {
  return requestClient.get<
    Array<{ charCount: number; chunkIndex: number; content: string }>
  >(`/ai/knowledge-bases/${kbId}/documents/${docId}/chunks`);
}
