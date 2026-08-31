/**
 * 组件适配器的类型注册表。
 *
 * 与 index.ts 中注册的组件名一一对应，便于 schema 上 `component` + `componentProps`
 * 的联动类型提示。
 */
import type {
  AutoCompleteProps,
  ButtonProps,
  CascaderProps,
  CheckboxGroupProps,
  CheckboxProps,
  DatePickerProps,
  DividerProps,
  InputNumberProps,
  InputProps,
  MentionsProps,
  RadioGroupProps,
  RadioProps,
  RateProps,
  SelectProps,
  SpaceProps,
  SwitchProps,
  TextAreaProps,
  TimePickerProps,
  TreeSelectProps,
} from 'ant-design-vue';
import type { RangePickerProps } from 'ant-design-vue/es/date-picker';

import type {
  ApiComponentSharedProps,
  BaseFormComponentType,
  IconPickerProps,
} from '@vben/common-ui';
import type { TipTapProps } from '@vben/plugins/tiptap';

import type { AdapterUploadProps } from './upload';

import type { AuthApi } from '#/api/core/auth';

// 这里需要自行根据业务组件库进行适配，需要用到的组件都需要在这里类型说明
export type ComponentType =
  | 'ApiCascader'
  | 'ApiSelect'
  | 'ApiTreeSelect'
  | 'AutoComplete'
  | 'Cascader'
  | 'Checkbox'
  | 'CheckboxGroup'
  | 'DatePicker'
  | 'DefaultButton'
  | 'Divider'
  | 'IconPicker'
  | 'Input'
  | 'InputNumber'
  | 'InputPassword'
  | 'Mentions'
  | 'PrimaryButton'
  | 'Radio'
  | 'RadioGroup'
  | 'RangePicker'
  | 'Rate'
  | 'RichEditor'
  | 'Select'
  | 'Space'
  | 'Switch'
  | 'Textarea'
  | 'TianaiCaptcha'
  | 'TimePicker'
  | 'TreeSelect'
  | 'Upload'
  | BaseFormComponentType;

export interface ComponentPropsMap {
  ApiCascader: ApiComponentSharedProps & CascaderProps;
  ApiSelect: ApiComponentSharedProps & SelectProps;
  ApiTreeSelect: ApiComponentSharedProps & TreeSelectProps;
  AutoComplete: AutoCompleteProps;
  Cascader: CascaderProps;
  Checkbox: CheckboxProps;
  CheckboxGroup: CheckboxGroupProps;
  DatePicker: DatePickerProps;
  DefaultButton: ButtonProps;
  Divider: DividerProps;
  IconPicker: IconPickerProps;
  Input: InputProps;
  InputNumber: InputNumberProps;
  InputPassword: InputProps;
  Mentions: MentionsProps;
  PrimaryButton: ButtonProps;
  Radio: RadioProps;
  RadioGroup: RadioGroupProps;
  RangePicker: RangePickerProps;
  Rate: RateProps;
  RichEditor: TipTapProps;
  Select: SelectProps;
  Space: SpaceProps;
  Switch: SwitchProps;
  Textarea: TextAreaProps;
  TimePicker: TimePickerProps;
  TianaiCaptcha: {
    modelValue?: boolean;
    onVerify?: (payload: { id: string; track: AuthApi.CaptchaTrack }) => void;
    width?: number;
  };
  TreeSelect: TreeSelectProps;
  Upload: AdapterUploadProps;
}
