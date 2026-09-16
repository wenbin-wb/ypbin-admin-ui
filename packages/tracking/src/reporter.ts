/**
 * 批量上报器。
 *
 * 设计约束（与后端采集链路的语义对称）：
 * - **不阻塞业务**：入队即返回，上报全部异步进行；
 * - **不重试**：失败只告警不重试——重试会在网络故障时放大流量，而后端是「允许丢弃」的语义；
 * - **离页兜底**：`pagehide` / `visibilitychange` 时用 `sendBeacon` 上报，普通请求在卸载阶段会丢；
 * - **失败可见**：拒绝与失败都会打印告警，不静默吞掉；
 * - **身份可选**：宿主提供 `getToken` 时带上 `Authorization: Bearer <token>`（网关据此注入身份头），
 *   取不到令牌则保持匿名上报——**取令牌失败绝不阻断上报**。
 */
import type {
  TrackEventBody,
  TrackIngestResult,
  TrackingOptions,
} from './types';

/** 队列上限：与后端「有界队列 + 丢弃可观测」的思路一致，避免前端无限堆积 */
const MAX_QUEUE_SIZE = 200;

export class Reporter {
  private readonly options: TrackingOptions;

  private queue: TrackEventBody[] = [];

  private timer: null | ReturnType<typeof setInterval> = null;

  private stopped = false;

  public constructor(options: TrackingOptions) {
    this.options = options;
    if (options.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, options.flushIntervalMs);
    }
  }

  /** 入队；队列满时丢弃最旧的事件并告警（埋点允许丢弃，但必须可见） */
  public enqueue(event: TrackEventBody): void {
    if (this.stopped) {
      return;
    }
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift();
      console.warn(
        '[tracking] 本地队列已满，丢弃最旧的一条事件（埋点允许丢弃，但请关注上报是否持续失败）',
      );
    }
    this.queue.push(event);
    if (this.queue.length >= this.options.batchSize) {
      void this.flush();
    }
  }

  /** 立即上报当前队列 */
  public async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }
    const events = this.queue.splice(0, this.options.batchSize);
    await this.send(events, false);
  }

  /** 离页兜底：用 sendBeacon 上报，避免卸载阶段丢数据 */
  public flushOnHide(): void {
    if (this.queue.length === 0) {
      return;
    }
    const events = this.queue.splice(0, this.options.batchSize);
    const body = JSON.stringify({ appId: this.options.appId, events });
    if (globalThis.navigator?.sendBeacon) {
      // 注意：sendBeacon 的规范不允许设置请求头，因此这一批在服务端仍是匿名身份
      // （拿身份去换「最后一批必达」不划算：事件丢了就彻底没了，匿名总比丢失好）。
      const sent = globalThis.navigator.sendBeacon(
        this.options.url,
        new Blob([body], { type: 'application/json' }),
      );
      if (!sent) {
        console.warn('[tracking] sendBeacon 上报失败，事件已丢弃');
      }
      return;
    }
    void this.send(events, true);
  }

  /** 停止定时器（不丢弃队列，调用方应先 flush） */
  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 组装请求头：拿到令牌才加 `Authorization: Bearer <token>`，否则只带 `Content-Type`。
   *
   * 取令牌失败（回调抛异常）时**降级为匿名上报**并告警，而不是让整批事件失败——
   * 埋点是旁路能力，绝不能因为身份获取的问题影响或阻断数据上报。
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let token: string | undefined;
    try {
      token = this.options.getToken?.();
    } catch (error) {
      console.warn('[tracking] 获取访问令牌失败，本批将匿名上报', error);
      return headers;
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private async send(
    events: TrackEventBody[],
    keepalive: boolean,
  ): Promise<void> {
    try {
      const response = await fetch(this.options.url, {
        body: JSON.stringify({ appId: this.options.appId, events }),
        headers: this.buildHeaders(),
        keepalive,
        method: 'POST',
      });
      if (!response.ok) {
        console.warn(
          `[tracking] 上报失败：HTTP ${response.status}，本批 ${events.length} 条已丢弃`,
        );
        return;
      }
      const body = (await response.json()) as { data?: TrackIngestResult };
      const result = body?.data;
      if (result && (result.rejected > 0 || result.dropped > 0)) {
        console.warn(
          `[tracking] 服务端未全部接收：accepted=${result.accepted} rejected=${result.rejected} dropped=${result.dropped} reasons=${JSON.stringify(result.reasons)}`,
        );
      }
    } catch (error) {
      console.warn(
        `[tracking] 上报异常，本批 ${events.length} 条已丢弃（刻意不重试，避免故障时放大流量）`,
        error,
      );
    }
  }
}
