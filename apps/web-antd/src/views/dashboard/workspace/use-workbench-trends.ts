import type { WorkbenchTrendItem } from '@vben/common-ui';

import { onMounted, ref } from 'vue';

import { getLatestLogs } from '#/api';
import { $t } from '#/locales';

/** 演示头像池（与快捷导航等共用 svg 头像） */
const DEMO_AVATARS = [
  'svg:avatar-1',
  'svg:avatar-2',
  'svg:avatar-3',
  'svg:avatar-4',
];

/** 演示趋势数据（真实日志不足/失败时的兜底展示） */
const DEMO_TRENDS: WorkbenchTrendItem[] = [
  {
    avatar: 'svg:avatar-1',
    title: $t('page.dashboard.admin'),
    content: $t('page.dashboard.demoTrend1'),
    date: $t('page.dashboard.demoTime1'),
  },
  {
    avatar: 'svg:avatar-2',
    title: $t('page.dashboard.operator'),
    content: $t('page.dashboard.demoTrend2'),
    date: $t('page.dashboard.demoTime2'),
  },
  {
    avatar: 'svg:avatar-3',
    title: $t('page.dashboard.system'),
    content: $t('page.dashboard.demoTrend3'),
    date: $t('page.dashboard.demoTime3'),
  },
];

/** 解析服务端操作时间（兼容 yyyy-MM-dd HH:mm:ss 与 MM/dd/yyyy 两种格式） */
function formatLogTime(raw: string) {
  const m = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})/);
  if (m) {
    const [, year, month, day, hour, minute] = m;
    if (year && month && day) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour ?? ''}:${minute ?? ''}`;
    }
  }
  const m2 = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{1,2})/);
  if (m2) {
    const [, month, day, year, hour, minute] = m2;
    if (year && month && day) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour ?? ''}:${minute ?? ''}`;
    }
  }
  return raw;
}

/**
 * 工作台动态趋势域：拉取最近操作日志转趋势流，真实数据不足时用演示数据
 * 补齐（保持 8 条视觉饱满），失败时展示错误态。
 */
export function useWorkbenchTrends() {
  const trendError = ref(false);
  const trendItems = ref<WorkbenchTrendItem[]>([]);
  const trendLoading = ref(true);
  const trendsLoaded = ref(false);
  const usingDemoTrends = ref(false);

  async function loadTrends() {
    trendError.value = false;
    trendLoading.value = true;
    try {
      const logs = await getLatestLogs(9);
      const real: WorkbenchTrendItem[] = (logs ?? [])
        .filter((log) => log && log.description)
        .map((log, index) => ({
          avatar: DEMO_AVATARS[index % DEMO_AVATARS.length] as string,
          content: `${log.module ? `[${log.module}] ` : ''}${log.description ?? ''}`,
          date: formatLogTime(log.operateTime),
          title:
            (log.operateUserIdName ?? '').trim() ||
            (log.operateUserId ?? '').toString().trim() ||
            $t('page.dashboard.system'),
        }));
      if (real.length >= 8) {
        // 真实数据足够：直接展示
        trendItems.value = real;
        usingDemoTrends.value = false;
      } else if (real.length > 0) {
        // 真实数据不足：真实在前 + 演示数据补齐（保持 8 条，视觉饱满）
        const demo = DEMO_TRENDS.slice(0, 8 - real.length).map((d) => ({
          ...d,
          date: `${d.date}${$t('page.dashboard.demoSuffix')}`,
        }));
        trendItems.value = [...real, ...demo];
        usingDemoTrends.value = true;
      } else {
        // 完全无数据：纯演示数据
        trendItems.value = DEMO_TRENDS;
        usingDemoTrends.value = true;
      }
      trendsLoaded.value = true;
    } catch (error) {
      console.error('Failed to load dashboard latest logs:', error);
      trendError.value = true;
      trendsLoaded.value = false;
    } finally {
      trendLoading.value = false;
    }
  }

  onMounted(() => {
    void loadTrends();
  });

  return {
    loadTrends,
    trendError,
    trendItems,
    trendLoading,
    trendsLoaded,
    usingDemoTrends,
  };
}
