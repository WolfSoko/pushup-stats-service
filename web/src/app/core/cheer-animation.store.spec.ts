import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import { CheerPingApiService } from '@pu-stats/data-access';
import type { CheerPing } from '@pu-stats/models';
import { BehaviorSubject } from 'rxjs';
import {
  CHEER_ANIMATION_DURATION_MS,
  CheerAnimationStore,
} from './cheer-animation.store';
import { UserConfigStore } from './user-config.store';

describe('CheerAnimationStore', () => {
  const cheerAnimationEnabled = signal(true);
  let pingStream: BehaviorSubject<CheerPing | null>;

  function setup(platform: 'browser' | 'server' = 'browser'): {
    store: InstanceType<typeof CheerAnimationStore>;
  } {
    pingStream = new BehaviorSubject<CheerPing | null>(null);
    cheerAnimationEnabled.set(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        {
          provide: CheerPingApiService,
          useValue: { watch: vitest.fn(() => pingStream.asObservable()) },
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => 'u1' },
        },
        {
          provide: UserConfigStore,
          useValue: { cheerAnimationEnabled },
        },
      ],
    });
    return { store: TestBed.inject(CheerAnimationStore) };
  }

  async function flush(): Promise<void> {
    TestBed.tick();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger the animation for a ping written after the session started', async () => {
    // given
    const { store } = setup();
    await flush();

    // when — a cheer arrives right now, well after store init. Fake timers
    // freeze Date.now(), so the clock has to move forward explicitly for
    // the ping to read as later than the session start.
    vi.advanceTimersByTime(10);
    pingStream.next({ from: 'friend-1', at: new Date().toISOString() });
    await flush();

    // then
    expect(store.activeCheerFrom()).toBe('friend-1');
  });

  it('should not trigger for a ping already stale when the store starts', async () => {
    // given — the doc already exists from a cheer sent before this tab
    // opened; the push notification already covered that. This test
    // bypasses setup(), so the shared enabled signal is reset explicitly
    // rather than exercising the disabled-setting early return instead.
    cheerAnimationEnabled.set(true);
    pingStream = new BehaviorSubject<CheerPing | null>({
      from: 'friend-1',
      at: '2000-01-01T00:00:00.000Z',
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CheerPingApiService,
          useValue: { watch: vitest.fn(() => pingStream.asObservable()) },
        },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        { provide: UserConfigStore, useValue: { cheerAnimationEnabled } },
      ],
    });

    // when
    const store = TestBed.inject(CheerAnimationStore);
    await flush();

    // then
    expect(store.activeCheerFrom()).toBeNull();
  });

  it('should not trigger when the user disabled the animation', async () => {
    // given
    const { store } = setup();
    cheerAnimationEnabled.set(false);
    await flush();

    // when
    vi.advanceTimersByTime(10);
    pingStream.next({ from: 'friend-1', at: new Date().toISOString() });
    await flush();

    // then
    expect(store.activeCheerFrom()).toBeNull();
  });

  it('should not replay a cheer that arrived while disabled once the setting is re-enabled', async () => {
    // given — a cheer arrives while the animation is switched off
    const { store } = setup();
    cheerAnimationEnabled.set(false);
    await flush();
    vi.advanceTimersByTime(10);
    pingStream.next({ from: 'friend-1', at: new Date().toISOString() });
    await flush();
    expect(store.activeCheerFrom()).toBeNull();

    // when — the user re-enables the setting later, with no new cheer
    cheerAnimationEnabled.set(true);
    await flush();

    // then — the old cheer must not surface just because it's newer than
    // the session start; it was already seen while disabled
    expect(store.activeCheerFrom()).toBeNull();
  });

  it('should not replay the same ping twice', async () => {
    // given
    const { store } = setup();
    await flush();
    vi.advanceTimersByTime(10);
    const at = new Date().toISOString();
    pingStream.next({ from: 'friend-1', at });
    await flush();
    expect(store.activeCheerFrom()).toBe('friend-1');
    store.dismiss();

    // when — the same doc is re-emitted (e.g. a reconnect replaying cache)
    pingStream.next({ from: 'friend-1', at });
    await flush();

    // then
    expect(store.activeCheerFrom()).toBeNull();
  });

  it('should auto-dismiss after the animation duration', async () => {
    // given
    const { store } = setup();
    await flush();
    vi.advanceTimersByTime(10);
    pingStream.next({ from: 'friend-1', at: new Date().toISOString() });
    await flush();
    expect(store.activeCheerFrom()).toBe('friend-1');

    // when
    vi.advanceTimersByTime(CHEER_ANIMATION_DURATION_MS);

    // then
    expect(store.activeCheerFrom()).toBeNull();
  });

  it('should not watch the ping doc on the server', async () => {
    // given
    const { store } = setup('server');
    await flush();

    // when
    pingStream.next({ from: 'friend-1', at: new Date().toISOString() });
    await flush();

    // then — no browser-only effect subscribed
    expect(store.activeCheerFrom()).toBeNull();
  });

  it('should not replay a ping fetched for a previous session baseline after switching accounts', async () => {
    // given — user A's session starts, then account B logs in; B's ping
    // doc already existed (written between A's session start and the
    // switch) but B never saw it live before now
    const userId = signal('a');
    const pingA = new BehaviorSubject<CheerPing | null>(null);
    const pingB = new BehaviorSubject<CheerPing | null>(null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: CheerPingApiService,
          useValue: {
            watch: vitest.fn((uid: string) =>
              uid === 'a' ? pingA.asObservable() : pingB.asObservable()
            ),
          },
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => userId() },
        },
        { provide: UserConfigStore, useValue: { cheerAnimationEnabled } },
      ],
    });
    const store = TestBed.inject(CheerAnimationStore);
    await flush();

    // A ping for B, written while A is still signed in on this tab.
    vi.advanceTimersByTime(10);
    pingB.next({ from: 'friend-1', at: new Date().toISOString() });
    await flush();

    // when — the tab switches from A to B without a page reload
    userId.set('b');
    await flush();

    // then — B's pre-existing ping must not replay just because it is
    // newer than A's session start
    expect(store.activeCheerFrom()).toBeNull();
  });

  describe('play', () => {
    it('should let the admin test page trigger the animation directly', () => {
      // given
      const { store } = setup();

      // when
      store.play('Vorschau');

      // then
      expect(store.activeCheerFrom()).toBe('Vorschau');
    });

    it('should let dismiss() cancel a pending auto-hide', () => {
      // given
      const { store } = setup();
      store.play('Vorschau');

      // when
      store.dismiss();
      vi.advanceTimersByTime(CHEER_ANIMATION_DURATION_MS);

      // then
      expect(store.activeCheerFrom()).toBeNull();
    });
  });
});
