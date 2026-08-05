<script lang="ts" setup>
import type { CronFieldState, CronPart } from './cron-input';

import { computed, ref, watch } from 'vue';

import { InputNumber, RadioButton, RadioGroup, Tabs } from 'ant-design-vue';

import { $t } from '#/locales';

import { CRON_PARTS, cronToState, PART_RANGE, stateToCron } from './cron-input';

/** v-model 绑定 cron 字符串（Spring 6 段） */
const modelValue = defineModel<string>();

const state = ref(cronToState(modelValue.value ?? '0 * * * * ?'));
const activeTab = ref<CronPart>('second');

// 段标签
const partLabel: Record<CronPart, string> = {
  second: $t('system.cron.second'),
  minute: $t('system.cron.minute'),
  hour: $t('system.cron.hour'),
  day: $t('system.cron.day'),
  month: $t('system.cron.month'),
  week: $t('system.cron.week'),
};

const expression = computed(() => stateToCron(state.value));

// 状态变化 → 回写 v-model
watch(
  expression,
  (val) => {
    if (val !== modelValue.value) {
      modelValue.value = val;
    }
  },
  { immediate: true },
);

// 外部值变化（如编辑回显）→ 重新解析
watch(
  () => modelValue.value,
  (val) => {
    if (val && val !== expression.value) {
      state.value = cronToState(val);
    }
  },
);

function field(part: CronPart): CronFieldState {
  return state.value[part];
}

/** 指定模式的候选值 */
function optionsOf(part: CronPart): number[] {
  const { min, max } = PART_RANGE[part];
  const arr: number[] = [];
  for (let i = min; i <= max; i++) arr.push(i);
  return arr;
}

function toggleValue(part: CronPart, v: number) {
  const f = state.value[part];
  const idx = f.values.indexOf(v);
  if (idx === -1) f.values.push(v);
  else f.values.splice(idx, 1);
}
</script>
<template>
  <div class="cron-input">
    <Tabs v-model:active-key="activeTab" size="small">
      <Tabs.TabPane
        v-for="part in CRON_PARTS"
        :key="part"
        :tab="partLabel[part]"
      >
        <div class="flex flex-col gap-3 py-2">
          <RadioGroup v-model:value="field(part).mode" button-style="solid">
            <RadioButton value="every">
              {{ $t('system.cron.every') }}
            </RadioButton>
            <RadioButton value="range">
              {{ $t('system.cron.range') }}
            </RadioButton>
            <RadioButton value="step">{{ $t('system.cron.step') }}</RadioButton>
            <RadioButton value="specify">
              {{ $t('system.cron.specify') }}
            </RadioButton>
          </RadioGroup>

          <!-- 区间 -->
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

          <!-- 步长 -->
          <div
            v-if="field(part).mode === 'step'"
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

          <!-- 指定多值 -->
          <div
            v-if="field(part).mode === 'specify'"
            class="flex flex-wrap gap-1"
          >
            <span
              v-for="v in optionsOf(part)"
              :key="v"
              class="cursor-pointer rounded border px-2 py-0.5 text-xs"
              :class="
                field(part).values.includes(v)
                  ? 'border-primary bg-primary text-white'
                  : 'border-border'
              "
              @click="toggleValue(part, v)"
            >
              {{ v }}
            </span>
          </div>
        </div>
      </Tabs.TabPane>
    </Tabs>

    <div class="bg-accent mt-2 rounded px-3 py-2 text-sm">
      <span class="text-foreground/60">{{ $t('system.cron.expression') }}：</span>
      <code class="font-mono">{{ expression }}</code>
    </div>
  </div>
</template>
