<div align="center">

# Ypbin Admin

**企业级中后台管理前端 · Enterprise Admin UI**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![vue](https://img.shields.io/badge/Vue-3.5-green.svg)](https://vuejs.org/) [![vite](https://img.shields.io/badge/Vite-6-blueviolet.svg)](https://vitejs.dev/) [![typescript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/) [![ant-design-vue](https://img.shields.io/badge/Ant%20Design%20Vue-4-1677ff.svg)](https://next.antdv.com/)

</div>

**English** | [中文](./README.zh-CN.md)

## Introduction

Ypbin Admin is the frontend of the [ypbin-admin](https://github.com/wenbin-wb/ypbin-admin) enterprise management system, built on top of the open source project [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin) (MIT License) with the `ant-design-vue` variant (`web-antd`). It delivers an out-of-the-box, enterprise-ready admin UI with backend-driven menus and real-time messaging.

> Full documentation: [ypbin.cn](https://ypbin.cn/guide/admin-ui/) · [Development guide](https://ypbin.cn/guide/admin-ui/development)

## Features

- **Backend-driven Menus & Permissions** — menus are loaded from the ypbin-admin backend (`/menu/all`) with button-level permission codes
- **System Management** — users, roles, departments, posts, menus, dictionaries, configs, tenants, permission templates
- **Messaging Center** — in-site messages with real-time push via SSE, notification/announcement publishing with rich text
- **Scheduled Tasks** — Cron-based task management with execution logs
- **Multi-tenant Isolation** — tenant-scoped data and permission templates
- **Enterprise Baseline** — i18n (zh-CN / en-US), theming, dark mode, custom preferences

## Tech Stack

- [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) + [pnpm](https://pnpm.io/) + [Turbo](https://turbo.build/) monorepo
- [Ant Design Vue](https://next.antdv.com/)
- [Vben Admin 5.x](https://github.com/vbenjs/vue-vben-admin) as the base framework

## Quick Start

The frontend requires the backend service to be running (see the backend's `DEVELOPMENT-PLAN.md` for how to start it).

```bash
# install dependencies
pnpm install

# start the web-antd application
pnpm dev:antd
```

Then open http://localhost:5666 (or the port printed in the terminal).

## Project Structure

```
apps/
  web-antd/          # the ypbin-admin web application (Ant Design Vue)
packages/            # shared libraries (layouts, common-ui, preferences, ...)
internal/            # build tooling (vite-config, eslint-config, ...)
```

## License

[Ypbin Admin](https://github.com/wenbin-wb/ypbin-admin-ui) is [MIT licensed](./LICENSE).

This project is derived from [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin) (MIT, Copyright (c) 2024-present, Vben). We keep the original copyright and license notice as required by the MIT License. The ypbin-admin modifications and additions are Copyright (c) 2026-present, ypbin-admin authors.
