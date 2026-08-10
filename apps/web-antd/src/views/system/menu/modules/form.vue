<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { $te } from '@vben/locales';
import { getPopupContainer } from '@vben/utils';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMenu,
  getMenuList,
  isMenuNameExists,
  isMenuPathExists,
  SystemMenuApi,
  updateMenu,
} from '#/api/system/menu';
import { $t } from '#/locales';
import { componentKeys } from '#/router/routes';

import { getMenuTypeOptions } from '../data';

const emit = defineEmits<{
  success: [];
}>();
type MenuFormData = null | Partial<SystemMenuApi.SystemMenu>;
type MenuType = (typeof SystemMenuApi.MenuTypes)[number];
type MenuFormValues = SystemMenuApi.MenuSaveReq;

function isMenuType(
  type: MenuType | undefined,
  applicableTypes: readonly MenuType[],
) {
  return type !== undefined && applicableTypes.includes(type);
}

const formData = ref<Partial<SystemMenuApi.SystemMenu>>();
const titleSuffix = ref<string>();

const schema: VbenFormSchema<MenuFormValues>[] = [
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: getMenuTypeOptions(),
      optionType: 'button',
    },
    defaultValue: 'menu',
    fieldName: 'type',
    formItemClass: 'col-span-2 md:col-span-2',
    label: $t('system.menu.type'),
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: $t('system.menu.menuName'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.menu.menuName'), 2]))
      .max(30, $t('ui.formRules.maxLength', [$t('system.menu.menuName'), 30]))
      .refine(
        async (value: string) => {
          return !(await isMenuNameExists(value, formData.value?.id));
        },
        {
          error: (issue) =>
            $t('ui.formRules.alreadyExists', [
              $t('system.menu.menuName'),
              issue.input,
            ]),
        },
      ),
  },
  {
    component: 'ApiTreeSelect',
    componentProps: {
      api: getMenuList,
      class: 'w-full',
      getPopupContainer,
      labelField: 'title',
      showSearch: true,
      treeDefaultExpandAll: true,
      valueField: 'id',
      childrenField: 'children',
    },
    fieldName: 'pid',
    label: $t('system.menu.parent'),
  },
  {
    component: 'Input',
    componentProps() {
      // 不需要处理多语言时就无需这么做
      return {
        ...(titleSuffix.value && { addonAfter: titleSuffix.value }),
        onChange({ target: { value } }: { target: { value: string } }) {
          titleSuffix.value = value && $te(value) ? $t(value) : undefined;
        },
      };
    },
    fieldName: 'title',
    label: $t('system.menu.menuTitle'),
    rules: 'required',
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return isMenuType(values.type, ['catalog', 'embedded', 'menu']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'path',
    label: $t('system.menu.path'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.menu.path'), 2]))
      .max(100, $t('ui.formRules.maxLength', [$t('system.menu.path'), 100]))
      .refine(
        async (value: string) => {
          return !(await isMenuPathExists(value, formData.value?.id));
        },
        {
          error: (issue) =>
            $t('ui.formRules.alreadyExists', [
              $t('system.menu.path'),
              issue.input,
            ]),
        },
      ),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return isMenuType(values.type, ['embedded', 'menu']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'activePath',
    help: $t('system.menu.activePathHelp'),
    label: $t('system.menu.activePath'),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return isMenuType(values.type, ['catalog', 'embedded', 'link', 'menu']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'icon',
    label: $t('system.menu.icon'),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return isMenuType(values.type, ['catalog', 'embedded', 'menu']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'activeIcon',
    label: $t('system.menu.activeIcon'),
  },
  {
    component: 'AutoComplete',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      filterOption(input: string, option: { value: string }) {
        return option.value.toLowerCase().includes(input.toLowerCase());
      },
      options: componentKeys.map((v) => ({ value: v })),
    },
    dependencies: {
      rules: (values) => {
        return values.type === 'menu' ? 'required' : null;
      },
      show: (values) => {
        return values.type === 'menu';
      },
      triggerFields: ['type'],
    },
    fieldName: 'component',
    label: $t('system.menu.component'),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return isMenuType(values.type, ['catalog', 'menu']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'redirect',
    label: $t('system.menu.redirect'),
  },
  {
    component: 'InputNumber',
    fieldName: 'sort',
    label: $t('system.menu.order'),
    defaultValue: 0,
  },
  {
    component: 'Input',
    dependencies: {
      rules: (values) => (values.type === 'embedded' ? 'required' : null),
      show: (values) => values.type === 'embedded',
      triggerFields: ['type'],
    },
    fieldName: 'iframeSrc',
    label: $t('system.menu.linkSrc'),
    // 支持相对路径（如 /swagger-ui/index.html），故不用 z.url 强校验绝对 URL
  },
  {
    component: 'Input',
    dependencies: {
      rules: (values) => (values.type === 'link' ? 'required' : null),
      show: (values) => values.type === 'link',
      triggerFields: ['type'],
    },
    fieldName: 'link',
    label: $t('system.menu.linkSrc'),
    // 支持相对路径（如 /swagger-ui/index.html），故不用 z.url 强校验绝对 URL
  },
  {
    component: 'Input',
    dependencies: {
      rules: (values) => {
        return values.type === 'button' ? 'required' : null;
      },
      show: (values) => {
        return isMenuType(values.type, [
          'button',
          'catalog',
          'embedded',
          'menu',
        ]);
      },
      triggerFields: ['type'],
    },
    fieldName: 'authCode',
    label: $t('system.menu.authCode'),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: $t('common.enabled'), value: 1 },
        { label: $t('common.disabled'), value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'status',
    label: $t('system.menu.status'),
  },
  {
    component: 'Checkbox',
    defaultValue: false,
    fieldName: 'platformOnly',
    label: $t('system.menu.platformOnly'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: [
        { label: $t('system.menu.badgeType.dot'), value: 'dot' },
        { label: $t('system.menu.badgeType.normal'), value: 'normal' },
      ],
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'button';
      },
      triggerFields: ['type'],
    },
    fieldName: 'badgeType',
    label: $t('system.menu.badgeType.title'),
  },
  {
    component: 'Input',
    dependencies: {
      resolve: ({ values }) => {
        return {
          componentProps: {
            allowClear: true,
            class: 'w-full',
            disabled: values.badgeType !== 'normal',
          },
          show: values.type !== 'button',
        };
      },
      triggerFields: ['badgeType', 'type'],
    },
    fieldName: 'badge',
    label: $t('system.menu.badge'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: SystemMenuApi.BadgeVariants.map((v) => ({
        label: v,
        value: v,
      })),
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'button';
      },
      triggerFields: ['type'],
    },
    fieldName: 'badgeVariants',
    label: $t('system.menu.badgeVariants'),
  },
  {
    component: 'Divider',
    dependencies: {
      show: (values) => {
        return !isMenuType(values.type, ['button', 'link']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'divider1',
    formItemClass: 'col-span-2 md:col-span-2 pb-0',
    hideLabel: true,
    renderComponentContent() {
      return {
        default: () => $t('system.menu.advancedSettings'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return values.type === 'menu';
      },
      triggerFields: ['type'],
    },
    fieldName: 'keepAlive',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.keepAlive'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return values.type !== 'button';
      },
      triggerFields: ['type'],
    },
    fieldName: 'hideInMenu',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return isMenuType(values.type, ['embedded', 'menu']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'affixTab',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.affixTab'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return isMenuType(values.type, ['catalog', 'menu']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'hideChildrenInMenu',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideChildrenInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !isMenuType(values.type, ['button', 'link']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'hideInBreadcrumb',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideInBreadcrumb'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !isMenuType(values.type, ['button', 'link']);
      },
      triggerFields: ['type'],
    },
    fieldName: 'hideInTab',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideInTab'),
      };
    },
  },
];

const breakpoints = useBreakpoints(breakpointsTailwind);
const isHorizontal = computed(() => breakpoints.greaterOrEqual('md').value);

const [Form, formApi] = useVbenForm<MenuFormValues>({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});
const [Drawer, drawerApi] = useVbenDrawer<MenuFormData>({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formData.value = data ?? undefined;
      formApi.reset();
      titleSuffix.value = data?.title ? $t(data.title) : '';
      await nextTick();
      if (data?.id) {
        formApi.setValues(data);
      } else if (data?.pid) {
        formApi.setFieldValue('pid', data.pid);
      }
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const values = await formApi.getValues();
  const data: SystemMenuApi.MenuSaveReq = {
    activeIcon: values.activeIcon,
    activePath: values.activePath,
    affixTab: values.affixTab,
    authCode: values.authCode,
    badge: values.badge,
    badgeType: values.badgeType,
    badgeVariants: values.badgeVariants,
    component: values.component,
    hideChildrenInMenu: values.hideChildrenInMenu,
    hideInBreadcrumb: values.hideInBreadcrumb,
    hideInMenu: values.hideInMenu,
    hideInTab: values.hideInTab,
    icon: values.icon,
    iframeSrc: values.iframeSrc,
    keepAlive: values.keepAlive,
    link: values.link,
    name: values.name,
    path: values.path,
    pid: values.pid,
    platformOnly: values.platformOnly,
    redirect: values.redirect,
    sort: values.sort,
    status: values.status,
    title: values.title,
    type: values.type,
  };
  drawerApi.lock();
  try {
    await (formData.value?.id
      ? updateMenu(formData.value.id, data)
      : createMenu(data));
    drawerApi.close();
    emit('success');
  } finally {
    drawerApi.unlock();
  }
}
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.menu.name')])
    : $t('ui.actionTitle.create', [$t('system.menu.name')]),
);

defineExpose({ drawerApi });
</script>
<template>
  <Drawer class="w-full max-w-200" :title="getDrawerTitle">
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
