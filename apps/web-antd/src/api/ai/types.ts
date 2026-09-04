export namespace AiApi {
  /**
   * 对话流式请求。字段与后端 AiChatSendReq 全程同名（sessionId/content/roleId/modelId/knowledgeBaseId），
   * 禁止在前端做字段改名映射。
   */
  export interface ChatReq {
    sessionId?: string;
    roleId?: string;
    modelId?: string;
    content: string;
    images?: string[];
    knowledgeBaseId?: string;
  }

  export type ModelType = 'CHAT' | 'EMBEDDING';

  export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    modelType?: ModelType;
    baseUrl?: string;
    modelName: string;
    isDefault: number;
    status: number;
    remark?: string;
    apiKeyMasked?: string;
    createTime: string;
  }

  export interface ModelConfigSaveReq {
    name: string;
    provider: string;
    modelType?: ModelType;
    apiKey?: string;
    baseUrl?: string;
    modelName: string;
    remark?: string;
  }

  export interface KnowledgeBase {
    id: string;
    name: string;
    description?: string;
    /** emoji 或图标名，供卡片展示 */
    icon?: string;
    remark?: string;
    docCount: number;
    createTime: string;
    /** 网页挂件令牌（非空表示已启用） */
    widgetToken?: string;
    widgetEnabled?: number;
    /** 公开分享令牌（非空表示已启用分享） */
    shareToken?: string;
    shareEnabled?: number;
    /** 分享过期时间（空表示永不过期） */
    shareExpireTime?: string;
  }

  export interface ShareSettingReq {
    enabled: boolean;
    /** 过期时间 ISO 字符串；null/缺省=永不过期 */
    expireTime?: null | string;
    /** 访问密码（明文）；空=无需密码 */
    password?: string;
  }

  export interface KnowledgeBaseSaveReq {
    name: string;
    description?: string;
    icon?: string;
    remark?: string;
  }

  export interface KnowledgeBaseUpdateReq {
    name: string;
    description?: string;
    icon?: string;
    remark?: string;
  }

  export interface KbDocument {
    id: string;
    knowledgeBaseId: string;
    filename: string;
    fileSize: number;
    chunkCount: number;
    /** 0 处理中 | 1 就绪 | 2 失败 */
    status: number;
    errorMsg?: string;
    createTime: string;
    updateTime?: string;
    sourceType?: string;
    sourceUrl?: string;
  }

  export interface KbImportReq {
    /** URL / SITEMAP / RSS */
    sourceType: 'RSS' | 'SITEMAP' | 'URL';
    url: string;
    maxUrls?: number;
    customTitle?: string;
  }

  export interface KbSourceFragment {
    source?: string;
    content: string;
    metadata?: Record<string, any>;
  }

  export interface KbQueryResult {
    answer: string;
    sources: KbSourceFragment[];
  }

  /** 检索测试器命中的分块（含启发式关键词相关度评估字段） */
  export interface KbSearchHit {
    content: string;
    metadata: Record<string, any>;
    source?: string;
    docId?: string;
    docName?: string;
    charCount?: number;
    /** 关键词相关度 0-100（启发式，非向量相似度） */
    score?: number;
    hitKeywords?: string[];
    maxHitLen?: number;
  }
  export interface PromptTemplate {
    id: string;
    name: string;
    category?: string;
    template: string;
    description?: string;
    status: number;
    createTime: string;
  }

  export interface PromptTemplateSaveReq {
    name: string;
    category?: string;
    template: string;
    description?: string;
  }

  /** 对话会话（新引擎） */
  export interface ChatSession {
    id: string;
    title: string;
    roleId?: string;
    roleName?: string;
    roleAvatar?: string;
    modelId?: string;
    messageCount: number;
    totalTokens: number;
    isPinned: number;
    lastMessageAt?: string;
    createTime: string;
  }

  /** 对话消息（新引擎） */
  export interface ChatMessage {
    id: string;
    role: 'assistant' | 'system' | 'tool' | 'user';
    content: string;
    tokens?: number;
    modelName?: string;
    finishReason?: string;
    toolCalls?: string;
    images?: string[];
    createTime: string;
  }

  /** 对话角色 */
  export interface ChatRole {
    id: string;
    name: string;
    description?: string;
    avatar?: string;
    category: string;
    modelPreference?: string;
    temperature?: number;
    isBuiltin: number;
    isFavorite: boolean;
    sort: number;
  }

  export interface ChatRoleSaveReq {
    name: string;
    description?: string;
    avatar?: string;
    systemPrompt: string;
    category?: string;
    modelPreference?: string;
    temperature?: number;
  }

  export interface ChatSendReq {
    sessionId?: string;
    roleId?: string;
    modelId?: string;
    content: string;
    images?: string[];
  }
}
