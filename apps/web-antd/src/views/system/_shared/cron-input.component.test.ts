import type { PropType } from 'vue';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import CronInput from './cron-input.vue';

vi.mock('#/api/system/job', () => ({
  previewJobCron: vi.fn().mockResolvedValue({
    message: '',
    nextExecutionTimes: [],
    valid: true,
    zoneId: 'Asia/Shanghai',
  }),
}));

vi.mock('#/locales', () => ({
  $t: (key: string, args?: string[]) =>
    args ? `${key}:${args.join(',')}` : key,
}));

interface CronInputHostProps {
  [key: string]: unknown;
  modelValue: string;
  onChange: () => void;
  onInput: () => void;
  onUpdateModelValue: (value: string | undefined) => void;
}

const CronInputHost = defineComponent({
  name: 'CronInputHost',
  props: {
    modelValue: { required: true, type: String },
    onChange: { required: true, type: Function as PropType<() => void> },
    onInput: { required: true, type: Function as PropType<() => void> },
    onUpdateModelValue: {
      required: true,
      type: Function as PropType<(value: string | undefined) => void>,
    },
  },
  setup(props) {
    return () =>
      h(CronInput, {
        modelValue: props.modelValue,
        onChange: props.onChange,
        onInput: props.onInput,
        'onUpdate:modelValue': props.onUpdateModelValue,
      });
  },
});

let host: HTMLDivElement | undefined;
let unmount: (() => void) | undefined;

function mountCronInputHost(props: CronInputHostProps): {
  host: HTMLDivElement;
} {
  host = document.createElement('div');
  document.body.append(host);
  const app = createApp(CronInputHost, props);
  app.mount(host);
  unmount = () => app.unmount();
  return { host };
}

afterEach(() => {
  unmount?.();
  host?.remove();
  host = undefined;
  unmount = undefined;
});

describe('cron-input interactions', () => {
  it('keeps field mode changes isolated from form slot listeners', async () => {
    const value = ref('0 0 0 * * ?');
    const onChange = vi.fn();
    const onInput = vi.fn();
    ({ host } = mountCronInputHost({
      modelValue: value.value,
      onChange,
      onInput,
      onUpdateModelValue: (nextValue: string | undefined) => {
        value.value = nextValue ?? '';
      },
    }));
    await nextTick();

    const range = host.querySelector<HTMLInputElement>('input[value="range"]');
    expect(range).not.toBeNull();
    range?.click();
    await nextTick();
    await nextTick();

    expect(onChange).not.toHaveBeenCalled();
    expect(onInput).not.toHaveBeenCalled();
    expect(value.value).toBe('0-1 0 0 * * ?');
    expect(host.querySelectorAll('.ant-input-number')).toHaveLength(2);
  });

  it('shows localized empty-state feedback and updates from the value grid', async () => {
    const value = ref('* 0 0 * * ?');
    const onChange = vi.fn();
    const onInput = vi.fn();
    ({ host } = mountCronInputHost({
      modelValue: value.value,
      onChange,
      onInput,
      onUpdateModelValue: (nextValue: string | undefined) => {
        value.value = nextValue ?? '';
      },
    }));
    await nextTick();

    const specify = host.querySelector<HTMLInputElement>(
      'input[value="specify"]',
    );
    expect(specify).not.toBeNull();
    specify?.click();
    await nextTick();
    await nextTick();

    expect(host.textContent).toContain(
      'system.cron.emptyValues:system.cron.second',
    );
    expect(host.textContent).not.toContain('specified values are empty');
    expect(host.querySelector('select')).toBeNull();

    const valueFive = host.querySelector<HTMLInputElement>(
      '.ant-checkbox-group input[value="5"]',
    );
    expect(valueFive).not.toBeNull();
    valueFive?.click();
    await nextTick();
    await nextTick();

    expect(value.value).toBe('5 0 0 * * ?');
    expect(host.textContent).not.toContain('system.cron.emptyValues');
    expect(onChange).not.toHaveBeenCalled();
    expect(onInput).not.toHaveBeenCalled();
  });
});
