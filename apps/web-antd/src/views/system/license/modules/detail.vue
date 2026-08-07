<script lang="ts" setup>
import type { SystemLicenseApi } from '#/api/system/license';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Descriptions, Spin } from 'ant-design-vue';

import { getLicenseDetail } from '#/api/system/license';
import { $t } from '#/locales';

import { getApproveStatusOptions, getDeliveryModeOptions } from '../data';

const loading = ref(false);
const detail = ref<SystemLicenseApi.SystemLicense>();

/** 选项值 → 标签；未匹配或为空返回占位符 */
function toLabel(options: { label: string; value: string }[], value?: string) {
  return options.find((item) => item.value === value)?.label ?? value ?? '-';
}

/** 字符串数组 → 顿号分隔文本 */
function toListText(list?: string[]) {
  return list && list.length > 0 ? list.join('、') : '-';
}

/** 键值对象 → 多行文本 */
function toMapText(map?: Record<string, number | string>) {
  if (!map || Object.keys(map).length === 0) return '-';
  return Object.entries(map)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

const [Drawer, drawerApi] = useVbenDrawer<SystemLicenseApi.SystemLicense>({
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    if (!data) return;
    loading.value = true;
    detail.value = undefined;
    try {
      detail.value = await getLicenseDetail(data.id);
    } catch {
      // 拉取失败由全局错误拦截器提示，详情保持空态
      detail.value = undefined;
    } finally {
      loading.value = false;
    }
  },
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer :title="$t('system.license.detailTitle')" class="w-[720px]">
    <Spin :spinning="loading">
      <Descriptions v-if="detail" :column="1" bordered size="small">
        <Descriptions.Item :label="$t('system.license.subject')">
          {{ detail.subject }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.licenseId')">
          {{ detail.licenseId || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.deliveryMode')">
          {{ toLabel(getDeliveryModeOptions(), detail.deliveryMode) }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.approveStatus')">
          {{ toLabel(getApproveStatusOptions(), detail.approveStatus) }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.currentStatus')">
          {{ detail.currentStatus || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.tenantId')">
          {{ detail.tenantId || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.effectiveAt')">
          {{ detail.effectiveAt || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.expireAt')">
          {{ detail.expireAt || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.graceDays')">
          {{ detail.graceDays ?? '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.fingerprints')">
          <span class="whitespace-pre-line">{{
            toListText(detail.fingerprints)
          }}</span>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.modules')">
          <span class="whitespace-pre-line">{{
            toListText(detail.modules)
          }}</span>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.quotas')">
          <span class="whitespace-pre-line">{{
            toMapText(detail.quotas)
          }}</span>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.attributes')">
          <span class="whitespace-pre-line">{{
            toMapText(detail.attributes)
          }}</span>
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.remark')">
          {{ detail.remark || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.approveUser')">
          {{ detail.approveUserName || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.approveTime')">
          {{ detail.approveTime || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.rejectReason')">
          {{ detail.rejectReason || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('common.creator')">
          {{ detail.createUserName || '-' }}
        </Descriptions.Item>
        <Descriptions.Item :label="$t('system.license.createTime')">
          {{ detail.createTime || '-' }}
        </Descriptions.Item>
      </Descriptions>
    </Spin>
  </Drawer>
</template>
