<div align="center">

# 🎨 Ypbin Admin UI

**企业级中后台管理前端 · Enterprise Admin UI**

> 由后端动态路由驱动的 Vue 3 管理前端：RBAC、多租户、SSE 实时消息、AI 对话界面，开箱即用。

**Vue 3.5 · TypeScript · Vite · Ant Design Vue 4 · Pinia**

[![CI](https://github.com/wenbin-wb/ypbin-admin-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/wenbin-wb/ypbin-admin-ui/actions/workflows/ci.yml)
[![Code Style](https://img.shields.io/badge/Code%20Style-Oxlint%20%2B%20Prettier-brightgreen.svg)](https://github.com/wenbin-wb/ypbin-admin-ui/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue](https://img.shields.io/badge/Vue-3.5-green.svg)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-blueviolet.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/)
[![Ant Design Vue](https://img.shields.io/badge/Ant%20Design%20Vue-4-1677ff.svg)](https://next.antdv.com/)

[在线演示](https://admin.ypbin.cn) · [文档](https://ypbin.cn/guide/admin-ui/) · [开发指南](https://ypbin.cn/guide/admin-ui/development)

**中文** | [English](./README.en-US.md)

</div>

---

## ✨ 界面预览

<div align="center">

![运行概览](https://ypbin.cn/screenshots/admin-ui/dashboard.png)
*运行概览 Dashboard*

| 角色权限 | 动态菜单 |
|---|---|
| ![角色权限](https://ypbin.cn/screenshots/admin-ui/roles.png) | ![动态菜单](https://ypbin.cn/screenshots/admin-ui/menus.png) |

| 任务调度 | 登录入口 |
|---|---|
| ![任务调度](https://ypbin.cn/screenshots/admin-ui/jobs.png) | ![登录入口](https://ypbin.cn/screenshots/admin-ui/login.png) |

</div>

> 📸 截图由真实运行实例自动采集，更多见 [截图清单](https://ypbin.cn/screenshots/admin-ui/manifest.json)。

## 📌 项目简介

Ypbin Admin UI 是 [ypbin-admin](https://github.com/wenbin-wb/ypbin-admin) 企业管理系统的前端，基于开源项目 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)（MIT License）的 `ant-design-vue` 变体（`web-antd`）改造而来，提供开箱即用的企业级中后台界面，**菜单与权限由后端动态路由驱动**，内置站内信 SSE 实时推送。

## 🧭 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [生产构建与部署](#-生产构建与部署)
- [目录结构](#-目录结构)
- [许可证](#-许可证)

## ⚡ 功能特性

| 模块 | 说明 |
|---|---|
| 🧭 **后端驱动路由** | 菜单从 `ypbin-admin` 后端（`/menu/all`）加载，支持按钮级权限码 |
| 🏛️ **系统管理** | 用户、角色、部门、岗位、菜单、字典、参数配置、租户、权限模板 |
| 📨 **消息中心** | 站内信 SSE 实时推送，通知公告富文本发布 |
| ⏰ **定时任务** | 基于 Cron 的任务管理与执行日志 |
| 🏢 **多租户隔离** | 租户级数据与权限模板 |
| 🤖 **AI 对话** | 流式对话界面（SSE）、会话管理、用量展示 |
| 🌐 **企业级基线** | 国际化（zh-CN / en-US）、主题与暗色模式、个性化配置 |

## 🧱 技术栈

| 领域 | 选型 |
|---|---|
| 框架 | [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| 构建 | [Vite](https://vitejs.dev/) + [pnpm](https://pnpm.io/) + [Turbo](https://turbo.build/) monorepo |
| UI | [Ant Design Vue](https://next.antdv.com/) |
| 表格 | Vxe Table |
| 表单 | Vben Form |
| 基础 | [Vben Admin 5.x](https://github.com/vbenjs/vue-vben-admin) |

## 🚀 快速开始

前端需要后端服务先启动（后端启动方式见 [ypbin-admin](https://github.com/wenbin-wb/ypbin-admin)）。

```bash
# 安装依赖
pnpm install

# 启动 web-antd 应用
pnpm dev:antd
```

启动后访问 http://localhost:5666（或终端打印的端口）。开发服务器通过 `/api` 代理到 `http://localhost:8080`。

> 💡 推荐使用仓库锁定的 pnpm 版本：`corepack enable && corepack prepare pnpm@11.16.0 --activate`

## 📦 生产构建与部署

```bash
# 构建生产产物（输出到 apps/web-antd/dist）
pnpm -F @vben/web-antd build
```

部署方式二选一：

| 方式 | 说明 |
|---|---|
| **随 admin 一键部署** | 服务器跑 `ypbin-admin` 的 `deploy/install.sh`（交互模式选「完整部署」服务器自动构建前端；或选「手动上传前端包」等你上传） |
| **单独上传** | `scp -r apps/web-antd/dist/* root@<服务器IP>:/opt/ypbin/admin-ui-dist/`（nginx bind 挂载直接读新文件无需重启） |

> ⚠️ 上传后需确保目录权限 755 / 文件 644，否则 nginx 读不到会报 js `text/html` MIME 错误。

前端 API 地址在 `apps/web-antd/.env.production` 的 `VITE_GLOB_API_URL`（默认 `/api`，同源经 nginx 代理到后端）。

## 📁 目录结构

```
apps/
  web-antd/          # ypbin-admin Web 应用（Ant Design Vue）
packages/            # 共享库（layouts、common-ui、preferences 等）
internal/            # 构建工具链（vite-config、eslint-config 等）
```

## 📄 许可证

[Ypbin Admin](https://github.com/wenbin-wb/ypbin-admin-ui) 使用 [MIT](./LICENSE) 许可。

本项目派生自 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)（MIT，Copyright (c) 2024-present, Vben）。按照 MIT 许可证要求，保留原作者版权与许可声明；ypbin-admin 的改造与新增部分版权归 Copyright (c) 2026-present, ypbin-admin authors。
