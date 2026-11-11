<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type { AuthApi } from '#/api/core/auth';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationRegister, z } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import {
  getRegisterOptionsApi,
  registerApi,
  sendRegisterCodeApi,
} from '#/api/core/auth';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { isPasswordPolicySatisfied } from '#/utils/password';

defineOptions({ name: 'Register' });

const CODE_LENGTH = 6;

const authStore = useAuthStore();
const router = useRouter();

const loading = ref(false);
const registerRef = ref<InstanceType<typeof AuthenticationRegister>>();

/** 注册公开配置（是否开启 / 验证渠道 / 是否需要行为验证码） */
const options = ref<AuthApi.RegisterOptions>();

/** 最近一次拖动生成的行为验证码数据，注册时随表单提交 */
const captchaPayload = ref<null | {
  id: string;
  track: AuthApi.CaptchaTrack;
}>(null);

const verifyMode = computed(() => options.value?.verifyMode ?? 'NONE');

onMounted(async () => {
  options.value = await getRegisterOptionsApi();
});

const formSchema = computed((): VbenFormSchema[] => {
  if (!options.value) {
    return [];
  }
  const schema: VbenFormSchema[] = [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      renderComponentContent() {
        return {
          strengthText: () => $t('authentication.passwordStrength'),
        };
      },
      rules: z
        .string()
        .min(1, { message: $t('authentication.passwordTip') })
        .refine(isPasswordPolicySatisfied, {
          message: $t('system.user.passwordRule'),
        }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ error: $t('authentication.passwordTip') })
            .min(1, { message: $t('authentication.passwordTip') })
            .refine((value) => value === password, {
              message: $t('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: $t('authentication.confirmPassword'),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.realNameTip'),
      },
      fieldName: 'realName',
      label: $t('authentication.realName'),
      rules: z.string().min(1, { message: $t('authentication.realNameTip') }),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.nicknameTip'),
      },
      fieldName: 'nickname',
      label: $t('authentication.nickname'),
    },
  ];

  // 验证渠道由后端配置决定：只渲染当前渠道需要的字段，避免用户猜测
  if (verifyMode.value === 'SMS') {
    schema.push({
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.mobileTip'),
      },
      fieldName: 'phone',
      label: $t('authentication.mobile'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.mobileTip') })
        .refine((value) => /^\d{11}$/.test(value), {
          message: $t('authentication.mobileErrortip'),
        }),
    });
  }
  if (verifyMode.value === 'EMAIL') {
    schema.push({
      component: 'VbenInput',
      componentProps: {
        placeholder: 'example@example.com',
      },
      fieldName: 'email',
      label: $t('authentication.email'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.emailTip') })
        .email($t('authentication.emailValidErrorTip')),
    });
  }
  if (verifyMode.value !== 'NONE') {
    schema.push({
      component: 'VbenPinInput',
      componentProps: {
        codeLength: CODE_LENGTH,
        createText: (countdown: number) =>
          countdown > 0
            ? $t('authentication.sendText', [countdown])
            : $t('authentication.sendCode'),
        handleSendCode,
        placeholder: $t('authentication.code'),
      },
      fieldName: 'verifyCode',
      label: $t('authentication.code'),
      rules: z.string().length(CODE_LENGTH, {
        message: $t('authentication.codeTip', [CODE_LENGTH]),
      }),
    });
  }
  if (options.value.captchaEnabled) {
    schema.push({
      component: 'TianaiCaptcha',
      componentProps: {
        onVerify: (payload: { id: string; track: AuthApi.CaptchaTrack }) => {
          captchaPayload.value = payload;
        },
      },
      // 不设前端校验规则：是否必须由后端 LOGIN_CAPTCHA_ENABLED 决定
      fieldName: 'captcha',
      label: $t('ui.captcha.title'),
    });
  }
  return schema;
});

/**
 * 发送注册验证码：渠道与目标地址都取自当前表单与后端配置。
 */
async function handleSendCode() {
  const values = (await registerRef.value?.getFormApi().getValues()) ?? {};
  if (verifyMode.value === 'SMS') {
    const phone = String(values.phone ?? '').trim();
    if (!phone) {
      message.error($t('authentication.phoneRequiredTip'));
      throw new Error($t('authentication.phoneRequiredTip'));
    }
    await sendRegisterCodeApi({ phone });
  } else {
    const email = String(values.email ?? '').trim();
    if (!email) {
      message.error($t('authentication.emailRequiredTip'));
      throw new Error($t('authentication.emailRequiredTip'));
    }
    await sendRegisterCodeApi({ email });
  }
  message.success($t('authentication.codeSent'));
}

async function handleSubmit(values: Recordable<any>) {
  const params: AuthApi.RegisterParams = {
    password: values.password,
    realName: values.realName,
    username: values.username,
  };
  if (values.nickname) {
    params.nickname = values.nickname;
  }
  if (values.phone) {
    params.phone = values.phone;
  }
  if (values.email) {
    params.email = values.email;
  }
  if (values.verifyCode) {
    params.verifyCode = values.verifyCode;
  }
  if (captchaPayload.value) {
    params.captchaId = captchaPayload.value.id;
    params.captchaTrack = captchaPayload.value.track;
  }

  loading.value = true;
  try {
    const { accessToken, mustChangePassword } = await registerApi(params);
    if (!accessToken) {
      throw new Error($t('authentication.registerFailed'));
    }
    message.success($t('authentication.registerSuccess'));
    await authStore.registerLogin(accessToken, mustChangePassword);
  } catch (error) {
    // 注册失败（含验证码已被消费）：换一张行为验证码，避免用旧数据再次提交
    refreshCaptcha();
    throw error;
  } finally {
    loading.value = false;
  }
}

function refreshCaptcha() {
  captchaPayload.value = null;
  const captchaComponent = registerRef.value
    ?.getFormApi()
    .getFieldComponentRef<{ fetchCaptcha: () => void }>('captcha');
  captchaComponent?.fetchCaptcha();
}

function goToLogin() {
  router.push('/auth/login');
}
</script>

<template>
  <AuthenticationRegister
    v-if="options?.enabled"
    ref="registerRef"
    :form-schema="formSchema"
    :loading="loading"
    :sub-title="$t('authentication.signUpSubtitle')"
    @submit="handleSubmit"
  >
    <!-- 覆盖默认标题（上游默认文案带 emoji，企业端不使用） -->
    <template #title>
      {{ $t('page.auth.register') }}
    </template>
  </AuthenticationRegister>
  <div v-else-if="options" class="mt-8 text-center">
    <p class="text-sm text-muted-foreground">
      {{ $t('authentication.registerDisabled') }}
    </p>
    <Button class="mt-4" type="primary" @click="goToLogin">
      {{ $t('authentication.goToLogin') }}
    </Button>
  </div>
</template>
