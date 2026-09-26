import { ApplicationRef, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import { NotificationsApiService } from '@pu-stats/data-access';
import { of, Subject } from 'rxjs';

import { ANNOUNCEMENTS } from '../core/feature-announcement.service';
import { UserConfigStore } from '../core/user-config.store';
import type { InboxRow } from './inbox-rows';
import { NotificationStore } from './notification.store';

function row(overrides: Partial<InboxRow> = {}): InboxRow {
  return {
    id: 'n1',
    kind: 'notification',
    category: 'social',
    icon: 'favorite',
    text: 'Anna feuert dich an',
    createdAt: '2026-09-20T08:00:00.000Z',
    unread: true,
    url: '/freunde',
    ...overrides,
  };
}

function deferred<T = void>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve: (value: T) => resolve(value) };
}

describe('NotificationStore', () => {
  const api = {
    watch: vitest.fn().mockReturnValue(of([])),
    markRead: vitest.fn(),
    remove: vitest.fn(),
  };
  const config = {
    config: signal<{ ui?: { seenAnnouncements?: string[] } } | null>({
      ui: { seenAnnouncements: [] },
    }),
    loaded: signal(true),
    markAnnouncementSeen: vitest.fn(),
  };

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: NotificationsApiService, useValue: api },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: UserConfigStore, useValue: config },
      ],
    });
    return TestBed.inject(NotificationStore);
  }

  beforeEach(() => {
    vitest.clearAllMocks();
    config.loaded.set(true);
    config.config.set({ ui: { seenAnnouncements: [] } });
  });

  it('should report no unread rows while the user config is still loading', () => {
    // given
    config.loaded.set(false);
    config.config.set(null);
    const store = setup();

    // then
    expect(store.unreadCount()).toBe(0);
    expect(store.hasUnread()).toBe(false);
    expect(store.rows()).toEqual([]);
    expect(store.loaded()).toBe(false);
  });

  it('should count only unseen announcements once the user config arrived', () => {
    // given
    config.loaded.set(false);
    config.config.set(null);
    const store = setup();
    expect(store.unreadCount()).toBe(0);

    // when
    config.config.set({
      ui: { seenAnnouncements: ANNOUNCEMENTS.map((a) => a.id) },
    });
    config.loaded.set(true);
    TestBed.tick();

    // then
    expect(store.loaded()).toBe(true);
    expect(store.rows()).toHaveLength(ANNOUNCEMENTS.length);
    expect(store.unreadCount()).toBe(0);
  });

  it('should report loaded only once the inbox listener delivered its first snapshot', async () => {
    // given
    const inbox = new Subject<never[]>();
    api.watch.mockReturnValueOnce(inbox);
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: NotificationsApiService, useValue: api },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: UserConfigStore, useValue: config },
      ],
    });
    const store = TestBed.inject(NotificationStore);

    // then
    expect(store.loaded()).toBe(false);

    // when
    TestBed.tick();
    inbox.next([]);
    await TestBed.inject(ApplicationRef).whenStable();

    // then
    expect(store.loaded()).toBe(true);
  });

  it('should flag the row as opening until its read mark settles', async () => {
    // given
    const write = deferred();
    api.markRead.mockReturnValue(write.promise);
    const store = setup();

    // when
    const pending = store.markRead(row());

    // then
    expect(store.rowBusy.isBusy('open:n1')).toBe(true);
    expect(store.rowBusy.isBusy('remove:n1')).toBe(false);

    // when
    write.resolve();
    await pending;

    // then
    expect(store.rowBusy.isBusy('open:n1')).toBe(false);
  });

  it('should flag the row as removing until its delete settles', async () => {
    // given
    const write = deferred();
    api.remove.mockReturnValue(write.promise);
    const store = setup();

    // when
    const pending = store.remove(row());

    // then
    expect(store.rowBusy.isBusy('remove:n1')).toBe(true);

    // when
    write.resolve();
    await pending;

    // then
    expect(store.rowBusy.busy()).toBe(false);
  });

  it('should not flag an announcement as removing, since it has nothing to delete', async () => {
    // given
    const store = setup();

    // when
    await store.remove(row({ kind: 'announcement', id: 'feature-1' }));

    // then
    expect(api.remove).not.toHaveBeenCalled();
    expect(store.rowBusy.busy()).toBe(false);
  });

  it('should flag markAllRead busy until every unread announcement is marked seen', async () => {
    // given — no seen announcements, so every shipped announcement is unread
    const seen = deferred();
    config.markAnnouncementSeen.mockReturnValue(seen.promise);
    const store = setup();
    TestBed.tick();

    // when
    const pending = store.markAllRead();

    // then
    expect(store.markingAllRead.busy()).toBe(true);

    // when
    seen.resolve();
    await pending;

    // then
    expect(store.markingAllRead.busy()).toBe(false);
    expect(config.markAnnouncementSeen).toHaveBeenCalled();
  });
});
