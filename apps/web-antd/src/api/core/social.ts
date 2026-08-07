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

/**
 * 第三方授权回调，返回登录令牌
 */
export async function socialLoginApi(
  source: string,
  code: string,
  state: string,
) {
  return requestClient.post<{ accessToken: string }>(
    `/auth/social/callback/${source}`,
    {},
    { params: { code, state } },
  );
}
