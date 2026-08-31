/**
 * Ant Design Vue 组件的异步加载注册表。
 *
 * 统一收敛 `ant-design-vue/es/xxx` 的按需异步引入，供组件适配器（form/modal/drawer
 * 等 schema 驱动场景）使用，避免在业务代码中散落 import 路径。
 */
import { defineAsyncComponent } from 'vue';

export const AutoComplete = defineAsyncComponent(
  () => import('ant-design-vue/es/auto-complete'),
);
export const Button = defineAsyncComponent(
  () => import('ant-design-vue/es/button'),
);
export const Checkbox = defineAsyncComponent(
  () => import('ant-design-vue/es/checkbox'),
);
export const CheckboxGroup = defineAsyncComponent(() =>
  import('ant-design-vue/es/checkbox').then((res) => res.CheckboxGroup),
);
export const DatePicker = defineAsyncComponent(
  () => import('ant-design-vue/es/date-picker'),
);
export const Divider = defineAsyncComponent(
  () => import('ant-design-vue/es/divider'),
);
export const Input = defineAsyncComponent(
  () => import('ant-design-vue/es/input'),
);
export const InputNumber = defineAsyncComponent(
  () => import('ant-design-vue/es/input-number'),
);
export const InputPassword = defineAsyncComponent(() =>
  import('ant-design-vue/es/input').then((res) => res.InputPassword),
);
export const Mentions = defineAsyncComponent(
  () => import('ant-design-vue/es/mentions'),
);
export const Radio = defineAsyncComponent(
  () => import('ant-design-vue/es/radio'),
);
export const RadioGroup = defineAsyncComponent(() =>
  import('ant-design-vue/es/radio').then((res) => res.RadioGroup),
);
export const RangePicker = defineAsyncComponent(() =>
  import('ant-design-vue/es/date-picker').then((res) => res.RangePicker),
);
export const Rate = defineAsyncComponent(
  () => import('ant-design-vue/es/rate'),
);
export const Select = defineAsyncComponent(
  () => import('ant-design-vue/es/select'),
);
export const Space = defineAsyncComponent(
  () => import('ant-design-vue/es/space'),
);
export const Switch = defineAsyncComponent(
  () => import('ant-design-vue/es/switch'),
);
export const Textarea = defineAsyncComponent(() =>
  import('ant-design-vue/es/input').then((res) => res.Textarea),
);
export const TimePicker = defineAsyncComponent(
  () => import('ant-design-vue/es/time-picker'),
);
export const TreeSelect = defineAsyncComponent(
  () => import('ant-design-vue/es/tree-select'),
);
export const Cascader = defineAsyncComponent(
  () => import('ant-design-vue/es/cascader'),
);
export const Upload = defineAsyncComponent(
  () => import('ant-design-vue/es/upload'),
);
export const Image = defineAsyncComponent(
  () => import('ant-design-vue/es/image'),
);
export const PreviewGroup = defineAsyncComponent(() =>
  import('ant-design-vue/es/image').then((res) => res.ImagePreviewGroup),
);
