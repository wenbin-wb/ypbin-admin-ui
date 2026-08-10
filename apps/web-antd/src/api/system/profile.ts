import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace ProfileApi {
  export interface ProfileInfo {
    id: string;
    username: string;
    realName?: string;
    nickname?: string;
    deptId?: string;
    avatar?: string;
    phone?: string;
    email?: string;
    gender?: number;
    genderText?: string;
    remark?: string;
    lastLoginTime?: string;
    pwdResetTime?: string;
    createTime?: string;
    roleIds?: string[];
    postIds?: string[];
  }

  export interface ProfileUpdateReq {
    realName?: string;
    nickname?: string;
    avatar?: string;
    phone?: string;
    email?: string;
    gender?: number;
  }

  export interface ChangePasswordReq {
    oldPassword: string;
    newPassword: string;
  }
}

/** 获取当前登录用户个人信息（手机/邮箱不脱敏） */
export function getProfile() {
  return requestClient.get<ProfileApi.ProfileInfo>('/user/profile');
}

/** 更新个人信息 */
export function updateProfile(data: ProfileApi.ProfileUpdateReq) {
  return requestClient.put('/user/profile', data);
}

/** 上传当前用户头像 */
export function uploadProfileAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SystemCommonApi.FileInfo>(
    '/user/profile/avatar',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

/** 修改密码 */
export function changePassword(data: ProfileApi.ChangePasswordReq) {
  return requestClient.put('/user/profile/password', data);
}
