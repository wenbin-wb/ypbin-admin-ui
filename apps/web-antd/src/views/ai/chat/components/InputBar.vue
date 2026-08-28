<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { IconifyIcon, Square } from '@vben/icons';

// vben-ui-dev-exempt: R2 AI 聊天气泡输入区为自定义复合交互（多行输入 + 模型/知识库选择器 + 发送/停止），
// 非 useVbenForm schema 管理场景，直接组合 antd Input.TextArea/Select 属合理形态
import { Button, Input, Select, Tooltip } from 'ant-design-vue';

import { $t } from '#/locales';

defineOptions({ name: 'ChatInputBar' });

const props = withDefaults(
  defineProps<{
    activeKbId?: string;
    activeModelId?: string;
    activeRoleName?: string;
    inputText?: string;
    isStreaming?: boolean;
    knowledgeBases?: AiApi.KnowledgeBase[];
    models?: AiApi.ModelConfig[];
    roleDrawerOpen?: boolean;
  }>(),
  {
    activeKbId: '',
    activeModelId: '',
    activeRoleName: '',
    inputText: '',
    isStreaming: false,
    knowledgeBases: () => [],
    models: () => [],
    roleDrawerOpen: false,
  },
);

const emit = defineEmits<{
  (e: 'send' | 'stop' | 'toggleRole'): void;
  (
    e: 'update:inputText' | 'update:kbId' | 'update:modelId',
    value: string,
  ): void;
}>();

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    emit('send');
  }
}
</script>

<template>
  <!-- ===== 输入区 ===== -->
  <div class="ym-ai__input-wrap">
    <div class="ym-ai__input-box">
      <Input.TextArea
        :model-value="inputText"
        :placeholder="$t('page.ai.chat.placeholder')"
        :auto-size="{ minRows: 1, maxRows: 6 }"
        class="ym-ai__textarea"
        @update:model-value="emit('update:inputText', $event)"
        @keydown="handleKeydown"
      />
      <div class="ym-ai__input-toolbar">
        <!-- 左侧工具 -->
        <div class="ym-ai__tools-left">
          <!-- 角色选择 -->
          <Tooltip :title="$t('page.ai.chat.selectRole')">
            <button
              class="ym-ai__tool-btn"
              :class="{ 'ym-ai__tool-btn--active': roleDrawerOpen }"
              @click="emit('toggleRole')"
            >
              <IconifyIcon icon="lucide:users" class="size-4" />
              <span v-if="activeRoleName" class="ym-ai__tool-label">{{
                activeRoleName
              }}</span>
            </button>
          </Tooltip>
          <!-- 知识库 -->
          <Tooltip
            v-if="knowledgeBases.length > 0"
            :title="$t('page.ai.chat.attachKb')"
          >
            <div>
              <Select
                :model-value="activeKbId"
                :options="[
                  { label: $t('page.ai.chat.noKb'), value: '' },
                  ...knowledgeBases.map((kb) => ({
                    label: `${kb.name}`,
                    value: kb.id,
                  })),
                ]"
                size="small"
                class="ym-ai__kb-select"
                :bordered="false"
                :placeholder="$t('page.ai.chat.attachKbPlaceholder')"
                @update:model-value="emit('update:kbId', $event)"
              />
            </div>
          </Tooltip>
          <!-- 模型 -->
          <Select
            v-if="models.length > 0"
            :model-value="activeModelId"
            :options="
              models
                .filter((m) => m.modelType === 'CHAT' || !m.modelType)
                .map((m) => ({ label: m.modelName, value: m.id }))
            "
            size="small"
            class="ym-ai__model-select"
            :bordered="false"
            @update:model-value="emit('update:modelId', $event)"
          />
        </div>
        <!-- 右侧：发送/停止 -->
        <div class="ym-ai__tools-right">
          <span class="ym-ai__enter-tip">{{
            $t('page.ai.chat.enterTip')
          }}</span>
          <Button
            v-if="isStreaming"
            class="ym-ai__send-btn ym-ai__send-btn--stop"
            type="primary"
            danger
            @click="emit('stop')"
          >
            <Square class="size-3.5" />
            {{ $t('page.ai.chat.stop') }}
          </Button>
          <Button
            v-else
            class="ym-ai__send-btn"
            type="primary"
            :disabled="!inputText.trim()"
            @click="emit('send')"
          >
            {{ $t('page.ai.chat.send') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ================================================================
   输入区
================================================================ */
.ym-ai__input-wrap {
  flex-shrink: 0;
  padding: 12px 16px 14px;
  border-top: 1px solid hsl(var(--border));
}

.ym-ai__input-box {
  padding: 10px 12px 8px;
  background: hsl(var(--background));
  border: 1.5px solid hsl(var(--border));
  border-radius: 12px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.ym-ai__input-box:focus-within {
  border-color: hsl(var(--primary) / 60%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 8%);
}

.ym-ai__textarea {
  width: 100% !important;
  padding: 0 !important;
  font-size: 14px !important;
  resize: none !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.ym-ai__input-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.ym-ai__tools-left {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.ym-ai__tools-right {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.ym-ai__tool-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 3px 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s;
}

.ym-ai__tool-btn:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.ym-ai__tool-btn--active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 30%);
}

.ym-ai__tool-label {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ym-ai__kb-select {
  width: 160px;
  font-size: 12px;
}

.ym-ai__model-select {
  width: 140px;
  font-size: 12px;
}

.ym-ai__enter-tip {
  font-size: 11px;
  color: hsl(var(--muted-foreground) / 70%);
}

.ym-ai__send-btn {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-weight: 500;
}

/* enter-tip 窄屏隐藏 */
@media (max-width: 640px) {
  .ym-ai__enter-tip {
    display: none;
  }
}
</style>
