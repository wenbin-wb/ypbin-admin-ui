/**
 * 密码复杂度策略（与后端默认策略一致，见 ypbin-starter SecurityProperties.PasswordPolicy）：
 * 长度 8-32 位，且需同时包含至少一个数字与一个字母。
 * 仅用于前端防呆提示，最终以后端校验为准。
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 32;

const HAS_DIGIT_REG = /[\p{N}]/u;
const HAS_LETTER_REG = /[\p{L}]/u;

/** 判断明文密码是否满足复杂度策略 */
export function isPasswordPolicySatisfied(value: string): boolean {
  if (
    value.length < PASSWORD_MIN_LENGTH ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    return false;
  }
  return HAS_DIGIT_REG.test(value) && HAS_LETTER_REG.test(value);
}
