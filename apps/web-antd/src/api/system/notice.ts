import { requestClient } from '#/api/request';

export namespace SystemNoticeApi {
  export interface NoticeSaveReq {
    content: string;
    cover?: string;
    effectiveTime?: string;
    expireTime?: string;
    isTop?: number;
    noticeScope?: number;
    noticeType: number;
    notifyMethods: string;
    publishStatus?: number;
    publishType?: number;
    scheduledTime?: string;
    scopeTargetIds?: string;
    title: string;
  }

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
    publishVersion?: string;
    scheduledTime?: string;
    publishTime?: string;
    effectiveTime?: string;
    expireTime?: string;
    createUser?: string;
    createUserName?: string;
    createTime: string;
  }
}

export function getNoticeList() {
  return requestClient.get<SystemNoticeApi.NoticeResp[]>('/system/notice/list');
}

export function createNotice(data: SystemNoticeApi.NoticeSaveReq) {
  return requestClient.post('/system/notice', data);
}

export function updateNotice(id: string, data: SystemNoticeApi.NoticeSaveReq) {
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
