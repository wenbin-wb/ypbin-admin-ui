interface BasicOption {
  label: string;
  value: string;
}

type SelectOption = BasicOption;

type TabOption = BasicOption;

interface BasicUserInfo {
  [key: string]: any;
  /**
   * 头像，后端可空（`sys_user.avatar` 允许 NULL），消费方需自行回退默认头像
   */
  avatar: null | string;
  /**
   * 用户昵称/显示名，后端可空（`sys_user.real_name` / `nickname` 允许 NULL，
   * `UserInfoResp` 未配置 `@JsonInclude(NON_NULL)`，缺值时 JSON 里就是 `null`），
   * 任何拼接、`slice` 等字符串操作前必须先归一
   */
  realName: null | string;
  /**
   * 用户角色
   */
  roles?: string[];
  /**
   * 用户id
   */
  userId: string;
  /**
   * 用户名
   */
  username: string;
}

type ClassType =
  | Array<ClassType>
  | boolean
  | null
  | object
  | string
  | undefined;

export type { BasicOption, BasicUserInfo, ClassType, SelectOption, TabOption };
