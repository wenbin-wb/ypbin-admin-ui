<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { nextTick, onMounted, ref } from 'vue';

import {
  chat,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  renameConversation,
} from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiChat' });

const conversations = ref<AiApi.Conversation[]>([]);
const activeConvId = ref<string>('');
const messages = ref<AiApi.Message[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const msgListRef = ref<HTMLElement>();

async function loadConversations() {
  conversations.value = await listConversations();
}

async function handleNewChat() {
  const conv = await createConversation();
  conversations.value.unshift(conv);
  await selectConversation(conv.id);
}

async function selectConversation(id: string) {
  activeConvId.value = id;
  const data = await listMessages(id, { page: 1, pageSize: 100 });
  messages.value = data.items ?? [];
  await scrollToBottom();
}

async function handleDeleteConv(id: string) {
  await deleteConversation(id);
  conversations.value = conversations.value.filter((c) => c.id !== id);
  if (activeConvId.value === id) {
    activeConvId.value = '';
    messages.value = [];
  }
}

async function handleSendWithStream() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  if (!activeConvId.value) {
    const conv = await createConversation();
    conversations.value.unshift(conv);
    activeConvId.value = conv.id;
  }

  messages.value.push({
    id: Date.now().toString(),
    conversationId: activeConvId.value,
    role: 'user',
    content: text,
    tokens: 0,
    createTime: new Date().toISOString(),
  });
  inputText.value = '';
  await scrollToBottom();

  const assistantMsg: AiApi.Message = {
    id: 'streaming',
    conversationId: activeConvId.value,
    role: 'assistant',
    content: '',
    tokens: 0,
    createTime: new Date().toISOString(),
  };
  messages.value.push(assistantMsg);
  isStreaming.value = true;

  try {
    await chat(
      { conversationId: activeConvId.value, message: text },
      (token: string) => {
        assistantMsg.content += token;
        scrollToBottom();
      },
      async () => {
        isStreaming.value = false;
        assistantMsg.id = Date.now().toString();
        await loadConversations();
      },
    );
  } catch {
    assistantMsg.content = '请求出错，请重试。';
    isStreaming.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendWithStream();
  }
}

async function scrollToBottom() {
  await nextTick();
  if (msgListRef.value) {
    msgListRef.value.scrollTop = msgListRef.value.scrollHeight;
  }
}

const renaming = ref<string>('');
const renameTitle = ref('');
function startRename(conv: AiApi.Conversation) {
  renaming.value = conv.id;
  renameTitle.value = conv.title;
}
async function commitRename(id: string) {
  if (!renameTitle.value.trim()) return;
  await renameConversation(id, renameTitle.value);
  const conv = conversations.value.find((c) => c.id === id);
  if (conv) conv.title = renameTitle.value;
  renaming.value = '';
}

function renderMd(content: string): string {
  return content
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
    .replaceAll('\n', '<br>');
}

onMounted(async () => {
  await loadConversations();
  if (conversations.value.length > 0) {
    await selectConversation(conversations.value[0]?.id ?? '');
  }
});
</script>

<template>
  <div class="ai-chat-layout">
    <div class="ai-chat-sidebar">
      <div class="ai-chat-sidebar__header">
        <span class="ai-chat-sidebar__title">{{
          $t('page.ai.chat.title')
        }}</span>
        <a-button size="small" type="primary" @click="handleNewChat">
          + {{ $t('page.ai.chat.newChat') }}
        </a-button>
      </div>
      <div class="ai-chat-sidebar__list">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="ai-chat-conv-item"
          :class="{ active: conv.id === activeConvId }"
          @click="selectConversation(conv.id)"
        >
          <template v-if="renaming === conv.id">
            <a-input
              v-model:value="renameTitle"
              size="small"
              @blur="commitRename(conv.id)"
              @press-enter="commitRename(conv.id)"
            />
          </template>
          <template v-else>
            <span class="ai-chat-conv-item__title">{{ conv.title }}</span>
            <span class="ai-chat-conv-item__actions">
              <a-button size="small" type="text" @click.stop="startRename(conv)">✏️</a-button>
              <a-popconfirm
                title="确认删除？"
                @confirm="handleDeleteConv(conv.id)"
                @click.stop
              >
                <a-button size="small" type="text" danger>🗑</a-button>
              </a-popconfirm>
            </span>
          </template>
        </div>
      </div>
    </div>

    <div class="ai-chat-main">
      <div ref="msgListRef" class="ai-chat-messages">
        <div v-if="messages.length === 0" class="ai-chat-empty">
          {{ $t('page.ai.chat.emptyHint') }}
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="ai-chat-msg"
          :class="`ai-chat-msg--${msg.role}`"
        >
          <template v-if="msg.role === 'user'">
            <div class="ai-chat-msg__bubble ai-chat-msg__bubble--user">
              <span>{{ msg.content }}</span>
            </div>
          </template>
          <template v-else>
            <div class="ai-chat-msg__avatar">🤖</div>
            <div class="ai-chat-msg__bubble ai-chat-msg__bubble--assistant">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div
                v-if="msg.content"
                class="ai-chat-markdown"
                v-html="renderMd(msg.content)"
              ></div>
              <span v-else class="ai-chat-thinking">{{
                $t('page.ai.chat.thinking')
              }}</span>
            </div>
          </template>
        </div>
      </div>

      <div class="ai-chat-input-area">
        <a-textarea
          v-model:value="inputText"
          :placeholder="$t('page.ai.chat.placeholder')"
          :auto-size="{ minRows: 2, maxRows: 6 }"
          :disabled="isStreaming"
          @keydown="handleKeydown"
        />
        <div class="ai-chat-input-actions">
          <a-button
            v-if="!isStreaming"
            type="primary"
            :disabled="!inputText.trim()"
            @click="handleSendWithStream"
          >
            {{ $t('page.ai.chat.send') }}
          </a-button>
          <a-button v-else danger @click="isStreaming = false">
            {{ $t('page.ai.chat.stop') }}
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-chat-layout {
  display: flex;
  height: calc(100vh - 120px);
  overflow: hidden;
  background: var(--vp-c-bg);
  border-radius: 8px;
}

.ai-chat-sidebar {
  display: flex;
  flex-direction: column;
  width: 240px;
  min-width: 200px;
  border-right: 1px solid var(--vp-c-border);
}

.ai-chat-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--vp-c-border);
}

.ai-chat-sidebar__list {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
}

.ai-chat-conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin: 2px 6px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.ai-chat-conv-item:hover {
  background: var(--vp-c-bg-alt);
}

.ai-chat-conv-item.active {
  background: var(--vp-c-brand-soft);
}

.ai-chat-conv-item__title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
}

.ai-chat-conv-item__actions {
  display: flex;
  gap: 2px;
  opacity: 0;
}

.ai-chat-conv-item:hover .ai-chat-conv-item__actions {
  opacity: 1;
}

.ai-chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.ai-chat-messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  overflow-y: auto;
}

.ai-chat-empty {
  margin: auto;
  font-size: 15px;
  color: var(--vp-c-text-3);
  text-align: center;
}

.ai-chat-msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  max-width: 80%;
}

.ai-chat-msg--user {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.ai-chat-msg--assistant {
  align-self: flex-start;
}

.ai-chat-msg__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  background: var(--vp-c-brand-soft);
  border-radius: 50%;
}

.ai-chat-msg__bubble {
  max-width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-all;
  border-radius: 12px;
}

.ai-chat-msg__bubble--user {
  color: white;
  background: var(--vp-c-brand);
}

.ai-chat-msg__bubble--assistant {
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
}

.ai-chat-thinking {
  color: var(--vp-c-text-3);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

.ai-chat-markdown :deep(pre) {
  padding: 10px;
  margin: 8px 0;
  overflow-x: auto;
  font-size: 13px;
  background: var(--vp-c-bg-soft);
  border-radius: 6px;
}

.ai-chat-markdown :deep(code) {
  padding: 2px 5px;
  font-size: 13px;
  background: var(--vp-c-bg-soft);
  border-radius: 3px;
}

.ai-chat-input-area {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--vp-c-border);
}

.ai-chat-input-area .ant-input {
  flex: 1;
}

.ai-chat-input-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
