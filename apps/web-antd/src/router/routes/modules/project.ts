import type { RouteRecordRaw } from 'vue-router';

import { IFrameView } from '#/layouts';
import { $t } from '#/locales';

// ypbin-admin 项目相关路由（文档/GitHub/关于）。外链为占位 URL，仓库就绪后替换。
const YPBIN_GITHUB_URL = 'https://github.com/wenbin-wb/ypbin-admin-ui';
const YPBIN_DOC_URL = 'https://github.com/wenbin-wb/ypbin-admin-ui#readme';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      order: 9998,
      title: $t('demos.project.title'),
    },
    name: 'Project',
    path: '/project',
    children: [
      {
        name: 'ProjectDocument',
        path: 'document',
        component: IFrameView,
        meta: {
          icon: 'lucide:book-open-text',
          link: YPBIN_DOC_URL,
          title: $t('demos.project.document'),
        },
      },
      {
        name: 'ProjectGithub',
        path: 'github',
        component: IFrameView,
        meta: {
          icon: 'mdi:github',
          link: YPBIN_GITHUB_URL,
          title: 'Github',
        },
      },
    ],
  },
  {
    name: 'About',
    path: '/about',
    component: () => import('#/views/_core/about/index.vue'),
    meta: {
      icon: 'lucide:copyright',
      title: $t('demos.project.about'),
      order: 9999,
    },
  },
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      icon: 'lucide:user',
      hideInMenu: true,
      title: $t('page.auth.profile'),
    },
  },
];

export default routes;
