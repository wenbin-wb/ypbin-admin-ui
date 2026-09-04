---
name: vben-ui-dev
description: ypbin-admin-ui 前端开发与合规审计标准。开发任何 web-antd 页面/组件，或审查已有前端代码是否合规时使用。强制优先复用 vben 自带组件与项目 adapter 层，禁止直接裸用 antd 表单组件、禁止字段改名映射、文案强制走 $t。
---

# vben-ui-dev — ypbin-admin-ui 前端标准

面向 `apps/web-antd`（Vue3 + ant-design-vue + vben5 monorepo）。两种模式：

- **开发模式**：写新页面/组件时，严格按下面的配方与铁律落地。
- **审计模式**：审查已有代码时，逐条对照「铁律」与「审计清单」，输出违规项 + 整改建议。

作者署名统一 `wenbin`。改动只编译验证不启动服务（见项目 memory）。

## 铁律（RED — 违反即判不合格，必须整改）

> **关于「优先复用」类铁律的定位**：vben 官方立场是组件可选、非强制（「使用与否，完全取决于你的需求与自由」）。本项目为求团队内统一，把它收紧为**默认强制**——但保留豁免出口，不是死规定。
>
> **豁免机制（仅适用于标了「可豁免」的 R1–R4）**：当 vben 组件/adapter 确实不合用时，允许用原生 antd 或自封装组件，但**必须在该处上方留一行豁免注释说明理由**：
> ```vue
> <!-- vben-ui-dev-exempt: R3 vxe 不支持嵌套合并行的树形汇总，改用 a-table 手写 -->
> ```
> 审计时：带合规豁免注释的按通过处理（但会复核理由是否成立）；无注释的裸用即判违规。R5–R9 是项目硬约束，**不可豁免**。

1. **优先复用，不重造轮子**（可豁免）。写任何 UI 前，先按此顺序找现成的：
   `#/adapter`（项目封装层）→ `@vben/common-ui`（Page/Tree/useVbenForm/useVbenModal/useVbenDrawer/EllipsisText/IconPicker 等）→ `playground/src/views/examples/*`（vben 官方示例：form/modal/drawer/vxe-table/cropper/tiptap…）。确认没有再自己写。找到了就照它的用法来。

2. **表单组件必须走 vben schema，禁止在业务页面裸 import antd 表单控件**（可豁免）。表单字段一律用 `useVbenForm` + schema 的 `component: 'Input' | 'Select' | 'ApiSelect' | 'ApiTreeSelect' | 'RadioGroup' | 'InputPassword' | 'RichEditor' | 'Upload' | ...`（完整清单见 `apps/web-antd/src/adapter/component/index.ts` 的 `ComponentType`）。需要新组件类型时，在 adapter 里注册，不在页面里直接 `import { Select } from 'ant-design-vue'` 拼表单。
   - 例外：纯展示/布局用途的 antd 组件（`Card`/`Button`/`Modal.confirm`/`message`/`InputSearch`）可直接用，现有页面即如此。判据是「是不是表单录入控件」——是就走 schema。

3. **表格必须走 `useVbenVxeGrid`（`#/adapter/vxe-table`），不手写 `<a-table>`**（可豁免）。
   - 单元格渲染用已注册的渲染器：状态标签 `cellRender: { name: 'CellTag' }`、开关 `CellSwitch`、图片 `CellImage`、链接 `CellLink`。不要在列里手写 `h(Tag)`/`h(Switch)`。缺渲染器就在 `vxe-table.ts` 里 `vxeUI.renderer.add` 注册。
   - 数据走 `proxyConfig.ajax.query`，返回结构约定 `{ items, total }`（adapter 已配 `response: { result: 'items', total: 'total' }`）。

4. **操作列必须用 `VbenTableAction`（`#/adapter/vxe-table`）**（可豁免），通过 `actions` / `dropdownActions` 声明；权限用每个 action 的 `auth: 'AC_xxx'` 字段（adapter 内部已注入 `hasPermission`，页面不再传 `:has-permission`）。删除用 `popConfirm`。

5. **列表页标准骨架**：`Page` 包裹 → `useVbenVxeGrid` 出表 → `useVbenDrawer`/`useVbenModal` 挂表单弹层。列定义与搜索/表单 schema 抽到同目录 `data.ts`（导出 `useColumns` / `useFormSchema` / `useGridFormSchema`），`list.vue` 只做编排。弹层表单放 `modules/form.vue` 等。参照 `views/system/user/`（最完整）。

6. **所有用户可见文案必须走 `$t()`，禁止硬编码中文字符串**。且：
   - `system.<模块>.name` 表示**实体名**（"用户"/"角色"/"部门"），用于 `ui.actionTitle.create/edit` 等；字段"用户名"这类用专门的 key（如 `userName`）。zh-CN 与 en-US 两份都要加。
   - 带占位符的 key 传**数组**参数：`$t('ui.actionTitle.create', [$t('system.user.name')])`。不要给无占位符的 `common.create`（纯"新增"）传实体名——拼不进去，会漏字。
   - 弹层标题统一 `$t('ui.actionTitle.create'|'edit', [实体名])`，不要用 `common.add` 简写（风格不统一）。

7. **字段全程同名（继承项目铁律）**。DB 字段 = 后端实体 = 接口 JSON = 前端 TS 类型/表单 fieldName/表格 field，全程同一个名字。**禁止任何字段改名映射**（不 `data.map` 重命名、不在 api 层转 key）。详见项目 memory `ypbin-no-field-mapping`。

8. **不做掩盖问题的静默降级（继承项目铁律）**。接口/渲染异常要暴露（`console.error` + 用户可感知提示），不要 catch 后吞掉返回空数组假装正常。详见项目 memory `ypbin-no-silent-fallback`。

9. **Long 型 ID 全程按字符串处理**。id/deptId/roleId 等在 TS 类型里是 `string`，比较用字符串，别 `Number()`。详见项目 memory `ypbin-code-conventions`。

10. **弹层共享数据必须声明类型契约**。`useVbenDrawer`/`useVbenModal` 的 `getData()` **没有泛型参数**（上游 5.6 起移除），类型由 hook 上的 `TData` 决定：
    - 在 connected 子组件里 `useVbenDrawer<XxxData>({...})` + 文件末尾 `defineExpose({ drawerApi })`，父组件 `useVbenDrawer({ connectedComponent: Form })` 即自动推导，父组件不重复声明泛型。
    - 禁止 `getData<Record<string, any>>()`、`getData<any>()` 这类旧写法（编译期就会报 `Expected 0 type arguments`）。
    - 「新增」语义一律 `setData(null)`，**不要 `setData({})`**：`{}` 是 truthy，`if (data)` 判不出来，回填/清空分支会变成死代码。TData 相应写成 `XxxResp | null`（eslint `perfectionist/sort-union-types` 按字母序：类型名（大写字母）排在 `null` 前，如 `AiApi.ModelConfig | null`；把 `null` 写前面会直接 lint 报错）。
    - `getData()` 在没调用过 `setData()` 时返回 `undefined`，取值一律 `data?.xxx`，别断言非空。
    - **不改写 `getData()` 返回的共享对象**（它是父组件传进来的同一个引用）。要调整取值就展开成新对象：`formApi.setValues({ ...data, pid: data.pid === 0 ? undefined : data.pid })`。
    - `formApi.resetForm()` / `resetValidate()` 已 `@deprecated`（运行时打告警），统一用 `formApi.reset()`。
    详见项目 memory `admin-popup-form-reset`、`admin-ui-upstream-sync`。

11. **文件下载与导入导出标准化**。
    - **文件下载**：统一使用 `#/utils/file` 的 `downloadByBlob(blob, fileName)` 工具函数，自动处理 Blob URL 生命周期与释放，禁止在业务页面内联裸写临时 `<a>` 标签。
    - **导入弹窗**：导入操作禁止直接塞在 `list.vue` 中，必须在 `modules/import.vue` 中使用 `useVbenModal` 独立封装，支持模板下载、`Upload.Dragger` 拖拽与错误行明细折叠展示。
    - **权限与契约**：导出操作共用列表权限 `v-access:code="['system:xxx:list']"`（GET 请求），导入操作共用新增权限 `v-access:code="['system:xxx:add']"`（POST Multipart 请求）。

## 建议（YELLOW — 应遵循，有正当理由可偏离并说明）

- 图标用 `@vben/icons`（`Plus` 等具名导出）或 `IconifyIcon`，不散引第三方图标库。
- **企业级界面禁止用 emoji 当头像/图标/占位符**（AI 模块 2026 整改定稿）。emoji 让企业后台显得像低质 AI 生成物。需要角色/对象视觉标识时用中立设计：CSS 圆形色块 + 首字符/短标签（角色头像用分类色 + 首字如「译/码/析」），或用 @vben/icons 具名 lucide 图标；头像默认显示用户/角色首字符。全项目排查 emoji 字符命中即整改。
- 下拉数据源优先 `ApiSelect`/`ApiTreeSelect` + `api`/`labelField`/`valueField`，不在页面里手动拉数据塞 options。
- Select 面板宽度已在 adapter 设 `popupMatchSelectWidth: false`，别再逐页覆盖。
- 状态开关的即时切换走 `CellSwitch` 的 `beforeChange`（返回 `false` 中止），配 `Modal.confirm` 二次确认，参照 `user/list.vue` 的 `onStatusChange`。
- 组件/文件命名、注释密度向同目录既有代码看齐。后端代码注释不要出现前端契约/vben 等字样（memory `ypbin-code-comment-no-frontend`，前端反之亦然，注释聚焦前端）。

## 开发模式：新建列表页配方

参照 `views/system/user/`（最全）或 `views/system/role/`（较简）。目录结构：

```
views/system/<模块>/
  list.vue            # 只做编排：Page + Grid + 弹层
  data.ts             # useColumns / useGridFormSchema(搜索) / useFormSchema(表单)
  modules/form.vue    # 新增/编辑弹层，useVbenDrawer 或 useVbenModal
```

`list.vue` 骨架（省略业务细节）：

```vue
<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemXxxApi } from '#/api';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteXxx, getXxxList } from '#/api';
import { $t } from '#/locales';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({ connectedComponent: Form });

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getXxxList({ page: page.currentPage, pageSize: page.pageSize, ...formValues }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<SystemXxxApi.SystemXxx>,
});

function onRefresh() { gridApi.query(); }
function onCreate() { formDrawerApi.setData(null).open(); }
function onEdit(row: SystemXxxApi.SystemXxx) { formDrawerApi.setData(row).open(); }
function onDelete(row: SystemXxxApi.SystemXxx) { /* deleteXxx + message + onRefresh */ }
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.xxx.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.xxx.name')]) }}
        </Button>
      </template>
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            { text: $t('common.edit'), icon: 'lucide:edit', onClick: () => onEdit(row) },
            { text: $t('common.delete'), icon: 'lucide:trash-2', danger: true,
              auth: 'AC_xxx',
              popConfirm: { title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                            confirm: () => onDelete(row) } },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
```

`data.ts` 要点：
- `useColumns()` 返回列数组；状态列 `cellRender: { name: 'CellTag' }`、操作列 `slots: { default: 'action' }`。
- `useFormSchema()` / `useGridFormSchema()` 返回 `VbenFormSchema[]`，字段用 `component` + `fieldName`（与后端同名）+ `label: $t(...)` + `rules`。
- 参照 `views/system/user/data.ts`。

## 开发模式：弹层表单配方（modules/form.vue）

新增/编辑弹层的标准结构（参照 `views/system/role/modules/form.vue`）：`useVbenForm` 出表单 + `useVbenDrawer`（或 `useVbenModal`）管弹层，标题按有无 id 切「新增/修改+实体名」。

```ts
const [Form, formApi] = useVbenForm({ schema: useFormSchema(), showDefaultActions: false });
const id = ref<string>();

// 共享数据契约：新增传 null，编辑传整行（铁律10）
type XxxFormData = null | SystemXxxApi.SystemXxx;

const [Drawer, drawerApi] = useVbenDrawer<XxxFormData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();                              // 提交期间锁定，防重复
    (id.value ? updateXxx(id.value, values) : createXxx(values))
      .then(() => { emits('success'); drawerApi.close(); })
      .catch(() => { drawerApi.unlock(); });       // 失败解锁，不吞异常（铁律8）
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();              // 无泛型参数（铁律10）
    formApi.reset();                               // 不是 resetForm()，那个已废弃
    id.value = data?.id;
    await nextTick();                              // 等字段挂载再回填
    if (data) formApi.setValues(data);
  },
});

defineExpose({ drawerApi });                       // 让父组件自动推导 TData

const getDrawerTitle = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('system.xxx.name')])
    : $t('ui.actionTitle.create', [$t('system.xxx.name')]));
```

要点：`lock()`/`unlock()` 防重复提交；`onOpenChange` 里 `reset()` → `nextTick()` → `setValues()` 顺序不能乱（否则回填丢失）；标题用带占位符的 `ui.actionTitle.*`（铁律6），不用 `common.add`。

对应的父组件调用（`list.vue`）：新增 `setData(null)`、编辑 `setData(row)`：

```ts
function onCreate() { formDrawerApi.setData(null).open(); }
function onEdit(row: SystemXxxApi.SystemXxx) { formDrawerApi.setData(row).open(); }
```

若「新增」还要带上下文（树形结构的父节点 id 等），TData 用 `Partial` 放宽，并在子组件里靠 `'id' in data` 区分编辑/新增：

```ts
type DeptFormData = Partial<SystemDeptApi.SystemDept> | null;   // list.vue 传 { pid: row.id }
```

无法从 connected component 推导（泛型 SFC、函数式组件、被标注为宽 `Component`）时，两种兜底：父子都显式写 `useVbenDrawer<XxxData>()`，或在独立模块里预绑定契约工厂 `export const useXxxDrawer = createVbenDrawer<XxxData>()`。三种方式优先级：显式泛型 > 自动推导 > `unknown`。三种写法的可运行示例见 `playground/src/views/examples/{drawer,modal}/typed-data-*`。

## 开发模式：弹层 emits 命名约定（2026-08 全量审核定稿）

子组件弹层保存成功的事件名按**行为语义**统一，只有三种：

| 事件名 | 语义 | 适用 |
|--------|------|------|
| `['success']` | 保存成功 → **关闭弹层** + 父组件刷新 | 标准新增/编辑表单弹层（dict/config/role/dept/post/user/license 等） |
| `['reload']` | 保存成功 → **不关闭弹层**，仅刷新父列表 | 抽屉内连续录入/编辑（job/tenant/notice/dictItem/auth-template 的 form） |
| `['success', 'secret']` 等附加事件 | 保存成功关闭 + 额外回传数据 | 创建后需要回传密钥等一次性数据（app/client 的 secret 事件） |

- 事件名不加 `update`/`saved` 等变体；新弹层先判断「关不关」，关 = `success`，不关 = `reload`。
- 变量名统一 `emit`（或 `emits`），函数内 `emit('success')`。

## 开发模式：复用自封装共享组件

`views/system/_shared/` 放项目自封装的复合组件，是「优先复用」的一等来源，别重造：
- `CronInput` — Spring Cron 双模式编辑器：常用模式只处理可无损往返的秒/分/时/日/月/周表达式，高级模式原样保留 `L/W/#`、英文别名、宏及日周 AND 等完整语法；不可视化不等于非法，禁止静默改写。前端提示与预览只提供交互反馈，保存和调度注册仍以后端 `CronService` 的 Spring 校验为权威。
- `ImageUpload` — 带裁剪的图片上传（通知封面、头像用）
- `MessagePreview` — 消息预览

**接入方式：表单具名 slot，不是 schema 的 `component`**。schema 里给字段留 slot，模板里用 `#<fieldName>` 填组件并 `v-bind="slotProps.componentField"` 透传值：

```vue
<Form>
  <template #cron="slotProps">
    <CronInput v-bind="slotProps.componentField" />
  </template>
</Form>
```

参照 `job/modules/form.vue`（CronInput）、`notice/modules/form.vue`（ImageUpload）。

## 开发模式：API 层规范（api/system/*.ts）

一个模块一个文件，结构固定（参照 `api/system/role.ts`）：

> **微服务版提示**：微服务版（feature/microservice 分支）后端 API 路径带服务前缀（如 `/system/**`、`/ai/**`、`/auth/**`），由网关（18080）统一路由。前端 `requestClient` 的 baseURL 指向网关即可，**api 文件里的路径需与服务前缀对齐**（如 `api/system/role.ts` 的 URL 写 `/system/role/list`）；dev 代理与生产 nginx 需把前缀转发到网关，勿直连各服务端口。

```ts
import { requestClient } from '#/api/request';

export namespace SystemXxxApi {          // 类型收进 namespace
  export interface SystemXxx {
    id: string;                          // Long 全程字符串（铁律9）
    name: string;                        // 字段与后端/DB 全程同名（铁律7）
    status: 0 | 1;
    // ...
  }
}

async function getXxxList(params: Recordable<any>) {   // JSDoc 注释每个方法
  return requestClient.get('/system/xxx/list', { params });
}
async function createXxx(data: Omit<SystemXxxApi.SystemXxx, 'id'>) {
  return requestClient.post('/system/xxx', data);
}
async function updateXxx(id: string, data: Omit<SystemXxxApi.SystemXxx, 'id'>) {
  return requestClient.put(`/system/xxx/${id}`, data);
}
```

- `requestClient` 已配 `responseReturn: 'data'`，**自动解包到 `data`**，页面里直接拿业务数据，不用再 `.data`。别再手动剥 `code/message`。
- 新增 api 后在 `api/system/index.ts` 或 `api/index.ts` 汇出。
- 请求/响应字段名与后端 DTO 完全一致，不在 api 层做任何 key 转换（铁律7）。

**import 来源统一（2026-08 全量审核定稿）**：
- 页面/组件 `$t` 一律 `from '#/locales'`，禁 `@vben/locales`（含 `_core/authentication/*` 全部登录相关页，已统一；仅当确需 `$te` 等 `#/locales` 未导出 API 时才允许 `@vben/locales` 并注释原因）。
- API 值导入一律全路径 `#/api/system/xxx`（`#/api` 聚合器只用于 `import type` 类型导入）；`import type` 与值导入分离（禁一行 `import { fn, XxxApi }` 带出类型）。
- 同一模块内 API 函数定义唯一：删重复导出（曾出现 `user.ts` 与 `post.ts` 重复定义 `getPostList`，已收敛到 `post.ts`）。

## 开发模式：i18n 双份约定（locales/langs/{zh-CN,en-US}/system.json）

- 每个可见文案在 **zh-CN 和 en-US 两份都加**，key 路径一致，漏一份会露出 key 原文。
- 复用公共 key：`common.*`（enabled/disabled/cancel/confirm/edit/delete/more）、`ui.actionTitle.*`、`ui.actionMessage.*`、`ui.formRules.*`。
- **每个模块的 i18n key 三键分工（全项目统一，2026-08 全量审核后定稿）**：
  - `system.<模块>.name` = **实体名单数**（"用户"/"角色"/"参数"/"任务"/"岗位"/"客户端"/"公告"/"字典项"/"应用"/"租户"/"权限模板"）——只用于**弹层标题** `ui.actionTitle.create/edit` 的占位实参。
  - `system.<模块>.title` = **模块/页面标题**（"用户管理"）——用于菜单名、页面标题、面包屑。
  - `system.<模块>.<字段>Name` = **字段名标签**（`userName`/"用户名"、`roleName`/"角色名称"）——用于**表格列头与表单 label**（列 `title:` 与 schema `label:` 一律用字段名键）。
  - 三键都必须存在且语义不串：列头/表单 label 用了 `.name` 会显示成"用户/角色"（列头应是"用户名/角色名称"）；弹层标题用了 `.title` 会显示成"新建用户管理"。grep 校验：`system.xxx.name` 只允许出现在 `ui.actionTitle` 的实参里；`system.xxx.title` 只允许用于页面级标题。
- **新增/修改 key 必须 zh+en 同时落**，且改完跑 `pnpm -F @vben/web-antd run typecheck` 之外还要 grep 一遍引用点语义（防止列头/标题串键）。

## 审计模式：合规检查清单

审查前端代码时，逐条核对并输出「文件:行 → 违反第几条铁律 → 整改建议」。空表示通过。

| # | 检查点 | 快速定位 |
|---|--------|----------|
| R1 | 有没有该复用却重造的组件 | 搜自写的表格/弹窗/上传逻辑，对比 examples |
| R2 | 业务页面裸 import antd 表单控件拼表单 | `grep "from 'ant-design-vue'"` 看是否 import 了 Select/Input/DatePicker 等做录入 |
| R3 | 手写 `<a-table>` / 未走 useVbenVxeGrid | `grep "a-table\|<Table"`；列里手写 `h(Tag)`/`h(Switch)` |
| R4 | 操作列没用 VbenTableAction / 权限硬编码 | 看 `#action` slot。**AI 模块与 system 一视同仁**：AI 页面新增按钮也必须 `v-access:code`（如 `ai:prompt:create`），action 必须 `auth`（如 `ai:prompt:edit/delete`），权限码与后端 `@SaCheckPermission` 及菜单种子 `auth_code` 三向一致 |
| R5 | 列表页缺 Page/data.ts 分离 | 看 list.vue 是否内联了大量 schema。**豁免**：非 CRUD 管理页（如 `_core/message` 消息中心：store 驱动 + 自查询 + 行内预览），内联 form/columns 属合理形态，不判违规；CRUD 管理页（`views/system/*`）必须走 data.ts 三件套 |
| R6 | 硬编码中文；弹层/按钮用 `common.add` 而非 `ui.actionTitle.create`；`.name` 当实体名用但其实是字段名 | 搜 `common.add'` / `common.create'`；核对 `.name` 在 locale 里到底是实体名还是字段标签 |
| R7 | 字段改名映射 | 搜 `.map(` 里改 key、api 层转字段名 |
| R8 | catch 后吞异常/静默返回空 | 搜 `catch` 空块、`\|\| []` 掩盖错误 —— **先确认全局拦截器**（见下方注意） |
| R9 | id 用 Number() 处理 | 搜 `Number(` 是否套在 id 上 |
| R10 | 弹层共享数据没类型契约 | 搜 `getData<`（旧泛型写法）、`setData({})`（新增语义应为 `null`）、`resetForm()`/`resetValidate()`（已废弃）、connected 子组件缺 `defineExpose({ drawerApi \| modalApi })`、`getData()` 后直接改写 `data.xxx =`（污染父组件对象） |

> **审计命令注意（本机 Git-bash 踩坑）**：`grep -P`（PCRE，含中文字符类 `[一-龥]`）在 Windows Git-bash 报 `-P supports only unibyte and UTF-8 locales`，跑不了。查中文/复杂模式改用 **Grep 工具**（内置 ripgrep，支持 `-P` 且跨平台），不要用带 `-P` 的 shell grep。基础字面量匹配可用普通 `grep -rn`。

> **R8 审计前必看**：本项目 `api/request.ts` 装了全局 `errorMessageResponseInterceptor`——**任何请求失败都会全局 `message.error` 弹提示**。所以业务页里的空 `catch(() => {})`（删除/启停等）**不算 R8 违规**，它只是防未捕获 promise rejection，错误提示由全局拦截器负责。若再在 catch 里加 `message.error` 反而**双重弹窗**。R8 真正要抓的是：catch 里返回空数组/默认值**掩盖失败让流程假装成功**，或吞掉后连全局提示都进不到的情况。

审计命令示例（在 `apps/web-antd/src` 下，或直接用 Grep 工具）：

```bash
grep -rn "from 'ant-design-vue'" views/system --include=*.vue   # R2：看是否 import 录入控件（Button/message 豁免）
grep -rn "common\.add'\|common\.create'" views --include=*.vue   # R6：弹层/按钮标题风格
grep -rn "<a-table\|useTable(" views --include=*.vue             # R3：手写表格
grep -rn "getData<\|setData({})\|resetForm()\|resetValidate()" views --include=*.vue   # R10：弹层共享数据旧写法
```

R10 的「connected 子组件缺 defineExpose」不好用单条 grep 表达，用这段：

```bash
for f in $(grep -rl "Api\.getData()" --include=*.vue views); do
  grep -q "defineExpose" "$f" || echo "缺 defineExpose: $f"
done
```

## 验证

前端有 node/pnpm（本机命令行无 java/mvn）。改完前端代码后按需过下面这套本仓库既有管线（不要自造校验方式）：

```bash
pnpm -F @vben/web-antd run typecheck   # 类型检查（单包，最常用）
pnpm check:type                         # 全仓 turbo typecheck
pnpm lint                               # = vsh lint，跑 oxlint + eslint + stylelint
pnpm format                             # = vsh lint --format，自动修格式
pnpm check:cspell                       # 拼写检查
```

- 工具链：**oxfmt**（格式）+ **oxlint**（主 lint）+ **eslint**（Vue/JSONC/YAML 补充）+ **stylelint**（样式）+ **cspell**（拼写），配置在 `internal/lint-configs`。别引入 prettier 等重复工具。
- 只编译验证、不启动服务（见项目 memory `ypbin-admin-workflow`）；HMR 下可直接在浏览器验证渲染。
- 提交时 lefthook 的 `pre-commit` 会自动对暂存文件跑 lint/format，`commit-msg` 会跑 commitlint。别用 `--no-verify` 绕过。

## 提交规范（Angular Conventional Commits）

commit message 走 Angular 规范，type 限这些：`feat`（新功能）、`fix`（修 bug）、`style`（纯格式）、`perf`（优化）、`refactor`（重构）、`revert`（回滚）、`test`、`docs`（文档/注释）、`chore`（依赖/脚手架）、`workflow`、`ci`、`types`（类型变更）。

格式 `type(scope): 描述`，例：`feat(system-user): 新增用户批量导入`。可用 `pnpm commit`（czg 交互式）辅助生成。

