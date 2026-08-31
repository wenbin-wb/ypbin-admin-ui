/**
 * AI 模块 API 出口。
 *
 * 实现按资源域拆分：类型（types）、流式对话（chat）、知识库与检索（knowledge）、
 * 模型配置（models）、Prompt 模板（prompt-template）、统计（stats）、
 * 对话角色（role）与会话（session）。本文件仅做桶导出，调用方仍从 '#/api/ai' 导入。
 */
export * from './chat';
export * from './knowledge';
export * from './models';
export * from './prompt-template';
export * from './role';
export * from './session';
export * from './stats';
export * from './types';
