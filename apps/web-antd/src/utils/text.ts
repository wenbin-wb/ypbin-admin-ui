/**
 * 富文本转纯文本（用于列表、通知等只做摘要展示的位置）。
 *
 * 为什么不用正则剥标签：`content.replaceAll(/<[^>]+>/g, '')` 这类写法处理不了畸形或嵌套标记——
 * 例如 `<scr<script>ipt>alert(1)</script>` 在替换后会**重新拼出** `<script>`，等于把危险内容
 * 「净化」成了更危险的形态（静态扫描也会报 js/incomplete-multi-character-sanitization）。
 * 这里改用浏览器解析器：按 HTML 解析后取 `textContent`，标记结构由解析器处理，不存在拼接漏洞。
 *
 * @param html 原始内容（可能是富文本、也可能是普通字符串）
 * @param maxLength 摘要最大长度，超出截断并追加省略号
 * @returns 纯文本摘要
 */
export function toPlainText(html: unknown, maxLength = 60): string {
  const raw = html === null || html === undefined ? '' : String(html);
  if (!raw) {
    return '';
  }
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  // 脚本与样式内容不属于正文，去掉后再取文本
  doc.querySelectorAll('script, style').forEach((el) => el.remove());
  const text = (doc.body.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
