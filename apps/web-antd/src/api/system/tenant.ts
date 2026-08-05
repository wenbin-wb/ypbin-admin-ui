import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemTenantApi {
  export interface TenantResp {
    id: string;
    name: string;
    code: string;
    templateId?: string;
    templateIdName?: string;
    contactName?: string;
    contactPhone?: string;
    expireDate?: string;
    remark?: string;
    createUser?: string;
    createUserName?: string;
    createTime?: string;
  }

  export interface TenantSaveReq {
    name: string;
    code: string;
    templateId?: string;
    contactName?: string;
    contactPhone?: string;
    expireDate?: string;
    remark?: string;
    status?: number;
  }
}

/**
 * 获取租户列表
 */
async function getTenantList(params?: Recordable<any>) {
  return requestClient.get<SystemTenantApi.TenantResp[]>(
    '/system/tenant/list',
    { params },
  );
}

/**
 * 新增租户
 */
async function createTenant(data: Recordable<any>) {
  return requestClient.post('/system/tenant', data);
}

/**
 * 编辑租户
 */
async function updateTenant(id: string, data: Recordable<any>) {
  return requestClient.put(`/system/tenant/${id}`, data);
}

/**
 * 删除租户
 */
async function deleteTenant(id: string) {
  return requestClient.delete(`/system/tenant/${id}`);
}

export { createTenant, deleteTenant, getTenantList, updateTenant };
