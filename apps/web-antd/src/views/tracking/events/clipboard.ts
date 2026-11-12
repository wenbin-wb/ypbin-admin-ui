/**
 * 复制文本：优先 Clipboard API，非安全上下文（HTTP 部署）下降级到 execCommand。
 *
 * <p>实测通过 `http://<ip>:18081` 访问时 `navigator.clipboard` 为 undefined，
 * 直接调用会抛 TypeError、复制功能在测试环境完全不可用。</p>
 *
 * @param text 待复制文本
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // 非安全上下文/权限被拒：降级到 execCommand
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('clipboard copy failed');
  }
}
