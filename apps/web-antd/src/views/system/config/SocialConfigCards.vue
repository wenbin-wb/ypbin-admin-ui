<script lang="ts" setup>
import type { SystemConfigApi } from '#/api/system/config';

import { onMounted, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Card, Progress, Spin, Tag } from 'ant-design-vue';

import { getSocialConfigList } from '#/api/system/config';
import { $t } from '#/locales';
import { getSocialPlatformMeta } from '#/utils/social-platform';

import SocialForm from './modules/social-form.vue';

const configs = ref<SystemConfigApi.SocialConfigResp[]>([]);
const loading = ref(false);

const [SocialDrawer, socialDrawerApi] = useVbenDrawer({
  connectedComponent: SocialForm,
});

function isComplete(config: SystemConfigApi.SocialConfigResp) {
  return Boolean(
    config.clientId.trim() &&
    config.clientSecretConfigured &&
    config.redirectUri.trim() &&
    (config.source !== 'alipay' || config.publicKey.trim()),
  );
}

/** 已配置字段数 / 总字段数（用于进度展示） */
function configProgress(config: SystemConfigApi.SocialConfigResp): {
  done: number;
  total: number;
} {
  const checks = [
    config.clientId.trim().length > 0,
    config.clientSecretConfigured,
    config.redirectUri.trim().length > 0,
    config.source !== 'alipay' || config.publicKey.trim().length > 0,
  ];
  return {
    done: checks.filter(Boolean).length,
    total: checks.length,
  };
}

async function load() {
  loading.value = true;
  try {
    configs.value = await getSocialConfigList();
  } finally {
    loading.value = false;
  }
}

function onEdit(source: SystemConfigApi.SocialSource) {
  socialDrawerApi.setData(source).open();
}

onMounted(load);
</script>

<template>
  <div class="social-config">
    <SocialDrawer @success="load" />
    <Spin :spinning="loading">
      <div class="social-config__grid">
        <Card
          v-for="config in configs"
          :key="config.source"
          :bordered="false"
          class="social-config__card"
        >
          <div class="flex h-full flex-col gap-5">
            <div class="flex items-start justify-between gap-4">
              <div class="flex min-w-0 items-center gap-3">
                <div
                  class="social-config__icon"
                  :style="{ color: getSocialPlatformMeta(config.source).color }"
                >
                  <IconifyIcon
                    v-if="
                      typeof getSocialPlatformMeta(config.source).icon ===
                      'string'
                    "
                    :icon="getSocialPlatformMeta(config.source).icon as string"
                  />
                  <component
                    :is="getSocialPlatformMeta(config.source).icon"
                    v-else
                  />
                </div>
                <div class="min-w-0">
                  <div class="truncate text-base font-semibold text-foreground">
                    {{ $t(getSocialPlatformMeta(config.source).labelKey) }}
                  </div>
                  <div class="mt-1 font-mono text-xs text-muted-foreground">
                    {{ config.source }}
                  </div>
                </div>
              </div>
              <Tag :color="config.enabled ? 'success' : 'default'">
                {{
                  config.enabled
                    ? $t('system.config.social.statusEnabled')
                    : $t('system.config.social.statusDisabled')
                }}
              </Tag>
            </div>

            <div class="social-config__summary">
              <div class="flex w-full items-center justify-between gap-3">
                <span class="text-xs text-muted-foreground">
                  {{
                    $t('system.config.social.progress', [
                      configProgress(config).done,
                      configProgress(config).total,
                    ])
                  }}
                </span>
                <Tag :color="isComplete(config) ? 'success' : 'warning'">
                  {{
                    isComplete(config)
                      ? $t('system.config.social.complete')
                      : $t('system.config.social.incomplete')
                  }}
                </Tag>
              </div>
              <Progress
                :percent="
                  Math.round(
                    (configProgress(config).done /
                      configProgress(config).total) *
                      100,
                  )
                "
                :show-info="false"
                size="small"
                :stroke-color="isComplete(config) ? undefined : '#faad14'"
              />
            </div>

            <Button
              v-access:code="['system:config:edit']"
              block
              @click="onEdit(config.source)"
            >
              {{ $t('system.config.social.configure') }}
            </Button>
          </div>
        </Card>
      </div>
    </Spin>
  </div>
</template>

<style scoped>
.social-config {
  min-height: 240px;
  padding: 4px 20px 20px;
}

.social-config__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.social-config__card {
  height: 100%;
  border: 1px solid hsl(var(--border));
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.social-config__card:hover {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 10px 28px hsl(var(--foreground) / 8%);
  transform: translateY(-2px);
}

.social-config__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 24px;
  background: currentcolor;
  border-radius: 12px;
}

.social-config__icon :deep(svg) {
  color: white;
}

.social-config__summary {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 12px;
  background: hsl(var(--muted) / 55%);
  border-radius: 10px;
}

@media (max-width: 640px) {
  .social-config {
    padding-inline: 0;
  }

  .social-config__grid {
    grid-template-columns: 1fr;
  }
}
</style>
