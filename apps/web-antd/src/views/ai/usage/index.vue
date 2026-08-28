<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Col, Empty, Row, Skeleton } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getAiStatsDaily,
  getAiStatsHotQueries,
  getAiStatsKbDocs,
  getAiStatsSummary,
  getUsageByModel,
} from '#/api/ai';
import { $t } from '#/locales';

import { useModelColumns } from './data';

defineOptions({ name: 'AiUsage' });

// ---- 统一视觉色板（与 vben 主题/内置色板一致）----
// 品牌渐变：primary(蓝 212) → 靛紫(245)，用于所有强调元素
const BRAND_GRAD =
  'linear-gradient(135deg, hsl(var(--primary)), hsl(245 82% 67%))';
const BRAND_GLOW = 'hsl(var(--primary) / 28%)';
// 进度条渐变（品牌横向渐变）
const BAR_GRAD =
  'linear-gradient(90deg, hsl(var(--primary)), hsl(245 82% 67%))';
// 奖牌语义色（金/银/铜，全局惯例）
const MEDAL_GRADS = [
  'linear-gradient(135deg, hsl(45 93% 47%), hsl(38 92% 50%))',
  'linear-gradient(135deg, hsl(215 13% 47%), hsl(217 13% 55%))',
  'linear-gradient(135deg, hsl(28 87% 50%), hsl(25 90% 52%))',
];
const MEDAL_GLOWS = [
  'hsl(45 93% 47% / 35%)',
  'hsl(215 13% 47% / 30%)',
  'hsl(28 87% 50% / 30%)',
];

const loading = ref(false);
const summary = ref({
  kbCount: 0,
  docTotal: 0,
  chatCount: 0,
  queryCount: 0,
  tokenTotal: 0,
});

const daily = ref<
  Array<{ date: string; chatCount: number; queryCount: number; tokenCount: number }>
>([]);
const hotQueries = ref<Array<{ query: string; count: number }>>([]);
const kbDocs = ref<Array<{ name: string; docCount: number }>>([]);

// 归一化基准（至少 1，避免除零）
const maxDaily = computed(() =>
  Math.max(1, ...daily.value.map((d) => Math.max(d.chatCount, d.queryCount))),
);
const maxHot = computed(() => Math.max(1, ...hotQueries.value.map((h) => h.count)));
const maxKbDocs = computed(() =>
  Math.max(1, ...kbDocs.value.map((k) => k.docCount)),
);
const totalDaily = computed(() =>
  daily.value.reduce((s, d) => s + d.chatCount + d.queryCount, 0),
);
// 30 天汇总（问答/检索/Token）
const sumChat = computed(() =>
  daily.value.reduce((s, d) => s + d.chatCount, 0),
);
const sumQuery = computed(() =>
  daily.value.reduce((s, d) => s + d.queryCount, 0),
);
const sumToken = computed(() =>
  daily.value.reduce((s, d) => s + d.tokenCount, 0),
);
// 文档分布总数
const kbDocsTotal = computed(() =>
  kbDocs.value.reduce((s, k) => s + k.docCount, 0),
);

// ---- 概览指标（统一品牌渐变图标，仅图标区分语义）----
const metrics = computed(() => [
  {
    key: 'kbCount',
    label: $t('page.ai.usage.kbCount'),
    value: summary.value.kbCount,
    icon: 'i-lucide-database',
  },
  {
    key: 'docTotal',
    label: $t('page.ai.usage.docTotal'),
    value: summary.value.docTotal,
    icon: 'i-lucide-file-text',
  },
  {
    key: 'chatCount',
    label: $t('page.ai.usage.chatCount'),
    value: summary.value.chatCount,
    icon: 'i-lucide-message-square',
  },
  {
    key: 'queryCount',
    label: $t('page.ai.usage.queryCount'),
    value: summary.value.queryCount,
    icon: 'i-lucide-search',
  },
  {
    key: 'tokenTotal',
    label: $t('page.ai.usage.totalTokens'),
    value: summary.value.tokenTotal,
    icon: 'i-lucide-zap',
  },
]);

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// 数字滚动动画（rAF countup）：value 变化时从旧值渐变到新值
const displayed = ref<Record<string, number>>({});
let rafId = 0;
function animateMetric(key: string, target: number) {
  cancelAnimationFrame(rafId);
  const from = displayed.value[key] ?? 0;
  if (from === target) {
    displayed.value[key] = target;
    return;
  }
  const start = performance.now();
  const duration = 600;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    displayed.value[key] = Math.round(from + (target - from) * eased);
    if (t < 1) rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function displayValue(m: (typeof metrics.value)[number]) {
  const raw = displayed.value[m.key] ?? 0;
  return m.key === 'tokenTotal' ? formatTokens(raw) : String(raw);
}

function barPct(value: number, max: number) {
  return `${Math.max(2, Math.round((value / max) * 100))}%`;
}

function showTick(i: number) {
  return i % 5 === 0 || i === daily.value.length - 1;
}

function medal(i: number) {
  return i < 3 ? MEDAL_GRADS[i] : 'hsl(var(--muted-foreground) / 25%)';
}
function medalGlow(i: number) {
  return i < 3 ? MEDAL_GLOWS[i] : 'transparent';
}

async function loadStats() {
  loading.value = true;
  try {
    const [s, d, h, k] = await Promise.all([
      getAiStatsSummary(),
      getAiStatsDaily(30),
      getAiStatsHotQueries(10),
      getAiStatsKbDocs(),
    ]);
    summary.value = s;
    metrics.value.forEach((m) => animateMetric(m.key, m.value));
    daily.value = d;
    hotQueries.value = h;
    kbDocs.value = k;
  } finally {
    loading.value = false;
  }
}

// 按模型分布表
const [ModelGrid] = useVbenVxeGrid({
  gridOptions: {
    columns: useModelColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          const items = await getUsageByModel();
          const total = items.reduce((sum, m) => sum + m.tokens, 0);
          return {
            items: items.map((m) => ({
              ...m,
              percent: total > 0 ? Math.round((m.tokens / total) * 100) : 0,
            })),
            total: items.length,
          };
        },
      },
    },
    rowConfig: { keyField: 'model' },
    toolbarConfig: {
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<{ model: string; percent: number; tokens: number }>,
});

onMounted(loadStats);
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-5 p-5">
      <!-- ===== 概览指标卡（统一品牌渐变）===== -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div
          v-for="(m, i) in metrics"
          :key="m.key"
          class="metric-card group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4"
          :style="{ '--glow': BRAND_GLOW, animationDelay: `${i * 60}ms` }"
        >
          <span
            class="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
            :style="{ background: BRAND_GRAD }"
          ></span>
          <div class="relative">
            <div
              class="inline-flex size-9 items-center justify-center rounded-lg text-white shadow-lg"
              :style="{ background: BRAND_GRAD, boxShadow: `0 6px 16px ${BRAND_GLOW}` }"
            >
              <span :class="`${m.icon} size-[18px]`"></span>
            </div>
            <p class="mt-3 truncate text-xs text-muted-foreground">{{ m.label }}</p>
            <p
              class="mt-1 truncate text-[26px] font-bold tabular-nums leading-tight tracking-tight"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
            >
              <Skeleton
                v-if="loading"
                :paragraph="false"
                :title="{ width: 60 }"
                active
                class="!w-16"
              />
              <template v-else>{{ displayValue(m) }}</template>
            </p>
          </div>
        </div>
      </div>

      <!-- ===== 趋势 + 热词 ===== -->
      <Row :gutter="[16, 16]">
        <Col :xs="24" :lg="16">
          <div class="panel-card relative overflow-hidden rounded-xl border border-border/80 bg-card p-5">
            <span
              class="pointer-events-none absolute -left-10 -top-10 size-32 rounded-full opacity-25 blur-3xl"
              :style="{ background: 'hsl(var(--primary) / 40%)' }"
            ></span>
            <div class="relative">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold">{{ $t('page.ai.usage.trend') }}</h3>
                <div
                  v-if="totalDaily > 0"
                  class="flex items-center gap-2 text-[11px] text-muted-foreground"
                >
                  <span class="flex items-center gap-1">
                    <span class="size-1.5 rounded-full bg-[hsl(245_82%_67%)]"></span>
                    {{ $t('page.ai.usage.trendChat') }} {{ sumChat }}
                  </span>
                  <span class="flex items-center gap-1">
                    <span class="size-1.5 rounded-full bg-[hsl(var(--primary)_/_45%)]"></span>
                    {{ $t('page.ai.usage.trendQuery') }} {{ sumQuery }}
                  </span>
                  <span
                    class="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
                    >{{ formatTokens(sumToken) }} tokens</span
                  >
                </div>
              </div>
              <div v-if="loading" class="mt-4">
                <Skeleton :paragraph="{ rows: 6 }" active />
              </div>
              <template v-else-if="totalDaily > 0">
                <div class="mt-4 flex h-44 items-end gap-[3px]">
                  <div
                    v-for="d in daily"
                    :key="d.date"
                    class="group relative flex h-full flex-1 flex-col justify-end gap-[2px]"
                    :title="`${d.date} ${$t('page.ai.usage.trendQuery')}: ${d.queryCount} / ${$t('page.ai.usage.trendChat')}: ${d.chatCount}`"
                  >
                    <div
                      class="w-full rounded-t-[3px] transition-all duration-200 group-hover:brightness-125"
                      :style="{
                        background: `linear-gradient(to top, hsl(var(--primary) / 55%), hsl(var(--primary) / 25%))`,
                        height: barPct(d.queryCount, maxDaily),
                      }"
                    ></div>
                    <div
                      class="w-full rounded-t-[3px] transition-all duration-200 group-hover:brightness-125"
                      :style="{
                        background: `linear-gradient(to top, hsl(245 82% 67% / 90%), hsl(245 82% 67% / 45%))`,
                        height: barPct(d.chatCount, maxDaily),
                        boxShadow: '0 0 10px hsl(245 82% 67% / 25%)',
                      }"
                    ></div>
                  </div>
                </div>
                <div class="mt-1.5 flex">
                  <span
                    v-for="(d, i) in daily"
                    :key="d.date"
                    class="flex-1 text-center text-[10px] leading-none text-muted-foreground"
                    :class="showTick(i) ? '' : 'invisible'"
                    >{{ d.date.slice(5) }}</span
                  >
                </div>
                <div
                  class="mt-3 flex items-center gap-5 border-t border-border pt-3 text-xs text-muted-foreground"
                >
                  <span class="flex items-center gap-1.5">
                    <span
                      class="size-2 rounded-sm"
                      :style="{ background: 'hsl(245 82% 67%)' }"
                    ></span>
                    {{ $t('page.ai.usage.trendChat') }}
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="size-2 rounded-sm"
                      :style="{ background: 'hsl(var(--primary) / 40%)' }"
                    ></span>
                    {{ $t('page.ai.usage.trendQuery') }}
                  </span>
                </div>
              </template>
              <Empty v-else :description="$t('page.ai.usage.hotEmpty')" class="py-10" />
            </div>
          </div>
        </Col>

        <Col :xs="24" :lg="8">
          <div class="panel-card rounded-xl border border-border/80 bg-card p-5">
            <h3 class="text-sm font-semibold">{{ $t('page.ai.usage.hotQueries') }}</h3>
            <div v-if="loading" class="mt-4">
              <Skeleton :paragraph="{ rows: 6 }" active />
            </div>
            <template v-else-if="hotQueries.length">
              <div class="mt-2 flex flex-col">
                <div
                  v-for="(h, i) in hotQueries"
                  :key="h.query"
                  class="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
                >
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white tabular-nums"
                    :style="{
                      background: medal(i),
                      boxShadow: `0 3px 8px ${medalGlow(i)}`,
                    }"
                    >{{ i + 1 }}</span
                  >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate text-[13px] font-medium">{{
                        h.query
                      }}</span>
                      <span
                        class="shrink-0 text-xs text-muted-foreground tabular-nums"
                        >{{ h.count }}</span
                      >
                    </div>
                    <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/60">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        :style="{
                          width: barPct(h.count, maxHot),
                          background: BAR_GRAD,
                          boxShadow:
                            i === 0 ? '0 0 8px hsl(var(--primary) / 35%)' : 'none',
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <Empty v-else :description="$t('page.ai.usage.hotEmpty')" class="py-10" />
          </div>
        </Col>
      </Row>

      <!-- ===== 文档分布 + 按模型分布 ===== -->
      <Row :gutter="[16, 16]">
        <Col :xs="24" :lg="12">
          <div class="panel-card rounded-xl border border-border/80 bg-card p-5">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">
                {{ $t('page.ai.usage.kbDistribution') }}
              </h3>
              <span
                v-if="kbDocs.length"
                class="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                >{{ $t('page.ai.usage.totalSuffix', [kbDocsTotal, $t('page.ai.usage.docsUnit')]) }}</span
              >
            </div>
            <div v-if="loading" class="mt-4">
              <Skeleton :paragraph="{ rows: 5 }" active />
            </div>
            <template v-else-if="kbDocs.length">
              <div class="mt-3 flex flex-col gap-3.5">
                <div v-for="k in kbDocs" :key="k.name" class="flex items-center gap-3">
                  <span class="w-32 shrink-0 truncate text-[13px]">{{ k.name }}</span>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :style="{ width: barPct(k.docCount, maxKbDocs), background: BAR_GRAD }"
                    ></div>
                  </div>
                  <span
                    class="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
                  >
                    {{ k.docCount }} {{ $t('page.ai.usage.docsUnit') }}
                  </span>
                </div>
              </div>
            </template>
            <Empty v-else :description="$t('page.ai.usage.kbEmpty')" class="py-10" />
          </div>
        </Col>

        <Col :xs="24" :lg="12">
          <div class="panel-card rounded-xl border border-border/80 bg-card p-5">
            <h3 class="text-sm font-semibold">{{ $t('page.ai.usage.byModel') }}</h3>
            <div class="mt-3">
              <ModelGrid>
                <template #modelTokens="{ row }">
                  <span class="tabular-nums font-medium">{{
                    formatTokens(row.tokens)
                  }}</span>
                </template>
                <template #percent="{ row }">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
                      >{{ row.percent }}%</span
                    >
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        :style="{
                          width: `${Math.min(100, Math.max(0, row.percent))}%`,
                          background: BAR_GRAD,
                        }"
                      ></div>
                    </div>
                  </div>
                </template>
              </ModelGrid>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  </Page>
</template>

<style scoped>
/* 指标卡：入场渐显 + hover 发光描边 */
.metric-card {
  animation: metric-in 0.4s ease-out both;
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}
.metric-card:hover {
  transform: translateY(-2px);
  border-color: hsl(var(--primary) / 45%);
  box-shadow:
    0 8px 24px hsl(var(--foreground) / 8%),
    0 0 24px var(--glow);
}
@keyframes metric-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* 面板卡：hover 轻微上浮 */
.panel-card {
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}
.panel-card:hover {
  transform: translateY(-1px);
  border-color: hsl(var(--primary) / 30%);
  box-shadow: 0 6px 20px hsl(var(--foreground) / 6%);
}
</style>
