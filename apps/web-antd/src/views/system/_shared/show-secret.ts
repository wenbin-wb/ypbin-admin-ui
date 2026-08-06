import { h } from 'vue';

import { Button, message, Modal, Typography } from 'ant-design-vue';
import dayjs from 'dayjs';

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

/** 新生成的签发密钥对（SM2 公钥/私钥 + SM4 密钥） */
interface KeyPairEntry {
  publicKey: string;
  privateKey: string;
  sm4Key: string;
}

/** 复制文本到剪贴板：优先 Clipboard API，失败降级 execCommand */
async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Clipboard API 不可用（非安全上下文等）时降级到 execCommand
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('clipboard copy failed');
  }
}

/** 将文本保存为本地文件（触发浏览器下载） */
function saveTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 弹窗展示新生成的签发密钥对（仅此一次可见，服务端不落库）。
 * 三把密钥分块展示、各自可复制，底部提供「复制全部 / 保存为文件」。
 *
 * @param pair  密钥对
 * @param title 弹窗标题
 */
export function showKeyPairOnce(pair: KeyPairEntry, title?: string) {
  const items = [
    { label: $t('system.license.publicKey'), value: pair.publicKey },
    { label: $t('system.license.privateKey'), value: pair.privateKey },
    { label: $t('system.license.sm4Key'), value: pair.sm4Key },
  ];

  /** 拼接三段文本（复制全部 / 保存为文件共用） */
  const buildContent = () =>
    items.map(({ label, value }) => `${label}: ${value}`).join('\n\n');

  const modal = Modal.confirm({
    title: title ?? $t('system.license.genkeyTitle'),
    width: 640,
    icon: null,
    maskClosable: false,
    content: h('div', { class: 'flex flex-col gap-2' }, [
      h('div', { class: 'text-warning' }, $t('system.license.genkeyTip')),
      ...items.map(({ label, value }) =>
        h(
          'div',
          { class: 'flex flex-col gap-1 rounded border border-gray-200 p-2' },
          [
            h('span', { class: 'text-xs text-gray-500' }, label),
            h(
              Typography.Text,
              {
                class: 'break-all select-all',
                copyable: {
                  text: value,
                  tooltip: false,
                  onCopy: () => message.success($t('common.copySuccess')),
                },
              },
              () => value,
            ),
          ],
        ),
      ),
    ]),
    footer: () =>
      h('div', { class: 'mt-3 flex justify-end gap-2' }, [
        h(
          Button,
          {
            onClick: () => {
              copyText(buildContent())
                .then(() => message.success($t('common.copySuccess')))
                .catch(() => message.error($t('common.copyFailed')));
            },
          },
          () => $t('common.copyAll'),
        ),
        h(
          Button,
          {
            type: 'primary',
            onClick: () => {
              saveTextFile(
                buildContent(),
                `license-keys-${dayjs().format('YYYYMMDD-HHmmss')}.txt`,
              );
            },
          },
          () => $t('common.saveToFile'),
        ),
        h(Button, { onClick: () => modal.destroy() }, () => $t('common.close')),
      ]),
  });
}
