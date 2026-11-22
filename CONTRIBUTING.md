# 贡献指南

欢迎参与 ypbin-admin-ui 的贡献！本文件说明如何提交 Issue、编写代码与发起 Pull Request。

## 1. 提交 Issue

- **Bug 报告**：使用 [Bug 模板](.github/ISSUE_TEMPLATE/bug_report.yml)，说明复现步骤、期望/实际行为、浏览器与版本。
- **功能建议**：使用 [Feature 模板](.github/ISSUE_TEMPLATE/feature_request.yml)，说明使用场景。
- 提交前先搜索是否已有相同 Issue。

## 2. 环境准备

- Node.js 22 + pnpm 11（`packageManager` 已锁定）
- 安装依赖：`pnpm install`
- 常用命令：
  - `pnpm dev`：启动 web-antd 开发服务
  - `pnpm typecheck`：全量类型检查
  - `pnpm build`：生产构建
  - `pnpm lint` / `pnpm format`：代码检查与格式化
  - `pnpm check`：提交前全量校验（oxlint/oxfmt/eslint/stylelint/typecheck）

## 3. 开发规范

- **页面文案一律走 i18n**（`apps/web-antd/src/locales`），禁止硬编码中文；演示页除外（已标注豁免）
- 类型优先：禁 `any` 滥用（业务代码 `catch (error: any)` 用 `extractErrorMessage` 替代）
- 组件拆分：超 600 行组件应抽 composable / 子组件；逻辑复用走 `use-*` 组合式函数
- API 层集中在 `src/api`，按域分文件（`#/api/ai` 等桶导出）；DTO 类型与后端字段全程同名
- 提交前运行 `pnpm check` 保证全绿

## 4. 提交规范

- Conventional Commits：`type(@vben/web-antd): 描述`，如 `fix(@vben/web-antd): 修复导入弹窗文件校验`
- pre-commit 钩子（lefthook）会自动执行 lint/format/typecheck/commitlint，请勿跳过
- 不要添加 `Co-Authored-By` 尾注

## 5. 发起 Pull Request

1. 从 `main` 拉取最新代码，新建功能分支
2. 按 [PR 模板](.github/pull_request_template.md) 填写
3. 确保 CI 通过（typecheck + build + CodeQL）
4. 新功能必须有对应类型定义；接口字段变更需同步后端契约与 site 文档

## 6. 与 fork `ypbin-iot-ui` 的关系（改公共代码前必读）

本仓是 **IoT 前端的上游**：`ypbin-iot-ui` 从本仓 `main` fork，只保留 IoT 专属页面与品牌，
公共部分（`apps/web-antd/src`、`packages`、`internal`）应当与本仓保持一致。

- **改公共文件时**：等于同时影响两个产品。改完请顺手跑
  `FORK_UI_ROOT=../ypbin-iot-ui pnpm fork:report`
  看 fork 是否会因此产生新分歧；若你的改动属于**通用缺陷修复**，请在 PR 描述里注明
  「需要同步到 ypbin-iot-ui」，由 fork 侧合并即可（方向：本仓 → fork，正常 merge）。
- **反哺方向**（fork → 本仓）：`ypbin-iot-ui` 若在公共文件上修了通用缺陷，
  正确做法是**在本仓单独提 PR 采纳同一修复**，而不是让它长期只存在于 fork ——
  否则本仓会一直带着同一个 bug。用 `pnpm fork:report` 可以看到 fork 当前领先本仓哪些文件。
- 为什么不在本仓设强制门禁：本仓是先有的一方，fork 的定制是**它的**事；
  强制门禁会把 fork 的定制变成对本仓的约束。故本仓只做**报告**，「要不要反哺」由人判断。
