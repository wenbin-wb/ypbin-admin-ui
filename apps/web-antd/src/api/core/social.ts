import { requestClient } from '#/api/request';

/**
 * 已开启的第三方登录平台编码集合
 */
export async function getSocialPlatformsApi() {
  return requestClient.get<string[]>('/auth/social/platforms');
}

/**
 * 获取第三方授权页地址
 */
export async function getSocialAuthorizeApi(source: string) {
  return requestClient.get<string>(`/auth/social/authorize/${source}`);
}

export interface SocialCallbackParams {
  auth_code?: string;
  code?: string;
  state?: string;
}

/**
 * 第三方授权回调，返回登录令牌
 */
export async function socialLoginApi(
  source: string,
  params: SocialCallbackParams,
) {
  return requestClient.post<{ accessToken: string }>(
    `/auth/social/callback/${source}`,
    {},
    { params },
  );
}
