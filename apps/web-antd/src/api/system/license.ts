import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemLicenseApi {
  /** 审批状态：草稿 / 待审批 / 已签发 / 已驳回 / 已吊销 */
  export type ApproveStatus =
    | 'DRAFT'
    | 'ISSUED'
    | 'PENDING'
    | 'REJECTED'
    | 'REVOKED';

  /** 交付模式：内联授权码 / 授权文件 */
  export type DeliveryMode = 'CODE' | 'FILE';

  export interface LicenseQuery extends SystemCommonApi.PageQuery {
    approveStatus?: ApproveStatus;
    subject?: string;
    tenantId?: string;
  }

  export interface LicenseSaveReq {
    attributes?: Record<string, string>;
    deliveryMode: DeliveryMode;
    effectiveAt?: string;
    expireAt?: string;
    fingerprints?: string[];
    graceDays?: number;
    modules?: string[];
    quotas?: Record<string, number>;
    remark?: string;
    subject: string;
    tenantId?: string;
  }

  export interface SystemLicense {
    id: string;
    /** 授权编号（签发时生成） */
    licenseId?: string;
    /** 被授权方名称 */
    subject: string;
    /** 供应方备注 */
    remark?: string;
    /** 允许运行的机器指纹列表（为空表示不限机器） */
    fingerprints?: string[];
    /** 绑定租户标识（为空表示不限租户） */
    tenantId?: string;
    /** 生效时间 */
    effectiveAt?: string;
    /** 到期时间（为空表示永久授权） */
    expireAt?: string;
    /** 过期后的宽限天数 */
    graceDays?: number;
    /** 授权的功能模块标识集合 */
    modules?: string[];
    /** 业务额度限制 */
    quotas?: Record<string, number>;
    /** 自定义扩展参数 */
    attributes?: Record<string, string>;
    /** 交付模式 */
    deliveryMode: DeliveryMode;
    /** 签发来源：manual 手工 / payment 支付（预留，当前均为手工） */
    source?: string;
    /** 审批状态 */
    approveStatus?: ApproveStatus;
    /** 审批人 */
    approveUser?: string;
    approveUserName?: string;
    /** 审批时间 */
    approveTime?: string;
    /** 驳回原因 */
    rejectReason?: string;
    /** 当前运行态描述（仅已签发有意义，由后端实时计算） */
    currentStatus?: string;
    createUser?: string;
    createUserName?: string;
    createTime?: string;
  }

  /** 审批请求 */
  export interface ApproveParams {
    /** 是否通过：true 通过并签发、false 驳回 */
    approve: boolean;
    /** 驳回原因（驳回时必填） */
    rejectReason?: string;
  }

  /** 新生成的签发密钥对 */
  export interface KeyPair {
    /** Base64 SM2 公钥 */
    publicKey: string;
    /** Base64 SM2 私钥（仅生成时返回一次，务必离线保管） */
    privateKey: string;
    /** Base64 SM4 密钥 */
    sm4Key: string;
  }

  /** 可重复读取的授权交付信息，不包含 Secret Key */
  export interface LicenseDelivery {
    /** 授权串（Base64） */
    authCode?: string;
    /** 联机应用 ID */
    appId?: string;
    /** 联机应用名称（= 被授权方） */
    appName?: string;
    /** 联机应用 Access Key */
    accessKey?: string;
  }

  /** 审批通过时返回的一次性签发信息 */
  export interface LicenseIssueResp extends LicenseDelivery {
    /** 仅首次创建联机应用时返回 */
    secretKey?: string;
  }
}

/**
 * 获取授权列表数据
 */
async function getLicenseList(params: SystemLicenseApi.LicenseQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemLicenseApi.SystemLicense>
  >('/system/license/list', { params });
}

/**
 * 获取授权详情
 * @param id 授权 ID
 */
async function getLicenseDetail(id: string) {
  return requestClient.get<SystemLicenseApi.SystemLicense>(
    `/system/license/${id}`,
  );
}

/**
 * 新增授权草稿
 * @param data 授权数据
 */
async function createLicense(data: SystemLicenseApi.LicenseSaveReq) {
  return requestClient.post('/system/license', data);
}

/**
 * 修改授权草稿
 * @param id 授权 ID
 * @param data 授权数据
 */
async function updateLicense(
  id: string,
  data: SystemLicenseApi.LicenseSaveReq,
) {
  return requestClient.put(`/system/license/${id}`, data);
}

/**
 * 提交授权审批
 * @param id 授权 ID
 */
async function submitLicense(id: string) {
  return requestClient.put(`/system/license/${id}/submit`);
}

/**
 * 审批授权（通过并签发 / 驳回）
 * @param id 授权 ID
 * @param data 审批结论
 */
async function approveLicense(
  id: string,
  data: SystemLicenseApi.ApproveParams,
) {
  return requestClient.put<null | SystemLicenseApi.LicenseIssueResp>(
    `/system/license/${id}/approve`,
    data,
  );
}

/**
 * 吊销授权
 * @param id 授权 ID
 */
async function revokeLicense(id: string) {
  return requestClient.put(`/system/license/${id}/revoke`);
}

/**
 * 删除授权
 * @param id 授权 ID
 */
async function deleteLicense(id: string) {
  return requestClient.delete(`/system/license/${id}`);
}

/**
 * 生成签发密钥对（仅回显一次，服务端不落库）
 */
async function generateLicenseKey() {
  return requestClient.post<SystemLicenseApi.KeyPair>(
    '/system/license/generate-key',
  );
}

/**
 * 下载授权文件（.lic）
 *
 * 用 requestClient.download 而非 get + responseType:'blob'：后者走实例默认的
 * responseReturn:'data'，defaultResponseInterceptor 会去读响应体（Blob）的 code 字段，
 * 而 download 接口返回的是纯文本授权串（无 {code,data} 包装），Blob 没有 code 字段即抛错。
 * download 内部传 responseReturn:'body'，拦截器直接返回 Blob，不判 code。
 *
 * @param id 授权 ID
 */
async function downloadLicenseFile(id: string) {
  return requestClient.download<Blob>(`/system/license/${id}/download`);
}

/**
 * 获取可重复读取的授权交付信息（授权码 + 联机应用 AK，不包含 Secret）
 * @param id 授权 ID
 */
async function getLicenseDelivery(id: string) {
  return requestClient.get<SystemLicenseApi.LicenseDelivery>(
    `/system/license/${id}/delivery`,
  );
}

export {
  approveLicense,
  createLicense,
  deleteLicense,
  downloadLicenseFile,
  generateLicenseKey,
  getLicenseDelivery,
  getLicenseDetail,
  getLicenseList,
  revokeLicense,
  submitLicense,
  updateLicense,
};
