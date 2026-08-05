import { requestClient } from '#/api/request';

export namespace SystemNoticeApi {
  export interface NoticeResp {
    id: string;
    title: string;
    content: string;
    cover?: string;
    noticeType: number;
    noticeScope?: number;
    scopeTargetIds?: string;
    notifyMethods?: string;
    isTop?: number;
    publishType?: number;
    publishStatus?: number;
    scheduledTime?: string;
    publishTime?: string;
    effectiveTime?: string;
    expireTime?: string;
    createUserName?: string;
    createTime: string;
  }
}

export function getNoticeList(params?: any) {
  return requestClient.get('/system/notice/list', { params });
}

export function createNotice(data: any) {
  return requestClient.post('/system/notice', data);
}

export function updateNotice(id: string, data: any) {
  return requestClient.put(`/system/notice/${id}`, data);
}

export function deleteNotice(id: string) {
  return requestClient.delete(`/system/notice/${id}`);
}

export function revokeNotice(id: string) {
  return requestClient.put(`/system/notice/${id}/revoke`);
}

/** 直接发布（草稿/待发布/已撤回 → 已发布并触发推送） */
export function publishNotice(id: string) {
  return requestClient.put(`/system/notice/${id}/publish`);
}
