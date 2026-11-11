import type { VbenFormSchema as FormSchema } from '#/adapter/form';

import { getRoleAll } from '#/api/system/role';
import { getTenantList } from '#/api/system/tenant';
import { $t } from '#/locales';

/** 布尔类参数键特征（如 LOGIN_CAPTCHA_ENABLED、PASSWORD_REQUIRE_DIGIT、MAIL_SSL_ENABLED） */
const BOOLEAN_KEY_RE = /(ENABLED|REQUIRE|ALLOW|SSL)/;

/** 敏感类参数键特征（密码/密钥/令牌等，输入用密码框、列表掩码显示） */
const SENSITIVE_KEY_RE = /(PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL)/;

export function isBooleanKey(configKey: string): boolean {
  return BOOLEAN_KEY_RE.test(configKey);
}

export function isSensitiveKey(configKey: string): boolean {
  return SENSITIVE_KEY_RE.test(configKey);
}

/** 内置分组特殊字段：按 configKey 定制控件，覆盖默认的类型推断 */
export const SPECIAL_FIELDS: Record<string, Partial<FormSchema>> = {
  SMS_SUPPLIER: {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: $t('system.config.smsSupplier.alibaba'), value: 'alibaba' },
        { label: $t('system.config.smsSupplier.tencent'), value: 'tencent' },
        { label: $t('system.config.smsSupplier.huawei'), value: 'huawei' },
        { label: $t('system.config.smsSupplier.yunpian'), value: 'yunpian' },
        { label: $t('system.config.smsSupplier.emay'), value: 'emay' },
        { label: $t('system.config.smsSupplier.cloopen'), value: 'cloopen' },
      ],
    },
  },
  SMS_ACCESS_KEY_SECRET: { component: 'InputPassword' },
  MAIL_PASSWORD: { component: 'InputPassword' },
  // 注册归属验证方式：枚举值必须与后端 RegisterVerifyMode 完全一致，避免手填拼错后被 fail-closed 拒绝
  REGISTER_VERIFY_MODE: {
    component: 'Select',
    componentProps: {
      allowClear: false,
      options: [
        {
          label: $t('system.config.registerVerifyMode.none'),
          value: 'NONE',
        },
        { label: $t('system.config.registerVerifyMode.sms'), value: 'SMS' },
        {
          label: $t('system.config.registerVerifyMode.email'),
          value: 'EMAIL',
        },
      ],
    },
  },
  // 默认角色填的是 sys_role.code（不是 ID/名称）；下拉避免手填错编码
  REGISTER_DEFAULT_ROLE_CODE: {
    component: 'ApiSelect',
    componentProps: {
      allowClear: true,
      // 只列启用的可选角色：平台超管不是注册默认角色的合法值
      api: async () => {
        const roles = await getRoleAll();
        return roles.filter(
          (role) => role.status === 1 && role.code !== 'super',
        );
      },
      class: 'w-full',
      labelField: 'name',
      valueField: 'code',
    },
  },
  // 默认租户下拉，避免手填不存在的租户 ID
  REGISTER_DEFAULT_TENANT_ID: {
    component: 'ApiSelect',
    componentProps: {
      allowClear: true,
      api: getTenantList,
      class: 'w-full',
      labelField: 'name',
      valueField: 'id',
    },
  },
};
