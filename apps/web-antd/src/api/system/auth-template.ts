import { requestClient } from '#/api/request';

export namespace SystemAuthTemplateApi {
  export interface AuthTemplateResp {
    id: string;
    name: string;
    code: string;
    remark?: string;
    menuIds?: string[];
    createUser?: string;
    createUserName?: string;
    createTime?: string;
  }

  export interface AuthTemplateSaveReq {
    name: string;
    code: string;
    remark?: string;
    menuIds?: string[];
  }
}

/**
 * 获取权限模板列表
 */
async function getAuthTemplateList() {
  return requestClient.get<SystemAuthTemplateApi.AuthTemplateResp[]>(
    '/system/auth-template/list',
  );
}

/**
 * 新增权限模板
 */
async function createAuthTemplate(
  data: SystemAuthTemplateApi.AuthTemplateSaveReq,
) {
  return requestClient.post('/system/auth-template', data);
}

/**
 * 编辑权限模板
 */
async function updateAuthTemplate(
  id: string,
  data: SystemAuthTemplateApi.AuthTemplateSaveReq,
) {
  return requestClient.put(`/system/auth-template/${id}`, data);
}

/**
 * 删除权限模板
 */
async function deleteAuthTemplate(id: string) {
  return requestClient.delete(`/system/auth-template/${id}`);
}

export {
  createAuthTemplate,
  deleteAuthTemplate,
  getAuthTemplateList,
  updateAuthTemplate,
};
