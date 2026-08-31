import { requestClient } from '#/api/request';

// 用量统计
export function getUsageSummary() {
  return requestClient.get<{
    avgLatencyMs: number;
    totalCalls: number;
    totalTokens: number;
  }>('/ai/usage/summary');
}

// AI 统计看板
export function getAiStatsSummary() {
  return requestClient.get<{
    chatCount: number;
    docTotal: number;
    kbCount: number;
    queryCount: number;
    tokenTotal: number;
  }>('/ai/stats/summary');
}

export function getAiStatsDaily(days = 30) {
  return requestClient.get<
    Array<{
      chatCount: number;
      date: string;
      queryCount: number;
      tokenCount: number;
    }>
  >('/ai/stats/daily', { params: { days } });
}

export function getAiStatsHotQueries(limit = 10) {
  return requestClient.get<Array<{ count: number; query: string }>>(
    '/ai/stats/hot-queries',
    { params: { limit } },
  );
}

export function getAiStatsKbDocs() {
  return requestClient.get<Array<{ docCount: number; name: string }>>(
    '/ai/stats/kb-docs',
  );
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
