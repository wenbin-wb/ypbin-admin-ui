import type { Component } from 'vue';

import type { SystemConfigApi } from '#/api/system/config';

import {
  SvgDingDingIcon,
  SvgGithubIcon,
  SvgQQChatIcon,
  SvgWeChatIcon,
} from '@vben/icons';

export interface SocialPlatformMeta {
  color: string;
  icon: Component | string;
  labelKey: string;
  source: SystemConfigApi.SocialSource;
}

export const SOCIAL_PLATFORMS: readonly SocialPlatformMeta[] = [
  {
    color: '#1677ff',
    icon: 'fa6-brands:alipay',
    labelKey: 'system.config.social.platform.alipay',
    source: 'alipay',
  },
  {
    color: '#1677ff',
    icon: SvgDingDingIcon,
    labelKey: 'system.config.social.platform.dingtalk',
    source: 'dingtalk',
  },
  {
    color: '#c71d23',
    icon: 'fa6-brands:gitee',
    labelKey: 'system.config.social.platform.gitee',
    source: 'gitee',
  },
  {
    color: '#24292f',
    icon: SvgGithubIcon,
    labelKey: 'system.config.social.platform.github',
    source: 'github',
  },
  {
    color: '#12b7f5',
    icon: SvgQQChatIcon,
    labelKey: 'system.config.social.platform.qq',
    source: 'qq',
  },
  {
    color: '#07c160',
    icon: SvgWeChatIcon,
    labelKey: 'system.config.social.platform.wechatOpen',
    source: 'wechat_open',
  },
];

const SOCIAL_PLATFORM_MAP = new Map(
  SOCIAL_PLATFORMS.map((platform) => [platform.source, platform]),
);

export function getSocialPlatformMeta(source: SystemConfigApi.SocialSource) {
  const platform = SOCIAL_PLATFORM_MAP.get(source);
  if (!platform) {
    throw new Error(`Unsupported social platform: ${source}`);
  }
  return platform;
}
