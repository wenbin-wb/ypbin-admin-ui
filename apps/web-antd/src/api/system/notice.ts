import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemNoticeApi {
  /** 公告分页查询（后端 NoticeQuery） */
  export interface NoticeQuery extends SystemCommonApi.PageQuery {
    title?: string;
    noticeType?: number;
    publishStatus?: number;
  }

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
    /** 列表接口不返回正文（体积大），编辑/预览前需调用 getNoticeDetail 补全 */
    content?: string;
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

export function getNoticeList(params: SystemNoticeApi.NoticeQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemNoticeApi.NoticeResp>
  >('/system/notice/list', { params });
}

/**
 * 公告详情（含正文）。
 *
 * 列表接口刻意不返回 content（富文本体积大），编辑/预览必须走这里补齐——
 * 否则用列表行直接提交会把正文清空。
 */
export function getNoticeDetail(id: string) {
  return requestClient.get<SystemNoticeApi.NoticeResp>(`/system/notice/${id}`);
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
