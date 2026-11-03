<script lang="ts" setup>
/**
 * 强制改密页：登录响应 `mustChangePassword=true` 时，路由守卫只放行本页。
 *
 * 后端在改密前只放行改密/登出/身份查询接口，因此这里不拉用户信息或菜单；
 * 改密成功后后端会踢掉既有会话，前端清令牌并回登录页重新登录。
 */
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';

import { Button, Form, Input, message } from 'ant-design-vue';

import { changePassword } from '#/api/system/profile';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { isPasswordPolicySatisfied } from '#/utils/password';
import { clearMustChangePassword } from '#/utils/pwd-change';

defineOptions({ name: 'ChangePassword' });

const router = useRouter();
const authStore = useAuthStore();
const submitting = ref(false);
const form = ref({
  confirmPassword: '',
  newPassword: '',
  oldPassword: '',
});

async function handleSubmit() {
  const { oldPassword, newPassword, confirmPassword } = form.value;
  if (!oldPassword || !newPassword) {
    message.warning($t('profile.oldPasswordPlaceholder'));
    return;
  }
  if (!isPasswordPolicySatisfied(newPassword)) {
    message.warning($t('system.user.passwordRule'));
    return;
  }
  if (newPassword !== confirmPassword) {
    message.warning($t('profile.passwordMismatch'));
    return;
  }
  submitting.value = true;
  try {
    await changePassword({ newPassword, oldPassword });
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
      <Form layout="vertical" @finish="handleSubmit">
        <Form.Item
          :label="$t('system.user.password')"
          name="oldPassword"
          required
        >
          <Input.Password
            v-model:value="form.oldPassword"
            :placeholder="$t('profile.oldPasswordPlaceholder')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('profile.newPassword')"
          name="newPassword"
          required
        >
          <Input.Password
            v-model:value="form.newPassword"
            :placeholder="$t('profile.newPasswordPlaceholder')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('profile.confirmPassword')"
          name="confirmPassword"
          required
        >
          <Input.Password
            v-model:value="form.confirmPassword"
            :placeholder="$t('profile.confirmPasswordPlaceholder')"
          />
        </Form.Item>
        <Button block html-type="submit" :loading="submitting" type="primary">
          {{ $t('common.confirm') }}
        </Button>
      </Form>
    </div>
  </div>
</template>
