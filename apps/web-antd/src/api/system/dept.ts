import { requestClient } from '#/api/request';

export namespace SystemDeptApi {
  export interface DeptSaveReq {
    email?: string;
    leader?: string;
    name: string;
    phone?: string;
    pid?: string;
    remark?: string;
    sort?: number;
    status: 0 | 1;
  }

  export interface SystemDept {
    children?: SystemDept[];
    id: string;
    pid?: string;
    name: string;
    sort?: number;
    leader?: string;
    phone?: string;
    email?: string;
    remark?: string;
    status: 0 | 1;
    statusText?: string;
    createTime?: string;
    createUserName?: string;
  }
}

/**
 * 获取部门列表数据
 */
async function getDeptList() {
  return requestClient.get<Array<SystemDeptApi.SystemDept>>(
    '/system/dept/list',
  );
}

/**
 * 创建部门
 * @param data 部门数据
 */
async function createDept(data: SystemDeptApi.DeptSaveReq) {
  return requestClient.post('/system/dept', data);
}

/**
 * 更新部门
 *
 * @param id 部门 ID
 * @param data 部门数据
 */
async function updateDept(id: string, data: SystemDeptApi.DeptSaveReq) {
  return requestClient.put(`/system/dept/${id}`, data);
}

/**
 * 删除部门
 * @param id 部门 ID
 */
async function deleteDept(id: string) {
  return requestClient.delete(`/system/dept/${id}`);
}

export { createDept, deleteDept, getDeptList, updateDept };
