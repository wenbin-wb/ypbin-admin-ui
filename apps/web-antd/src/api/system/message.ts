import type { SystemCommonApi } from './common';

import { useAccessStore } from '@vben/stores';

import { baseRequestClient, requestClient } from '#/api/request';

export namespace SystemMessageApi {
  export interface MessageItem {
    id: string;
    title: string;
    content: string;
    messageType: number;
    readStatus: number;
    createTime: string;
  }

  export interface MessageQuery extends SystemCommonApi.PageQuery {
    messageType?: number;
    readStatus?: number;
  }
}

/** 分页查询当前用户站内信 */
export function getMessageList(params: SystemMessageApi.MessageQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemMessageApi.MessageItem>
  >('/system/messages', { params });
}

/** 未读消息数 */
export function getUnreadCount() {
  return requestClient.get<number>('/system/messages/unread-count');
}

/** 最近消息（铃铛下拉用） */
export function getRecentMessages(limit = 10) {
  return requestClient.get<SystemMessageApi.MessageItem[]>(
    '/system/messages/recent',
    { params: { limit } },
  );
}

/** 标记单条已读 */
export function markMessageRead(id: string) {
  return requestClient.put(`/system/messages/${id}/read`);
}

/** 删除单条站内信 */
export function deleteMessage(id: string) {
  return requestClient.delete(`/system/messages/${id}`);
}

/** 全部标记已读 */
export function markAllMessagesRead() {
  return requestClient.put('/system/messages/read-all');
}

/** 获取 SSE 订阅票据（一次性、短时有效，需登录态签发）
 *  用裸 client 手动带 token：SSE 为增强能力，取票失败不应触发全局登出（401 拦截），
 *  由调用方容错重试即可。
 */
export async function getSseTicket() {
  const token = useAccessStore().accessToken;
  // baseRequestClient 为裸 client：返回完整 AxiosResponse（axios 泛型失真，此处做轻量断言）
  const response = (await baseRequestClient.post(
    '/ypbin/sse/ticket',
    undefined,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  )) as unknown as {
    data: { code: number; data: null | { expiresIn: number; ticket: string } };
  };
  const body = response.data;
  if (!body || body.code !== 200 || !body.data?.ticket) {
    throw new Error('SSE ticket 签发失败');
  }
  return body.data;
}
