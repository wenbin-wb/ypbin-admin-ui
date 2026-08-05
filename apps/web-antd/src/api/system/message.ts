import { requestClient } from '#/api/request';

export namespace SystemMessageApi {
  export interface MessageItem {
    id: string;
    title: string;
    content: string;
    messageType: number;
    readStatus: number;
    createTime: string;
  }

  export interface PageResult {
    items: MessageItem[];
    total: number;
    page: number;
    pageSize: number;
    pages: number;
  }
}

/** 分页查询当前用户站内信 */
export function getMessageList(params: {
  messageType?: number;
  page?: number;
  pageSize?: number;
  readStatus?: number;
}) {
  return requestClient.get<SystemMessageApi.PageResult>('/user/messages', {
    params,
  });
}

/** 未读消息数 */
export function getUnreadCount() {
  return requestClient.get<number>('/user/messages/unread-count');
}

/** 最近消息（铃铛下拉用） */
export function getRecentMessages(limit = 10) {
  return requestClient.get<SystemMessageApi.MessageItem[]>(
    '/user/messages/recent',
    { params: { limit } },
  );
}

/** 标记单条已读 */
export function markMessageRead(id: string) {
  return requestClient.put(`/user/messages/${id}/read`);
}

/** 删除单条站内信 */
export function deleteMessage(id: string) {
  return requestClient.delete(`/user/messages/${id}`);
}

/** 全部标记已读 */
export function markAllMessagesRead() {
  return requestClient.put('/user/messages/read-all');
}

/** 获取 SSE 订阅票据（一次性、短时有效，需登录态签发） */
export function getSseTicket() {
  return requestClient.post<{ expiresIn: number; ticket: string }>(
    '/ypbin/sse/ticket',
  );
}
