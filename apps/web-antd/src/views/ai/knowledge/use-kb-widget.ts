import type { AiApi } from '#/api/ai';

import { ref } from 'vue';

import { useAppConfig } from '@vben/hooks';

import { message } from 'ant-design-vue';

import { setWidgetEnabled } from '#/api/ai';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';

/**
 * 知识库网页挂件弹窗域：启用/停用挂件、生成嵌入代码与复制。
 */
export function useKbWidget() {
  const widgetKb = ref<AiApi.KnowledgeBase | null>(null);
  const widgetToken = ref('');
  const widgetLoading = ref(false);
  const widgetOpen = ref(false);

  function onWidget(row: AiApi.KnowledgeBase, e: Event) {
    e.stopPropagation();
    widgetKb.value = row;
    widgetToken.value = row.widgetToken || '';
    widgetOpen.value = true;
  }

  async function onWidgetEnable() {
    const kb = widgetKb.value;
    if (!kb) return;
    widgetLoading.value = true;
    try {
      const token = await setWidgetEnabled(kb.id, true);
      widgetToken.value = token;
      kb.widgetToken = token;
      kb.widgetEnabled = 1;
      message.success($t('common.success'));
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
    } finally {
      widgetLoading.value = false;
    }
  }

  async function onWidgetDisable() {
    const kb = widgetKb.value;
    if (!kb) return;
    widgetLoading.value = true;
    try {
      await setWidgetEnabled(kb.id, false);
      widgetToken.value = '';
      kb.widgetToken = '';
      kb.widgetEnabled = 0;
      message.success($t('page.ai.knowledge.widgetDisabled'));
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
    } finally {
      widgetLoading.value = false;
    }
  }

  function widgetEmbedCode(token: string) {
    const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
    // 用 \u002F 转义 script 结束标签，避免提前终止本组件的 setup 块
    return (
      `<scr` +
      `ipt src="${apiURL}/widget/embed.js" data-token="${
        token
      }" data-title="${widgetKb.value?.name || ''}"><\u002Fscript>`
    );
  }

  async function onCopyCode() {
    const code = widgetEmbedCode(widgetToken.value);
    try {
      await navigator.clipboard.writeText(code);
      message.success($t('page.ai.knowledge.widgetCopied'));
    } catch {
      message.error($t('common.requestFailed'));
    }
  }

  return {
    onCopyCode,
    onWidget,
    onWidgetDisable,
    onWidgetEnable,
    widgetEmbedCode,
    widgetKb,
    widgetLoading,
    widgetOpen,
    widgetToken,
  };
}
