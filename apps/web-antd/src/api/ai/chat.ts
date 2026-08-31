import type { AiApi } from './types';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';
/**
 * 流式对话（SSE）。vben 的 postSSE 只做原始分块转发、不解析 SSE 帧，
 * 这里直接用 fetch 按标准 SSE 帧格式解析：
 * - 剥离 data: 前缀，逐帧回调节点后让出一帧渲染（保持视觉流式）；
 * - 识别 event:error 错误帧并交给 onError（后端流式失败时推送）；
 * - 非 SSE 响应（如统一异常 JSON）解析出 message 后抛出，避免静默无输出。
 * 入参字段与后端 AiChatSendReq 全程同名（sessionId/content/roleId/modelId/knowledgeBaseId）。
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
  const response = await fetch(`${apiURL}/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessStore.accessToken}`,
      'Accept-Language': preferences.app.locale,
    },
    body: JSON.stringify(data),
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
