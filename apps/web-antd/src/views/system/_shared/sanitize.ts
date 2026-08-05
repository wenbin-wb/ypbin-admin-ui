import DOMPurify from 'dompurify';

/**
 * 净化富文本 HTML，防 XSS。渲染后端富文本（公告/站内信/评论等）前必须经过此清洗。
 */
export function sanitizeHtml(html?: null | string): string {
  if (!html) {
    return '';
  }
  return DOMPurify.sanitize(html);
}
