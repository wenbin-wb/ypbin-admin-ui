import { Modal } from 'ant-design-vue';

import { $t } from '#/locales';

/**
 * 将 Antd 的 Modal.confirm 封装为 Promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 * @returns 确认后 resolve(true)；取消后 reject
 */
export function useConfirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error($t('common.cancel')));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}
