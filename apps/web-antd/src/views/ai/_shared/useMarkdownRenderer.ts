import hljs from 'highlight.js';
import { Marked, Renderer } from 'marked';

import { sanitizeHtml } from '#/views/system/_shared/sanitize';

import './ai-markdown.css';

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
 * 按 (copyButton, copyLabel) 配置缓存独立的 Marked 实例。
 *
 * 说明：marked 的默认导出是模块级单例，早期实现每次 setup 都调用
 * marked.use(...) 改写该全局配置，多个组件（chat/wiki/share/widget）
 * 会互相覆盖，产生竞态。marked v12+ 支持 `new Marked({...})` 构造互不
 * 影响的实例，因此这里改为「组件配置只在首次出现时创建一次实例」，
 * 不再触碰全局 marked 配置。差异点（复制按钮及其文案）通过按 key 缓存
 * 得到各自独立的实例，不会相互覆盖。
 */
const rendererCache = new Map<string, Marked>();

function getMarkedInstance(options: MarkdownRendererOptions = {}): Marked {
  const { copyButton = false, copyLabel = '' } = options;
  const cacheKey = `${copyButton ? 'copy' : 'plain'}|${copyLabel}`;
  const cached = rendererCache.get(cacheKey);
  if (cached) return cached;

  const renderer = new Renderer();
  renderer.code = createCodeRenderer(copyButton, copyLabel);
  const instance = new Marked({
    async: false,
    breaks: true,
    gfm: true,
    renderer,
  });
  rendererCache.set(cacheKey, instance);
  return instance;
}

/**
 * 统一的 Markdown 渲染器（marked + hljs 高亮 + DOMPurify 净化）。
 * chat / wiki / share / assistant-widget 共用，避免四处重复初始化 marked。
 */
export function useMarkdownRenderer(options: MarkdownRendererOptions = {}) {
  const instance = getMarkedInstance(options);

  /** 渲染并净化 Markdown；解析失败时原样返回输入 */
  function renderMarkdown(content: string): string {
    if (!content) return '';
    try {
      const raw = instance.parse(content);
      return sanitizeHtml(typeof raw === 'string' ? raw : String(raw));
    } catch {
      return content;
    }
  }

  return { renderMarkdown };
}
