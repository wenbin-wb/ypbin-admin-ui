<script lang="ts" setup>
import type { CronEditorMode, CronFieldState, CronPart } from './cron-input';

import type { SystemJobApi } from '#/api/system/job';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Checkbox,
  CheckboxGroup,
  Input,
  InputNumber,
  RadioButton,
  RadioGroup,
  Spin,
  Tabs,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { previewJobCron } from '#/api/system/job';
import { $t } from '#/locales';

import {
  CRON_PARTS,
  CronValidationError,
  decodeCron,
  defaultCronState,
  PART_RANGE,
  stateToCron,
} from './cron-input';

defineOptions({ inheritAttrs: false });

const modelValue = defineModel<string>();
const editorMode = ref<CronEditorMode>('simple');
const activeTab = ref<CronPart>('second');
const state = ref(defaultCronState());
const advancedValue = ref('');
const modeWarning = ref('');
const previewLoading = ref(false);
const previewResult = ref<SystemJobApi.CronPreviewResp>();
const previewError = ref('');
let previewTimer: ReturnType<typeof setTimeout> | undefined;
let previewSequence = 0;
let lastOutput: string | undefined;

const partLabel = computed<Record<CronPart, string>>(() => ({
  second: $t('system.cron.second'),
  minute: $t('system.cron.minute'),
  hour: $t('system.cron.hour'),
  day: $t('system.cron.day'),
  month: $t('system.cron.month'),
  week: $t('system.cron.week'),
}));

function validationMessage(error: unknown): string {
  if (!(error instanceof CronValidationError)) {
    return $t('system.cron.invalid');
  }
  if (error.code === 'day-week-conflict') {
    return $t('system.cron.dayWeekConflict');
  }
  const label = error.part ? partLabel.value[error.part] : '';
  const key = {
    'empty-values': 'emptyValues',
    'invalid-step': 'invalidStep',
    'out-of-range': 'outOfRange',
    'reversed-range': 'reversedRange',
    'unsupported-syntax': 'unsupportedSyntax',
  }[error.code];
  return $t(`system.cron.${key}`, [label]);
}

const expressionState = computed(() => {
  if (editorMode.value === 'advanced') {
    return { error: '', value: advancedValue.value.trim() };
  }
  try {
    return { error: '', value: stateToCron(state.value) };
  } catch (error) {
    return {
      error: validationMessage(error),
      value: '',
    };
  }
});
const expression = computed(() => expressionState.value.value);
const localError = computed(() => expressionState.value.error);

const modeOptions = computed(() => [
  { label: $t('system.cron.simpleMode'), value: 'simple' },
  { label: $t('system.cron.advancedMode'), value: 'advanced' },
]);

function field(part: CronPart): CronFieldState {
  return state.value[part];
}

function optionsOf(part: CronPart) {
  const { min, max } = PART_RANGE[part];
  return Array.from({ length: max - min + 1 }, (_, index) => min + index).map(
    (value) => ({
      label:
        part === 'week' ? $t(`system.cron.weekday${value}`) : String(value),
      value,
    }),
  );
}

function applyExternalValue(value?: string) {
  modeWarning.value = '';
  if (!value) {
    editorMode.value = 'simple';
    state.value = defaultCronState();
    advancedValue.value = '';
    return;
  }
  const decoded = decodeCron(value);
  editorMode.value = decoded.mode;
  if (decoded.mode === 'simple') state.value = decoded.state;
  else advancedValue.value = decoded.value;
}

function changeMode(mode: CronEditorMode) {
  if (mode === editorMode.value) return;
  if (mode === 'advanced') {
    advancedValue.value = expression.value || modelValue.value || '';
    editorMode.value = 'advanced';
    return;
  }
  const decoded = decodeCron(advancedValue.value);
  if (decoded.mode === 'simple') {
    state.value = decoded.state;
    editorMode.value = 'simple';
    modeWarning.value = '';
  } else {
    modeWarning.value = $t('system.cron.cannotVisualize');
  }
}

async function requestPreview(value: string) {
  const sequence = ++previewSequence;
  previewLoading.value = true;
  previewError.value = '';
  try {
    const result = await previewJobCron(value);
    if (sequence === previewSequence) previewResult.value = result;
  } catch (error) {
    if (sequence === previewSequence) {
      previewResult.value = undefined;
      previewError.value =
        error instanceof Error
          ? error.message
          : $t('system.cron.previewFailed');
    }
  } finally {
    if (sequence === previewSequence) previewLoading.value = false;
  }
}

function schedulePreview(value: string) {
  if (previewTimer) clearTimeout(previewTimer);
  previewResult.value = undefined;
  previewError.value = '';
  if (!value || localError.value) return;
  previewTimer = setTimeout(() => requestPreview(value), 400);
}

async function validate(): Promise<boolean> {
  const value = expression.value;
  if (!value || localError.value) return false;
  await requestPreview(value);
  return previewResult.value?.valid === true;
}

watch(
  () => modelValue.value,
  (value) => {
    if (value === lastOutput) return;
    applyExternalValue(value);
    schedulePreview(value?.trim() ?? '');
  },
  { immediate: true },
);

watch(expression, (value) => {
  if (editorMode.value === 'simple' && localError.value) {
    schedulePreview('');
    return;
  }
  if (value === modelValue.value) return;
  lastOutput = value;
  modelValue.value = value;
  schedulePreview(value);
});

onBeforeUnmount(() => {
  previewSequence++;
  if (previewTimer) clearTimeout(previewTimer);
});

defineExpose({ validate });
</script>

<template>
  <div class="w-full space-y-3">
    <RadioGroup
      :value="editorMode"
      button-style="solid"
      :options="modeOptions"
      @change="(event) => changeMode(event.target.value)"
    />

    <template v-if="editorMode === 'simple'">
      <Tabs v-model:active-key="activeTab" size="small">
        <Tabs.TabPane
          v-for="part in CRON_PARTS"
          :key="part"
          :tab="partLabel[part]"
        >
          <div class="flex min-h-24 flex-col gap-3 py-2">
            <RadioGroup v-model:value="field(part).mode" button-style="solid">
              <RadioButton value="every">
                {{ $t('system.cron.every') }}
              </RadioButton>
              <RadioButton value="range">
                {{ $t('system.cron.range') }}
              </RadioButton>
              <RadioButton value="step">
                {{ $t('system.cron.step') }}
              </RadioButton>
              <RadioButton value="specify">
                {{ $t('system.cron.specify') }}
              </RadioButton>
            </RadioGroup>

            <div
              v-if="field(part).mode === 'range'"
              class="flex items-center gap-2"
            >
              <InputNumber
                v-model:value="field(part).rangeStart"
                :min="PART_RANGE[part].min"
                :max="PART_RANGE[part].max"
              />
              <span>-</span>
              <InputNumber
                v-model:value="field(part).rangeEnd"
                :min="PART_RANGE[part].min"
                :max="PART_RANGE[part].max"
              />
            </div>

            <div
              v-else-if="field(part).mode === 'step'"
              class="flex items-center gap-2"
            >
              <span>{{ $t('system.cron.stepFrom') }}</span>
              <InputNumber
                v-model:value="field(part).stepStart"
                :min="PART_RANGE[part].min"
                :max="PART_RANGE[part].max"
              />
              <span>{{ $t('system.cron.stepEvery') }}</span>
              <InputNumber
                v-model:value="field(part).stepValue"
                :min="1"
                :max="PART_RANGE[part].max"
              />
            </div>

            <CheckboxGroup
              v-else-if="field(part).mode === 'specify'"
              v-model:value="field(part).values"
              class="grid w-full gap-x-3 gap-y-2"
              :class="
                part === 'week'
                  ? 'grid-cols-[repeat(auto-fit,minmax(110px,1fr))]'
                  : 'grid-cols-[repeat(auto-fit,minmax(44px,1fr))]'
              "
            >
              <Checkbox
                v-for="option in optionsOf(part)"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </Checkbox>
            </CheckboxGroup>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </template>

    <template v-else>
      <Input
        v-model:value="advancedValue"
        :placeholder="$t('system.cron.advancedPlaceholder')"
      />
      <Alert
        class="mt-2"
        :message="$t('system.cron.advancedTip')"
        show-icon
        type="info"
      />
    </template>

    <Alert v-if="modeWarning" :message="modeWarning" show-icon type="warning" />
    <Alert v-if="localError" :message="localError" show-icon type="error" />

    <div class="bg-accent rounded px-3 py-2 text-sm">
      <span class="text-foreground/60">
        {{ $t('system.cron.expression') }}：
      </span>
      <code class="font-mono">{{ expression || '-' }}</code>
    </div>

    <Spin :spinning="previewLoading">
      <Alert
        v-if="previewError"
        :message="previewError"
        show-icon
        type="error"
      />
      <Alert
        v-else-if="previewResult && !previewResult.valid"
        :message="previewResult.message"
        show-icon
        type="error"
      />
      <div
        v-else-if="previewResult?.valid"
        class="border-border rounded border px-3 py-2 text-sm"
      >
        <div class="mb-1 font-medium">
          {{ $t('system.cron.nextExecutions') }}
          <span class="text-foreground/50 font-normal">
            ({{ previewResult.zoneId }})
          </span>
        </div>
        <ol class="text-foreground/70 list-inside list-decimal space-y-0.5">
          <li v-for="time in previewResult.nextExecutionTimes" :key="time">
            {{ dayjs(time).format('YYYY-MM-DD HH:mm:ss') }}
          </li>
        </ol>
      </div>
    </Spin>
  </div>
</template>
