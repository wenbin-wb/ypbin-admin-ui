<script lang="ts" setup>
import type { SystemTrackingApi } from '#/api/system/tracking';

import { computed } from 'vue';

import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Empty, Spin } from 'ant-design-vue';

import { $t } from '#/locales';

import { clockTime, eventDomain, isFailed } from '../meta';

const props = defineProps<{
  events: SystemTrackingApi.TrackEvent[];
  loading: boolean;
}>();

const emit = defineEmits<{ select: [event: SystemTrackingApi.TrackEvent] }>();

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
    group.events.toSorted((a, b) =>
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

function sessionLabel(sessionId?: string): string {
  if (!sessionId) {
    return $t('tracking.events.noSession');
  }
  return sessionId.length > 12 ? `${sessionId.slice(0, 12)}…` : sessionId;
}

function eventName(eventCode: string): string {
  return TRACKING_EVENT_CATALOG[eventCode]?.description ?? eventCode;
}
</script>

<template>
  <Spin :spinning="loading">
    <Empty
      v-if="!loading && groups.length === 0"
      :description="$t('common.noData')"
    />
    <div v-else class="flex flex-col gap-3 overflow-auto">
      <div
        v-for="group in groups"
        :key="group.key"
        class="rounded-lg border bg-card"
      >
        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-3 py-2 text-xs"
        >
          <span class="font-medium">
            {{
              $t('tracking.events.sessionGroup', [
                sessionLabel(group.sessionId),
              ])
            }}
          </span>
          <span class="text-muted-foreground">{{ group.userText }}</span>
          <span class="text-muted-foreground">
            {{
              $t('tracking.events.sessionEventsCount', [group.events.length])
            }}
          </span>
          <span class="ml-auto text-muted-foreground">
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
            <span class="min-w-0 flex-1 truncate">
              {{ eventName(event.eventCode) }}
            </span>
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
