import { requestClient } from '#/api/request';

/**
 * 空间管理 API。
 *
 * 空间是基础模块的通用定位维度（楼栋/楼层/办公室/仓库/宿舍…），设备、部门、人员等业务对象
 * 通过 {@link bindSpaceRelations} 挂到空间上。后端契约见
 * `ypbin-service/.../controller/SysSpaceController.java`。
 */
export namespace SystemSpaceApi {
  export interface SpaceSaveReq {
    /** 父空间 ID（null 表示顶级） */
    pid?: null | string;
    /** 空间名称 */
    name: string;
    /** 空间编码（租户内唯一，可空） */
    code?: null | string;
    /** 空间类型：字典 space_type 的项值 */
    spaceType: string;
    /** 同级排序 */
    sort?: number;
    /** 详细地址 */
    address?: null | string;
    /** 经度 */
    longitude?: null | number | string;
    /** 纬度 */
    latitude?: null | number | string;
    /** 楼层号 */
    floorNo?: null | string;
    /** 房间号 */
    roomNo?: null | string;
    /** 面积（平方米） */
    area?: null | number | string;
    /** 容量/容纳人数 */
    capacity?: null | number;
    /** 负责人 */
    manager?: null | string;
    /** 联系电话 */
    phone?: null | string;
    /** 状态：1 正常 0 停用 */
    status: 0 | 1;
    /** 备注 */
    remark?: null | string;
    /** 扩展属性 JSON 字符串 */
    extJson?: null | string;
  }

  export interface SpaceResp {
    id: string;
    pid: string;
    name: string;
    code?: null | string;
    spaceType: string;
    /** 空间类型展示文本（后端 @DictText 由字典 space_type 翻译，字段名 = spaceType + Text） */
    spaceTypeText?: null | string;
    /** 层级深度（根为 1，后端维护） */
    level?: number;
    /** 空间完整路径（如「总部园区 / A栋 / 1F / 101室」，后端按父链拼接） */
    spacePath?: null | string;
    sort?: number;
    address?: null | string;
    longitude?: null | number | string;
    latitude?: null | number | string;
    floorNo?: null | string;
    roomNo?: null | string;
    area?: null | number | string;
    capacity?: null | number;
    manager?: null | string;
    phone?: null | string;
    status: number;
    remark?: null | string;
    extJson?: null | string;
    /** 直接子空间数（后端一次分组查询给出） */
    childCount?: number;
    /** 关联业务对象数 */
    relationCount?: number;
    createTime?: string;
    createUser?: string;
    /** 子节点（叶子为 undefined/null，不是空数组） */
    children?: SystemSpaceApi.SpaceResp[];
    [key: string]: any;
  }

  export interface SpaceQuery {
    keyword?: string;
    spaceType?: string;
    page?: number;
    pageSize?: number;
    pid?: string;
    status?: number;
  }

  /** 空间关联的业务对象类型（字典 space_target_type 的项值） */
  export type SpaceTargetType =
    | 'asset'
    | 'dept'
    | 'device'
    | 'other'
    | 'user'
    | (string & {});

  export interface SpaceBindReq {
    /** 关联对象类型 */
    targetType: SpaceTargetType;
    /** 关联对象 ID 列表 */
    targetIds: string[];
    /** 是否主空间：1 是 0 否 */
    isPrimary?: 0 | 1;
    /** 关联备注 */
    remark?: string;
    /**
     * 是否先清空这些对象在其它空间下的同类关联。
     * 设备「挪位置」置 true；部门/人员通常 false（可对应多个空间点）。
     */
    clearOthers?: boolean;
  }

  export interface SpaceRelationResp {
    id: string;
    spaceId: string;
    spaceName?: string;
    spaceCode?: null | string;
    spaceType?: string;
    spaceTypeText?: null | string;
    /** 完整路径，如「总部园区 / A栋 / 1F / 101室」 */
    spacePath?: string;
    targetType: string;
    targetId: string;
    isPrimary: number;
    remark?: null | string;
    status?: number;
    createTime?: string;
  }

  export interface DictItem {
    label: string;
    value: string;
  }
}

/** 空间树（全量，用于树形表格与选择器） */
export async function getSpaceTree() {
  return requestClient.get<SystemSpaceApi.SpaceResp[]>('/system/space/tree');
}

/** 空间平铺分页列表 */
export async function getSpaceList(params?: SystemSpaceApi.SpaceQuery) {
  return requestClient.get<{
    items: SystemSpaceApi.SpaceResp[];
    total: number;
  }>('/system/space/list', { params });
}

/** 空间详情 */
export async function getSpaceDetail(id: string) {
  return requestClient.get<SystemSpaceApi.SpaceResp>(`/system/space/${id}`);
}

/** 空间完整路径 */
export async function getSpacePath(id: string) {
  return requestClient.get<string>(`/system/space/${id}/path`);
}

/** 新增空间 */
export async function createSpace(data: SystemSpaceApi.SpaceSaveReq) {
  return requestClient.post<number>('/system/space', data);
}

/** 编辑空间 */
export async function updateSpace(
  id: string,
  data: SystemSpaceApi.SpaceSaveReq,
) {
  return requestClient.put(`/system/space/${id}`, data);
}

/** 删除空间 */
export async function deleteSpace(id: string) {
  return requestClient.delete(`/system/space/${id}`);
}

/** 把一批业务对象绑定到指定空间 */
export async function bindSpaceRelations(
  spaceId: string,
  data: SystemSpaceApi.SpaceBindReq,
) {
  return requestClient.post<number>(`/system/space/${spaceId}/relations`, data);
}

/** 把一批业务对象从指定空间解绑 */
export async function unbindSpaceRelations(
  spaceId: string,
  targetType: string,
  targetIds: string[],
) {
  return requestClient.delete<number>(`/system/space/${spaceId}/relations`, {
    params: { targetIds: targetIds.join(','), targetType },
  });
}

/** 按业务对象反查其所在空间 */
export async function getRelationsByTarget(params: {
  primaryOnly?: boolean;
  targetId: string;
  targetType: string;
}) {
  return requestClient.get<SystemSpaceApi.SpaceRelationResp[]>(
    '/system/space/relations/by-target',
    { params },
  );
}

/**
 * 按业务对象整体同步其空间集合（一个事务内完成增删）。
 *
 * **优先用这个而不是自己算差集逐个 bind/unbind**：后者是 N 次请求且无事务，
 * 中途失败会留下「页面说保存失败、库已半改」的状态。
 *
 * @param data targetType + targetId + 目标空间 ID 全量列表（空数组=清空）
 */
export async function syncTargetSpaces(data: {
  spaceIds: string[];
  targetId: string;
  targetType: string;
}) {
  return requestClient.post<number>('/system/space/relations/sync', data);
}

/** 按空间反查其关联的业务对象（运维视角：这个空间挂了哪些对象） */
export async function getRelationsBySpace(
  spaceId: string,
  params?: { targetType?: string },
) {
  return requestClient.get<SystemSpaceApi.SpaceRelationResp[]>(
    `/system/space/${spaceId}/relations`,
    { params },
  );
}
