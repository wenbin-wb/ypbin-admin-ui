import type { VbenFormSchema as FormSchema } from '#/adapter/form';

import { $t } from '#/locales';

/** 布尔类参数键特征（如 LOGIN_CAPTCHA_ENABLED、PASSWORD_REQUIRE_DIGIT、MAIL_SSL_ENABLED） */
const BOOLEAN_KEY_RE = /(ENABLED|REQUIRE|ALLOW|SSL)/;

export function isBooleanKey(configKey: string): boolean {
  return BOOLEAN_KEY_RE.test(configKey);
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
};
