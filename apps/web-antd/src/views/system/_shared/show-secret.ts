import { h } from 'vue';

import { Modal, Typography } from 'ant-design-vue';

import { $t } from '#/locales';

/**
 * 弹窗展示后端生成的密钥（仅此一次可见），内置复制按钮。
 * 用于客户端密钥 / 开放应用 SecretKey 等场景。
 *
 * @param secret 明文密钥
 * @param title  弹窗标题
 */
export function showSecretOnce(secret: string, title?: string) {
  if (!secret) {
    return;
  }
  Modal.success({
    title: title ?? $t('system.common.secretTitle'),
    width: 520,
    content: h('div', { class: 'flex flex-col gap-2' }, [
      h('div', { class: 'text-warning' }, $t('system.common.secretTip')),
      h(
        Typography.Paragraph,
        {
          class: 'mb-0 select-all break-all',
          copyable: { text: secret },
        },
        () => secret,
      ),
    ]),
  });
}
