import type { Dayjs } from 'dayjs';

import type { AiApi } from '#/api/ai';

import { ref } from 'vue';

import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { setShareSetting } from '#/api/ai';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';

/**
 * 知识库公开分享弹窗域：开启/关闭分享、有效期与密码设置、链接复制。
 */
export function useKbShare() {
  const shareKb = ref<AiApi.KnowledgeBase | null>(null);
  const shareOpen = ref(false);
  const shareEnabled = ref(false);
  const shareExpire = ref<Dayjs | undefined>(undefined);
  const sharePassword = ref('');
  const shareToken = ref('');
  const shareSaving = ref(false);

  function shareLink(token: string) {
    return `${window.location.origin}/share/${token}`;
  }

  function onShare(row: AiApi.KnowledgeBase, e: Event) {
    e.stopPropagation();
    shareKb.value = row;
    shareEnabled.value = row.shareEnabled === 1;
    shareToken.value = row.shareToken || '';
    shareExpire.value = row.shareExpireTime
      ? dayjs(row.shareExpireTime)
      : undefined;
    sharePassword.value = '';
    shareOpen.value = true;
  }

  async function onShareEnable() {
    const kb = shareKb.value;
    if (!kb) return;
    shareSaving.value = true;
    try {
      const token = await setShareSetting(kb.id, { enabled: true });
      shareToken.value = token;
      shareEnabled.value = true;
      kb.shareToken = token;
      kb.shareEnabled = 1;
      message.success($t('page.ai.knowledge.shareEnabled'));
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
    } finally {
      shareSaving.value = false;
    }
  }

  async function onShareSave() {
    const kb = shareKb.value;
    if (!kb) return;
    shareSaving.value = true;
    try {
      const token = await setShareSetting(kb.id, {
        enabled: true,
        expireTime: shareExpire.value
          ? shareExpire.value.format('YYYY-MM-DDTHH:mm:ss')
          : null,
        password: sharePassword.value.trim() || undefined,
      });
      shareToken.value = token;
      kb.shareToken = token;
      kb.shareEnabled = 1;
      kb.shareExpireTime = shareExpire.value
        ? shareExpire.value.format('YYYY-MM-DDTHH:mm:ss')
        : '';
      sharePassword.value = '';
      message.success($t('common.success'));
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
    } finally {
      shareSaving.value = false;
    }
  }

  async function onShareDisable() {
    const kb = shareKb.value;
    if (!kb) return;
    shareSaving.value = true;
    try {
      await setShareSetting(kb.id, { enabled: false });
      shareEnabled.value = false;
      shareToken.value = '';
      shareExpire.value = undefined;
      sharePassword.value = '';
      kb.shareToken = '';
      kb.shareEnabled = 0;
      kb.shareExpireTime = '';
      message.success($t('page.ai.knowledge.shareDisabled'));
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
    } finally {
      shareSaving.value = false;
    }
  }

  async function onCopyShareLink() {
    try {
      await navigator.clipboard.writeText(shareLink(shareToken.value));
      message.success($t('page.ai.knowledge.shareCopied'));
    } catch {
      message.error($t('common.requestFailed'));
    }
  }

  return {
    onCopyShareLink,
    onShare,
    onShareDisable,
    onShareEnable,
    onShareSave,
    shareEnabled,
    shareExpire,
    shareKb,
    shareLink,
    shareOpen,
    sharePassword,
    shareSaving,
    shareToken,
  };
}
