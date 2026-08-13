<div align="center">

# Ypbin Admin

**企业级中后台管理前端 · Enterprise Admin UI**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![vue](https://img.shields.io/badge/Vue-3.5-green.svg)](https://vuejs.org/) [![vite](https://img.shields.io/badge/Vite-6-blueviolet.svg)](https://vitejs.dev/) [![typescript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/) [![ant-design-vue](https://img.shields.io/badge/Ant%20Design%20Vue-4-1677ff.svg)](https://next.antdv.com/)

</div>

**中文** | [English](./README.en-US.md)

## 在线演示

<p align="center">
  <a href="https://admin.ypbin.cn/"><strong>https://admin.ypbin.cn</strong></a> —— 免配置直接访问，体验完整后台
</p>

## 界面预览

<p align="center">
  <img src="https://ypbin.cn/screenshots/admin-ui/dashboard.png" alt="运行概览" width="75%" />
</p>
<p align="center">
  <img src="https://ypbin.cn/screenshots/admin-ui/login.png" alt="登录页" width="55%" />
</p>

## 简介

Ypbin Admin 是 [ypbin-admin](https://github.com/wenbin-wb/ypbin-admin) 企业管理系统的前端，基于开源项目 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)（MIT License）的 `ant-design-vue` 变体（`web-antd`）改造而来，提供开箱即用的企业级中后台界面，菜单与权限由后端驱动，内置站内信实时推送。

> 完整文档见 [ypbin.cn](https://ypbin.cn/guide/admin-ui/) · [开发指南](https://ypbin.cn/guide/admin-ui/development)

## 特性

- **后端驱动菜单与权限**：菜单从 ypbin-admin 后端（`/menu/all`）加载，支持按钮级权限码
- **系统管理**：用户、角色、部门、岗位、菜单、字典、参数配置、租户、权限模板
- **消息中心**：站内信 SSE 实时推送，通知公告富文本发布
- **定时任务**：基于 Cron 的任务管理与执行日志
- **多租户隔离**：租户级数据与权限模板
- **企业级基线**：国际化（zh-CN / en-US）、主题与暗色模式、个性化配置

## 技术栈

- [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) + [pnpm](https://pnpm.io/) + [Turbo](https://turbo.build/) monorepo
- [Ant Design Vue](https://next.antdv.com/)
- 以 [Vben Admin 5.x](https://github.com/vbenjs/vue-vben-admin) 为基础框架

## 快速开始

前端需要后端服务先启动（后端启动方式见其 `DEVELOPMENT-PLAN.md`）。

```bash
# 安装依赖
pnpm install

# 启动 web-antd 应用
pnpm dev:antd
```

启动后访问 http://localhost:5666（或终端打印的端口）。

## 目录结构

```
apps/
  web-antd/          # ypbin-admin Web 应用（Ant Design Vue）
packages/            # 共享库（layouts、common-ui、preferences 等）
internal/            # 构建工具链（vite-config、eslint-config 等）
```

## 许可证

[Ypbin Admin](https://github.com/wenbin-wb/ypbin-admin-ui) 使用 [MIT](./LICENSE) 许可。

本项目派生自 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)（MIT，Copyright (c) 2024-present, Vben）。按照 MIT 许可证要求，保留原作者版权与许可声明；ypbin-admin 的改造与新增部分版权归 Copyright (c) 2026-present, ypbin-admin authors。
