/**
 * 通用组件适配器入口：把 Ant Design Vue（及少量自定义组件）注册进 Vben 的
 * schema 驱动体系，供 vben-form、vben-modal、vben-drawer 等使用。
 *
 * 实现按域拆分：异步组件注册表见 `async-components.ts`，上传域见 `upload.ts`，
 * 类型见 `typing.ts`；本文件只保留默认占位符包装与初始化逻辑。
 */

 

import type { Component } from 'vue';

import type { Recordable } from '@vben/types';

import type { ComponentType } from './typing';

import { defineAsyncComponent, defineComponent, h, ref } from 'vue';

import { ApiComponent, globalShareState, IconPicker } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { VbenTiptap } from '@vben/plugins/tiptap';

import { notification } from 'ant-design-vue';

import {
  AutoComplete,
  Button,
  Cascader,
  Checkbox,
  CheckboxGroup,
  DatePicker,
  Divider,
  Input,
  InputNumber,
  InputPassword,
  Mentions,
  Radio,
  RadioGroup,
  RangePicker,
  Rate,
  Select,
  Space,
  Switch,
  Textarea,
  TimePicker,
  TreeSelect,
} from './async-components';
import { withPreviewUpload } from './upload';

const withDefaultPlaceholder = (
  component: Component,
  type: 'input' | 'select',
  componentProps: Recordable<any> = {},
) => {
  return defineComponent({
    name: component.name,
    inheritAttrs: false,
    setup: (props: Recordable<any>, { attrs, expose, slots }) => {
      const placeholder =
        props?.placeholder ||
        attrs?.placeholder ||
        $t(`ui.placeholder.${type}`);
      // 透传组件暴露的方法
      const innerRef = ref();
      expose(
        new Proxy(
          {},
          {
            get: (_target, key) => innerRef.value?.[key],
            has: (_target, key) => key in (innerRef.value || {}),
          },
        ),
      );
      return () =>
        h(
          component,
          { ...componentProps, placeholder, ...props, ...attrs, ref: innerRef },
          slots,
        );
    },
  });
};

async function initComponentAdapter() {
  const components: Partial<Record<ComponentType, Component>> = {
    // 如果你的组件体积比较大，可以使用异步加载
    // Button: () =>
    // import('xxx').then((res) => res.Button),

    ApiCascader: withDefaultPlaceholder(ApiComponent, 'select', {
      component: Cascader,
      fieldNames: { label: 'label', value: 'value', children: 'children' },
      loadingSlot: 'suffixIcon',
      modelPropName: 'value',
      visibleEvent: 'onVisibleChange',
    }),
    ApiSelect: withDefaultPlaceholder(ApiComponent, 'select', {
      component: Select,
      loadingSlot: 'suffixIcon',
      modelPropName: 'value',
      visibleEvent: 'onVisibleChange',
      popupMatchSelectWidth: false,
    }),
    ApiTreeSelect: withDefaultPlaceholder(ApiComponent, 'select', {
      component: TreeSelect,
      fieldNames: { label: 'label', value: 'value', children: 'children' },
      loadingSlot: 'suffixIcon',
      modelPropName: 'value',
      optionsPropName: 'treeData',
      visibleEvent: 'onVisibleChange',
    }),
    AutoComplete,
    Cascader,
    Checkbox,
    CheckboxGroup,
    DatePicker,
    // 自定义默认按钮
    DefaultButton: (props, { attrs, slots }) => {
      return h(Button, { ...props, attrs, type: 'default' }, slots);
    },
    Divider,
    IconPicker: withDefaultPlaceholder(IconPicker, 'select', {
      iconSlot: 'addonAfter',
      inputComponent: Input,
      modelValueProp: 'value',
    }),
    Input: withDefaultPlaceholder(Input, 'input'),
    InputNumber: withDefaultPlaceholder(InputNumber, 'input', {
      style: { width: '100%' },
    }),
    InputPassword: withDefaultPlaceholder(InputPassword, 'input'),
    Mentions: withDefaultPlaceholder(Mentions, 'input'),
    // 自定义主要按钮
    PrimaryButton: (props, { attrs, slots }) => {
      return h(Button, { ...props, attrs, type: 'primary' }, slots);
    },
    Radio,
    RadioGroup,
    RangePicker,
    Rate,
    RichEditor: withDefaultPlaceholder(VbenTiptap, 'input'),
    Select: withDefaultPlaceholder(Select, 'select', {
      // 触发框默认撑满父容器（与 Input/InputNumber 一致），避免窄列下选项被截断
      style: { width: '100%' },
      // 下拉面板宽度自适应内容，避免触发框过窄时选项被截断
      popupMatchSelectWidth: false,
    }),
    Space,
    Switch,
    Textarea: withDefaultPlaceholder(Textarea, 'input'),
    TimePicker,
    TianaiCaptcha: defineAsyncComponent(
      () => import('#/views/_core/authentication/tianai-captcha.vue'),
    ),
    TreeSelect: withDefaultPlaceholder(TreeSelect, 'select'),
    Upload: withPreviewUpload(),
  };

  // 将组件注册到全局共享状态中
  globalShareState.setComponents(components);

  // 定义全局共享状态中的消息提示
  globalShareState.defineMessage({
    // 复制成功消息提示
    copyPreferencesSuccess: (title, content) => {
      notification.success({
        description: content,
        message: title,
        placement: 'bottomRight',
      });
    },
  });
}

export type { ComponentPropsMap, ComponentType } from './typing';
export { initComponentAdapter };
