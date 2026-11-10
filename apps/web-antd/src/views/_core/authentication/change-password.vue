<script lang="ts" setup>
/**
 * 强制改密页：登录响应 `mustChangePassword=true` 时，路由守卫只放行本页。
 *
 * 后端在改密前只放行改密/登出/身份查询接口，因此这里不拉用户信息或菜单；
 * 改密成功后后端会踢掉既有会话，前端清令牌并回登录页重新登录。
 */
import type { VbenFormSchema } from '#/adapter/form';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { z } from '@vben/common-ui';
import { LOGIN_PATH } from '@vben/constants';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { changePassword } from '#/api/system/profile';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { isPasswordPolicySatisfied } from '#/utils/password';
import { clearMustChangePassword } from '#/utils/pwd-change';

defineOptions({ name: 'ChangePassword' });

const router = useRouter();
const authStore = useAuthStore();
const submitting = ref(false);

const formSchema: VbenFormSchema[] = [
  {
    component: 'InputPassword',
    componentProps: {
      placeholder: $t('profile.oldPasswordPlaceholder'),
    },
    fieldName: 'oldPassword',
    label: $t('system.user.password'),
    rules: z
      .string({ error: $t('profile.oldPasswordPlaceholder') })
      .min(1, { message: $t('profile.oldPasswordPlaceholder') }),
  },
  {
    component: 'InputPassword',
    componentProps: {
      placeholder: $t('profile.newPasswordPlaceholder'),
    },
    fieldName: 'newPassword',
    label: $t('profile.newPassword'),
    rules: z
      .string({ error: $t('profile.newPasswordPlaceholder') })
      .min(1, { message: $t('profile.newPasswordPlaceholder') })
      .refine(isPasswordPolicySatisfied, {
        message: $t('system.user.passwordRule'),
      }),
  },
  {
    component: 'InputPassword',
    componentProps: {
      placeholder: $t('profile.confirmPasswordPlaceholder'),
    },
    dependencies: {
      rules(values: Record<string, any>) {
        const { newPassword } = values;
        return z
          .string({ error: $t('profile.confirmPasswordPlaceholder') })
          .min(1, { message: $t('profile.confirmPasswordPlaceholder') })
          .refine((value) => value === newPassword, {
            message: $t('profile.passwordMismatch'),
          });
      },
      triggerFields: ['newPassword'],
    },
    fieldName: 'confirmPassword',
    label: $t('profile.confirmPassword'),
  },
];

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: formSchema,
  showDefaultActions: false,
});

async function handleSubmit() {
  if (submitting.value) {
    return;
  }
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues<{
    newPassword: string;
    oldPassword: string;
  }>();
  submitting.value = true;
  try {
    await changePassword({
      newPassword: values.newPassword,
      oldPassword: values.oldPassword,
    });
    message.success($t('page.auth.changePasswordSuccess'));
    clearMustChangePassword();
    // 后端已踢掉既有会话：本地清令牌，回登录页重新登录
    await authStore.logout(false);
    await router.replace(LOGIN_PATH);
  } catch {
    // 失败文案由全局响应拦截器展示（原密码错误/策略不满足）
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <div class="mx-auto w-full max-w-md">
    <div class="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 class="text-center text-xl font-semibold text-foreground">
        {{ $t('page.auth.changePassword') }}
      </h2>
      <p class="mt-2 mb-6 text-center text-sm text-muted-foreground">
        {{ $t('page.auth.changePasswordHint') }}
      </p>
      <Form />
      <Button block :loading="submitting" type="primary" @click="handleSubmit">
        {{ $t('common.confirm') }}
      </Button>
    </div>
  </div>
</template>
