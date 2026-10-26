import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearTargetNameResolvers,
  getTargetNameResolver,
  registeredResolverCount,
  registerTargetNameResolver,
  TARGET_TYPE_DEVICE,
} from './target-name-resolver';

describe('target-name-resolver（空间关联对象名解析注册表）', () => {
  afterEach(() => {
    clearTargetNameResolvers();
  });

  it('★ 未注册时返回 undefined（基础模块据此退化为显示 ID，不报错）', () => {
    expect(getTargetNameResolver(TARGET_TYPE_DEVICE)).toBeUndefined();
    expect(registeredResolverCount()).toBe(0);
  });

  it('注册后可取回同一实现', async () => {
    const resolver = vi.fn(async () => ({ '1': '温湿度传感器' }));
    registerTargetNameResolver(TARGET_TYPE_DEVICE, resolver);

    const got = getTargetNameResolver(TARGET_TYPE_DEVICE);
    expect(got).toBe(resolver);
    // 先断言存在再调用（不用 ! 非空断言——lint 禁止，且断言失败信息更清楚）
    expect(got).toBeDefined();
    if (!got) {
      throw new Error('解析器未注册');
    }
    await expect(got('device', ['1'])).resolves.toEqual({
      '1': '温湿度传感器',
    });
  });

  it('按类型隔离：注册 device 不影响 dept', () => {
    registerTargetNameResolver(TARGET_TYPE_DEVICE, async () => ({}));
    expect(getTargetNameResolver('dept')).toBeUndefined();
  });

  it('重复注册同一类型时后注册的生效（允许运行时覆盖）', async () => {
    registerTargetNameResolver(TARGET_TYPE_DEVICE, async () => ({ a: '旧' }));
    registerTargetNameResolver(TARGET_TYPE_DEVICE, async () => ({ a: '新' }));

    const got = getTargetNameResolver(TARGET_TYPE_DEVICE);
    if (!got) {
      throw new Error('解析器未注册');
    }
    await expect(got('device', ['a'])).resolves.toEqual({ a: '新' });
    expect(registeredResolverCount()).toBe(1);
  });

  it('★ 用 Map 存储：不受原型链键污染（constructor/__proto__ 不应命中）', () => {
    // 若用普通对象，obj['constructor'] 会返回 Object 构造函数（真值）⇒ 抽屉会把它当解析器调用而崩
    expect(getTargetNameResolver('constructor')).toBeUndefined();
    expect(getTargetNameResolver('__proto__')).toBeUndefined();
    expect(getTargetNameResolver('toString')).toBeUndefined();
  });

  it('clear 后全部失效（测试隔离用）', () => {
    registerTargetNameResolver('device', async () => ({}));
    registerTargetNameResolver('dept', async () => ({}));
    clearTargetNameResolvers();
    expect(registeredResolverCount()).toBe(0);
  });
});
