import hljs from 'highlight.js';
import { marked } from 'marked';

import { sanitizeHtml } from '#/views/system/_shared/sanitize';

export interface MarkdownRendererOptions {
  /** 是否渲染代码块复制按钮（对话流式场景） */
  copyButton?: boolean;
  /** 复制按钮文案（仅在 copyButton 时使用） */
  copyLabel?: string;
}

const COPY_BTN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

/** 代码块渲染器（hljs 高亮 + 可选的复制按钮） */
function createCodeRenderer(copyButton: boolean, copyLabel: string) {
  return ({ text, lang }: { lang?: string; text: string }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    const highlighted = hljs.highlight(text, { language }).value;
    if (copyButton) {
      return `<pre class="ai-code-block" data-lang="${language}"><button type="button" class="ai-copy-btn">${COPY_BTN_SVG}${copyLabel}</button><code class="hljs language-${language}">${highlighted}</code></pre>`;
    }
    return `<pre class="hljs-pre"><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };
}

/**
 * 统一的 Markdown 渲染器（marked + hljs 高亮 + DOMPurify 净化）。
 * chat / wiki / share / assistant-widget 共用，避免四处重复初始化 marked。
 */
export function useMarkdownRenderer(options: MarkdownRendererOptions = {}) {
  const { copyButton = false, copyLabel = '' } = options;
  const renderer = new marked.Renderer();
  renderer.code = createCodeRenderer(copyButton, copyLabel);
  marked.use({ async: false, breaks: true, gfm: true, renderer });

  /** 渲染并净化 Markdown；解析失败时原样返回输入 */
  function renderMarkdown(content: string): string {
    if (!content) return '';
    try {
      const raw = marked.parse(content);
      return sanitizeHtml(typeof raw === 'string' ? raw : String(raw));
    } catch {
      return content;
    }
  }

  return { renderMarkdown };
}
