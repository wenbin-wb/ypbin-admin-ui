import { requestClient } from '#/api/request';

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
    /** 租户 ID（可选；不传则按用户名全局定位，适用于平台超管/默认租户登录） */
    tenantId?: string;
    /** 行为验证码 id（登录验证码开启时必传） */
    captchaId?: string;
    /** 行为验证码拖动轨迹（登录验证码开启时必传） */
    captchaTrack?: CaptchaTrack;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    /**
     * 是否必须先修改密码（初始口令 / 管理员重置口令）。
     *
     * 为 true 时网关只放行改密、登出与身份查询，前端应立即进入改密页。
     */
    mustChangePassword?: boolean;
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
    '/auth/captcha',
  );
}

/**
 * 退出登录
 *
 * 走 requestClient：请求拦截器会自动携带 Authorization（Bearer），
 * 服务端据此吊销会话，确保登出真实生效。
 */
export async function logoutApi() {
  return requestClient.post('/auth/logout');
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
