<script lang="ts" setup>
import type { DescriptionsItemType } from '@vben/common-ui';

import type { SystemLicenseApi } from '#/api/system/license';

import { computed, h, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { Spin } from 'ant-design-vue';

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

/** 多行文本用 pre-line 保留换行 */
function preline(text: string) {
  return () => h('span', { class: 'whitespace-pre-line' }, text);
}

const items = computed<DescriptionsItemType[]>(() => {
  const d = detail.value;
  if (!d) {
    return [];
  }
  return [
    { label: $t('system.license.subject'), content: d.subject },
    { label: $t('system.license.licenseId'), content: d.licenseId || '-' },
    {
      label: $t('system.license.deliveryMode'),
      content: toLabel(getDeliveryModeOptions(), d.deliveryMode),
    },
    {
      label: $t('system.license.approveStatus'),
      content: toLabel(getApproveStatusOptions(), d.approveStatus),
    },
    {
      label: $t('system.license.currentStatus'),
      content: d.currentStatus || '-',
    },
    { label: $t('system.license.tenantId'), content: d.tenantId || '-' },
    { label: $t('system.license.effectiveAt'), content: d.effectiveAt || '-' },
    { label: $t('system.license.expireAt'), content: d.expireAt || '-' },
    { label: $t('system.license.graceDays'), content: d.graceDays ?? '-' },
    {
      label: $t('system.license.fingerprints'),
      content: preline(toListText(d.fingerprints)),
    },
    {
      label: $t('system.license.modules'),
      content: preline(toListText(d.modules)),
    },
    {
      label: $t('system.license.quotas'),
      content: preline(toMapText(d.quotas)),
    },
    {
      label: $t('system.license.attributes'),
      content: preline(toMapText(d.attributes)),
    },
    { label: $t('system.license.remark'), content: d.remark || '-' },
    {
      label: $t('system.license.approveUser'),
      content: d.approveUserName || '-',
    },
    { label: $t('system.license.approveTime'), content: d.approveTime || '-' },
    {
      label: $t('system.license.rejectReason'),
      content: d.rejectReason || '-',
    },
    { label: $t('common.creator'), content: d.createUserName || '-' },
    { label: $t('system.license.createTime'), content: d.createTime || '-' },
  ];
});

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
      <VbenDescriptions bordered :column="1" :items="items" />
    </Spin>
  </Drawer>
</template>
