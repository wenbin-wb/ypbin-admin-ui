<script lang="ts" setup>
import type { SystemTrackingApi } from '#/api/system/tracking';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Button, Empty, message, Spin } from 'ant-design-vue';

import { $t } from '#/locales';

import { copyToClipboard } from '../clipboard';
import { clockTime, eventDomain, isFailed } from '../meta';
import { usePageTitle } from '../use-page-title';

const props = defineProps<{
  events: SystemTrackingApi.TrackEvent[];
  loading: boolean;
}>();

const emit = defineEmits<{ select: [event: SystemTrackingApi.TrackEvent] }>();

const { pageTitle } = usePageTitle();

interface SessionGroup {
  key: string;
  sessionId?: string;
  userText: string;
  events: SystemTrackingApi.TrackEvent[];
  startTime?: string;
  endTime?: string;
}

/**
 * 按会话分组，组内按接收时间升序。
 *
 * 没有 sessionId 的事件（老数据/异常上报）按单条成组：归组会掩盖「这些事件本没有会话」。
 */
const groups = computed<SessionGroup[]>(() => {
  const bySession = new Map<string, SessionGroup>();
  for (const event of props.events) {
    const key = event.sessionId ?? `__no_session__${event.id}`;
    let group = bySession.get(key);
    if (!group) {
      group = {
        key,
        sessionId: event.sessionId,
        userText:
          event.userIdName ||
          event.userId ||
          event.anonId ||
          $t('tracking.events.anonymous'),
        events: [],
      };
      bySession.set(key, group);
    }
    group.events.push(event);
  }
  const result = [...bySession.values()];
  for (const group of result) {
    group.events = group.events.toSorted((a, b) =>
      (a.receivedTime ?? '').localeCompare(b.receivedTime ?? ''),
    );
    group.startTime = group.events[0]?.receivedTime;
    group.endTime = group.events.at(-1)?.receivedTime;
  }
  // 组间按最近一条事件倒序：排查时先看刚刚发生的会话
  return result.toSorted((a, b) =>
    (b.endTime ?? '').localeCompare(a.endTime ?? ''),
  );
});

function eventName(eventCode: string): string {
  return TRACKING_EVENT_CATALOG[eventCode]?.description ?? eventCode;
}

/** 页面标题；未命中菜单树时回退原始路径 */
function pageText(event: SystemTrackingApi.TrackEvent): string {
  return pageTitle(event.pageUrl) || event.pageUrl || '-';
}

async function copySessionId(sessionId?: string) {
  if (!sessionId) {
    return;
  }
  try {
    await copyToClipboard(sessionId);
    message.success($t('common.copySuccess'));
  } catch (error) {
    console.error('Failed to copy sessionId:', error);
    message.error($t('common.copyFailed'));
  }
}
</script>

<template>
  <Spin :spinning="loading">
    <Empty
      v-if="!loading && groups.length === 0"
      :description="$t('common.noData')"
    />
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="group in groups"
        :key="group.key"
        class="rounded-lg border bg-card"
      >
        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-3 py-2 text-xs"
        >
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="shrink-0 font-medium">
              {{ $t('tracking.events.sessionLabel') }}
            </span>
            <code
              class="break-all font-mono text-muted-foreground"
              :title="group.sessionId ?? $t('tracking.events.noSession')"
            >
              {{ group.sessionId ?? $t('tracking.events.noSession') }}
            </code>
            <Button
              v-if="group.sessionId"
              v-access:code="['system:track:list']"
              :title="$t('tracking.events.copySessionId')"
              size="small"
              type="text"
              @click.stop="copySessionId(group.sessionId)"
            >
              <IconifyIcon icon="lucide:copy" class="size-3.5" />
            </Button>
          </span>
          <span class="text-muted-foreground">{{ group.userText }}</span>
          <span class="text-muted-foreground">
            {{
              $t('tracking.events.sessionEventsCount', [group.events.length])
            }}
          </span>
          <span class="ml-auto shrink-0 text-muted-foreground tabular-nums">
            {{ clockTime(group.startTime) }} – {{ clockTime(group.endTime) }}
          </span>
        </div>
        <ul class="divide-y">
          <li
            v-for="event in group.events"
            :key="event.id"
            class="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
            @click="emit('select', event)"
          >
            <span class="w-16 shrink-0 font-mono text-xs text-muted-foreground">
              {{ clockTime(event.receivedTime) }}
            </span>
            <span
              class="size-2 shrink-0 rounded-full"
              :class="eventDomain(event.eventCode).dotClass"
            ></span>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate">{{ eventName(event.eventCode) }}</span>
              <span
                class="truncate text-xs text-muted-foreground"
                :title="event.pageUrl"
              >
                {{ pageText(event) }}
              </span>
            </div>
            <span
              v-if="isFailed(event)"
              class="shrink-0 text-xs font-medium text-destructive"
            >
              {{ $t('tracking.events.fail') }}
            </span>
            <span
              v-if="event.durationMs"
              class="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground"
            >
              {{ event.durationMs }} ms
            </span>
          </li>
        </ul>
      </div>
    </div>
  </Spin>
</template>
