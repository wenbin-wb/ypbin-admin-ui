import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMessageStore } from './message';

const api = vi.hoisted(() => ({
  deleteMessage: vi.fn(),
  getMessageList: vi.fn(),
  getRecentMessages: vi.fn(),
  getSseTicket: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllMessagesRead: vi.fn(),
  markMessageRead: vi.fn(),
}));

vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: 'http://api.example.test' }),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/api/system/message', () => api);

describe('message store', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retries ticket acquisition failure until it connects', async () => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    const store = useMessageStore();
    api.getSseTicket
      .mockRejectedValueOnce(new Error('ticket failed'))
      .mockResolvedValueOnce({ ticket: 'new-ticket' });

    await store.startSse();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.getSseTicket).toHaveBeenCalledTimes(2);
    store.closeSse();
    vi.useRealTimers();
  });

  it('cancels pending SSE retry on close', async () => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    const store = useMessageStore();
    api.getSseTicket.mockRejectedValueOnce(new Error('ticket failed'));

    await store.startSse();
    expect(api.getSseTicket).toHaveBeenCalledTimes(1);

    store.closeSse();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.getSseTicket).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('synchronizes recent messages and unread count after a single read', async () => {
    setActivePinia(createPinia());
    const store = useMessageStore();
    api.getRecentMessages.mockResolvedValue([
      {
        content: '<p>content</p>',
        createTime: '2026-08-10 10:00:00',
        id: '1',
        messageType: 1,
        readStatus: 1,
        title: 'title',
      },
    ]);
    api.getUnreadCount.mockResolvedValue(0);
    api.markMessageRead.mockResolvedValue(undefined);

    await store.markRead('1');

    expect(api.markMessageRead).toHaveBeenCalledWith('1');
    expect(store.unreadCount).toBe(0);
    expect(store.notifications[0]).toMatchObject({ id: '1', isRead: true });
  });
});
