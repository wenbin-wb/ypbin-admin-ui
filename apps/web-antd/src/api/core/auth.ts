import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 行为验证码轨迹点 */
  export interface CaptchaTrackPoint {
    x: number;
    y: number;
    t: number;
    type: string;
  }

  /** 行为验证码拖动轨迹（与后端 ImageCaptchaTrack 同名） */
  export interface CaptchaTrack {
    bgImageWidth: number;
    bgImageHeight: number;
    templateImageWidth: number;
    templateImageHeight: number;
    startTime: number;
    stopTime: number;
    left: number;
    top: number;
    trackList: CaptchaTrackPoint[];
  }

  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
    /** 行为验证码 id（登录验证码开启时必传） */
    captchaId?: string;
    /** 行为验证码拖动轨迹（登录验证码开启时必传） */
    captchaTrack?: CaptchaTrack;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }

  /** 后端行为验证码数据（tianai ImageCaptchaVO） */
  export interface CaptchaVo {
    id: string;
    type: string;
    backgroundImage: string;
    templateImage: string;
    backgroundImageWidth: number;
    backgroundImageHeight: number;
    templateImageWidth: number;
    templateImageHeight: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

/**
 * 获取行为验证码。登录验证码开关关闭时返回 null。
 */
export async function getCaptchaApi() {
  return requestClient.get<null | { data?: AuthApi.CaptchaVo | null }>(
    '/captcha',
  );
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh', {
    withCredentials: true,
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
