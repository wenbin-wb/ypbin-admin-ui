import { describe, expect, it, vi } from 'vitest';

import { useColumns } from './data';

// 只断言列定义里的映射，不渲染组件：`$t` 换成可断言的假翻译
vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

interface AppTagOption {
  color: string;
  label: string;
  value: string;
}

describe('埋点事件列表的应用列', () => {
  it('默认可见，并用 CellTag 渲染可读的客户端标签', () => {
    const appColumns = (useColumns() ?? []).filter(
      (column) => column.field === 'appId',
    );

    // 旧实现里还有一个默认隐藏的 appId 列，必须只剩一个，否则会出现两列同名
    expect(appColumns).toHaveLength(1);

    const [appColumn] = appColumns;
    expect(appColumn?.visible).not.toBe(false);

    const cellRender = appColumn?.cellRender as {
      name: string;
      options: AppTagOption[];
    };
    expect(cellRender.name).toBe('CellTag');

    // 值必须与各端实际上报的 appId 一致；空串兜底成「未设置」
    expect(cellRender.options.map((item) => item.value)).toEqual([
      'ypbin-admin-ui',
      'cardtab-miniapp',
      'ypbin-iot-ui',
      '',
    ]);
    expect(cellRender.options.map((item) => item.label)).toEqual([
      'tracking.events.appTagAdmin',
      'tracking.events.appTagMiniapp',
      'tracking.events.appTagIot',
      'tracking.events.appTagUnset',
    ]);
  });
});
