// Must be hoisted before any import of the store. Angular's `Functions`
// token from @angular/fire/functions pulls in Firebase internals that break
// the jest env; we stub them here.
jest.mock('@angular/fire/functions', () => ({
  Functions: class {},
  httpsCallable: jest.fn(),
}));

import { TestBed } from '@angular/core/testing';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { PushSubscriptionStore } from './push-subscription.store';
import { VAPID_PUBLIC_KEY } from './vapid-key.token';

type CallableResult = {
  data: { ok: boolean; subId: string; deviceCount: number };
};

const VAPID_KEY_B64 = 'BP1234567890abcdef';

function mockHttpsCallable(deviceCount = 1): void {
  const callable = jest.fn().mockResolvedValue({
    data: { ok: true, subId: 'sub-1', deviceCount },
  } satisfies CallableResult);
  (httpsCallable as jest.Mock).mockReturnValue(callable);
}

/**
 * Build a mock PushSubscription that survives JSON round-trips.
 */
function makeMockSubscription(
  endpoint = 'https://fcm/endpoint'
): PushSubscription {
  return {
    endpoint,
    expirationTime: null,
    options: {} as PushSubscriptionOptions,
    getKey: () => null,
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: { p256dh: 'p', auth: 'a' },
    }),
    unsubscribe: jest.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

describe('PushSubscriptionStore', () => {
  const swDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker'
  );
  const notifDescriptor = Object.getOwnPropertyDescriptor(
    window,
    'Notification'
  );
  const pushManagerDescriptor = Object.getOwnPropertyDescriptor(
    window,
    'PushManager'
  );

  // Silence expected console.error noise from the error paths
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockHttpsCallable();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Notification API – granted by default
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(jest.fn() as unknown as typeof Notification, {
        permission: 'granted' as NotificationPermission,
        requestPermission: jest.fn().mockResolvedValue('granted'),
      }),
      configurable: true,
      writable: true,
    });

    // PushManager must be a defined constructor so `'PushManager' in window`
    // returns true in isSupported().
    Object.defineProperty(window, 'PushManager', {
      value: class {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (swDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', swDescriptor);
    } else {
      delete (navigator as Record<string, unknown>)['serviceWorker'];
    }
    if (notifDescriptor) {
      Object.defineProperty(window, 'Notification', notifDescriptor);
    } else {
      delete (window as Record<string, unknown>)['Notification'];
    }
    if (pushManagerDescriptor) {
      Object.defineProperty(window, 'PushManager', pushManagerDescriptor);
    } else {
      delete (window as Record<string, unknown>)['PushManager'];
    }
  });

  function setupStore(): InstanceType<typeof PushSubscriptionStore> {
    TestBed.configureTestingModule({
      providers: [
        { provide: VAPID_PUBLIC_KEY, useValue: VAPID_KEY_B64 },
        // Stub Functions so `inject(Functions, { optional: true })` returns
        // a truthy value; the actual callable is faked via httpsCallable mock.
        { provide: Functions, useValue: {} },
      ],
    });
    return TestBed.inject(PushSubscriptionStore);
  }

  it('subscribe() succeeds when the Service Worker is already registered', async () => {
    const subscribeMock = jest.fn().mockResolvedValue(makeMockSubscription());
    const registration = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: subscribeMock,
      },
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: jest.fn().mockResolvedValue(registration),
        addEventListener: jest.fn(),
      },
      configurable: true,
      writable: true,
    });

    const store = setupStore();
    const ok = await store.subscribe();

    expect(ok).toBe(true);
    expect(store.status()).toBe('subscribed');
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
  });

  it('subscribe() waits for a late SW registration and still succeeds', async () => {
    // Enable fake timers BEFORE scheduling any timeouts so the polling
    // loop inside getSwRegistration() and our activation-delay timer
    // both run under Jest's control.
    jest.useFakeTimers();
    try {
      // `getRegistration` returns undefined until the SW "activates"
      // after ~3s — well inside the 15s timeout but past the old 5s
      // limit that caused the bug on first load.
      const subscribeMock = jest.fn().mockResolvedValue(makeMockSubscription());
      const registration = {
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(null),
          subscribe: subscribeMock,
        },
      } as unknown as ServiceWorkerRegistration;

      let swActive: ServiceWorkerRegistration | undefined = undefined;
      setTimeout(() => {
        swActive = registration;
      }, 3_000);

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: jest.fn().mockImplementation(async () => swActive),
          addEventListener: jest.fn(),
        },
        configurable: true,
        writable: true,
      });

      const store = setupStore();
      const subscribePromise = store.subscribe();

      // Advance past the 3s SW activation delay (but well under 15s timeout).
      // Use a generous step to cover multiple 250ms poll intervals.
      await jest.advanceTimersByTimeAsync(4_000);

      const ok = await subscribePromise;

      expect(ok).toBe(true);
      expect(store.status()).toBe('subscribed');
      expect(subscribeMock).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('init() sets status=not-subscribed when SW is registered but has no subscription', async () => {
    const registration = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
      },
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: jest.fn().mockResolvedValue(registration),
        addEventListener: jest.fn(),
      },
      configurable: true,
      writable: true,
    });

    const store = setupStore();
    await store.init();

    expect(store.status()).toBe('not-subscribed');
    expect(store.deviceCount()).toBe(0);
  });

  it('init() rehydrates status=subscribed when an existing push subscription is found', async () => {
    const existingSub = makeMockSubscription();
    const registration = {
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(existingSub),
      },
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: jest.fn().mockResolvedValue(registration),
        addEventListener: jest.fn(),
      },
      configurable: true,
      writable: true,
    });

    mockHttpsCallable(2);

    const store = setupStore();
    await store.init();

    expect(store.status()).toBe('subscribed');
    expect(store.deviceCount()).toBe(2);
  });

  it('subscribe() sets status=denied when Notification permission is denied', async () => {
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(jest.fn() as unknown as typeof Notification, {
        permission: 'default' as NotificationPermission,
        requestPermission: jest.fn().mockResolvedValue('denied'),
      }),
      configurable: true,
      writable: true,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: jest.fn().mockResolvedValue({
          pushManager: {
            getSubscription: jest.fn(),
            subscribe: jest.fn(),
          },
        }),
        addEventListener: jest.fn(),
      },
      configurable: true,
      writable: true,
    });

    const store = setupStore();
    const ok = await store.subscribe();

    expect(ok).toBe(false);
    expect(store.status()).toBe('denied');
  });

  // ---------------------------------------------------------------------------
  // Regression tests for the Android push race condition fixed in 7a6eccbf
  // Issue: https://github.com/WolfSoko/pushup-stats-service/issues/225
  //
  // Root cause: on Android first-load, `subscribe()` used a 5 s timeout
  // against `navigator.serviceWorker.ready` while the SW was registered with
  // `registerWhenStable:30000`. The race meant subscribe() always timed out
  // before the SW existed, silently set status to 'not-subscribed', and no
  // real `pushManager.subscribe()` call ever happened — so background push
  // never reached the server and reminders only fired while the PWA was open.
  //
  // Fix (7a6eccbf):
  //   - SW registration delay dropped from 30 s to 2 s (app.config.ts)
  //   - SW wait timeout raised from 5 s to 15 s (push-subscription.store.ts)
  //   - Replaced `.ready` with a 250 ms polling loop over `getRegistration()`
  //   - Timeout → 'error' state (not silent 'not-subscribed')
  //
  // These tests FAIL on the pre-fix code and PASS on the fixed code.
  // ---------------------------------------------------------------------------
  describe('regression: Android push race condition (#208)', () => {
    /**
     * THE CORE REGRESSION CASE.
     *
     * Pre-fix behaviour: SW registers at 6 s, but subscribe() only waited 5 s
     * via `navigator.serviceWorker.ready` — it timed out, silently set status
     * to 'not-subscribed', and returned false. No subscription was ever saved
     * server-side. Android background push was broken on every first visit.
     *
     * Post-fix behaviour: polling loop waits up to 15 s, picks up the SW at
     * 6 s, completes the pushManager.subscribe() call, and returns true.
     */
    it('subscribe() succeeds when SW registers at 6 s (beyond old 5 s limit, within new 15 s limit)', async () => {
      jest.useFakeTimers();
      try {
        const subscribeMock = jest
          .fn()
          .mockResolvedValue(makeMockSubscription());
        const registration = {
          pushManager: {
            getSubscription: jest.fn().mockResolvedValue(null),
            subscribe: subscribeMock,
          },
        } as unknown as ServiceWorkerRegistration;

        // SW becomes available exactly at 6 000 ms — past the old 5 s deadline.
        let swActive: ServiceWorkerRegistration | undefined = undefined;
        setTimeout(() => {
          swActive = registration;
        }, 6_000);

        Object.defineProperty(navigator, 'serviceWorker', {
          value: {
            getRegistration: jest.fn().mockImplementation(async () => swActive),
            addEventListener: jest.fn(),
          },
          configurable: true,
          writable: true,
        });

        const store = setupStore();
        const subscribePromise = store.subscribe();

        // Advance to 7 s — the SW has been up for 1 s, all poll intervals
        // that fired after 6 s should have found the registration.
        await jest.advanceTimersByTimeAsync(7_000);

        const ok = await subscribePromise;

        // Pre-fix: ok === false, status === 'not-subscribed', subscribeMock not called.
        // Post-fix: ok === true, status === 'subscribed', subscribeMock called once.
        expect(ok).toBe(true);
        expect(store.status()).toBe('subscribed');
        expect(subscribeMock).toHaveBeenCalledTimes(1);
        expect(subscribeMock).toHaveBeenCalledWith(
          expect.objectContaining({ userVisibleOnly: true })
        );
      } finally {
        jest.useRealTimers();
      }
    });

    /**
     * Pre-fix: SW timeout produced silent 'not-subscribed' — the UI toggle
     * appeared to work but no subscription was persisted. Users never received
     * background push.
     *
     * Post-fix: timeout produces 'error' so the UI can surface a "try again"
     * message, and `console.error` is called with a descriptive message so
     * developers can identify the root cause in logs.
     */
    it('subscribe() emits status=error (not not-subscribed) and console.error when SW never registers', async () => {
      jest.useFakeTimers();
      try {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: {
            // SW never becomes available — simulates a broken/disabled SW or
            // the old registerWhenStable:30000 on a slow device.
            getRegistration: jest.fn().mockResolvedValue(undefined),
            addEventListener: jest.fn(),
          },
          configurable: true,
          writable: true,
        });

        const store = setupStore();
        const subscribePromise = store.subscribe();

        // Exhaust the 15 s polling deadline plus a buffer.
        await jest.advanceTimersByTimeAsync(16_000);

        const ok = await subscribePromise;

        // Pre-fix: ok === false, status === 'not-subscribed', no console.error.
        // Post-fix: ok === false, status === 'error', console.error fired.
        expect(ok).toBe(false);
        expect(store.status()).toBe('error');
        // Must NOT silently fall back to 'not-subscribed' (the pre-fix bug).
        expect(store.status()).not.toBe('not-subscribed');
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Service Worker not available')
        );
      } finally {
        jest.useRealTimers();
      }
    });

    /**
     * Concurrent-call guard: if the user taps "Push aktivieren" twice rapidly
     * while the SW is still registering (a realistic Android first-load
     * scenario), only one `pushManager.subscribe()` must be sent — duplicate
     * subscriptions cause server-side fan-out and waste FCM quota.
     *
     * This test models the real race: both callers enter `getSubscription()`
     * before the first `pushManager.subscribe()` resolves, so both observe
     * `null`. Without an in-flight guard on `store.subscribe()`, both callers
     * would then invoke `pushManager.subscribe()`. A naive
     * `mockResolvedValueOnce(null).mockResolvedValue(existing)` would hide
     * this bug because the second caller would see an existing sub and skip
     * the subscribe call. The barrier below makes the race observable.
     */
    it('concurrent subscribe() calls while SW is slow produce exactly one pushManager.subscribe() call', async () => {
      jest.useFakeTimers();
      try {
        const createdSubscription = makeMockSubscription();
        const subscribeMock = jest.fn().mockResolvedValue(createdSubscription);

        // Barrier so the first N callers of getSubscription() all observe the
        // same pending `null` result. Without this, a plain
        // `mockResolvedValueOnce(null).mockResolvedValue(existing)` would let
        // the second caller short-circuit via the "existing" branch and the
        // test would silently pass even without an in-flight guard.
        let getSubscriptionCalls = 0;
        const sharedMissingSubscription = new Promise<PushSubscription | null>(
          (resolve) => setTimeout(() => resolve(null), 0)
        );
        const getSubscriptionMock = jest.fn().mockImplementation(() => {
          getSubscriptionCalls += 1;
          if (getSubscriptionCalls <= 2) {
            return sharedMissingSubscription;
          }
          return Promise.resolve(createdSubscription);
        });
        const registration = {
          pushManager: {
            getSubscription: getSubscriptionMock,
            subscribe: subscribeMock,
          },
        } as unknown as ServiceWorkerRegistration;

        // SW appears at 3 s — both concurrent calls are still in the polling
        // loop when the SW becomes available.
        let swActive: ServiceWorkerRegistration | undefined = undefined;
        setTimeout(() => {
          swActive = registration;
        }, 3_000);

        Object.defineProperty(navigator, 'serviceWorker', {
          value: {
            getRegistration: jest.fn().mockImplementation(async () => swActive),
            addEventListener: jest.fn(),
          },
          configurable: true,
          writable: true,
        });

        const store = setupStore();

        // Fire two subscribe() calls back-to-back before the SW is up.
        const [p1, p2] = [store.subscribe(), store.subscribe()];

        await jest.advanceTimersByTimeAsync(4_000);

        const [ok1, ok2] = await Promise.all([p1, p2]);

        // Both calls must report success.
        expect(ok1).toBe(true);
        expect(ok2).toBe(true);
        expect(store.status()).toBe('subscribed');
        // The critical assertion: pushManager.subscribe() must be called
        // exactly once — duplicate calls mean duplicate server-side subscriptions.
        expect(subscribeMock).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    /**
     * init() re-entrancy guard: rapid component re-mounts or navigation on
     * Android could call init() multiple times concurrently. The initStarted
     * guard must ensure only the first call runs the async flow.
     */
    it('concurrent init() calls are idempotent (initStarted guard)', async () => {
      const getRegistrationMock = jest.fn();
      const registration = {
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(null),
        },
      } as unknown as ServiceWorkerRegistration;
      getRegistrationMock.mockResolvedValue(registration);

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: getRegistrationMock,
          addEventListener: jest.fn(),
        },
        configurable: true,
        writable: true,
      });

      const store = setupStore();

      // Fire three concurrent init() calls — simulates component re-mounts
      // or rapid navigation that triggered the race on Android.
      await Promise.all([store.init(), store.init(), store.init()]);

      // Only the first init() should have proceeded; the guard must have
      // blocked the subsequent ones from re-running the async flow.
      expect(getRegistrationMock).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('not-subscribed');
    });

    /**
     * Status must not regress from 'subscribed' back to 'not-subscribed' if
     * a component re-mount triggers init() again after the user has already
     * subscribed. Pre-fix: the initStarted guard was absent, so re-entrant
     * init() calls could race against the live subscription and overwrite it.
     */
    it('status does not regress from subscribed to not-subscribed on init() re-entry', async () => {
      const mockSub = makeMockSubscription();
      const registration = {
        pushManager: {
          // First call returns null (before subscribe), subsequent calls
          // return the subscription (simulating what the browser does after
          // a successful pushManager.subscribe()).
          getSubscription: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValue(mockSub),
          subscribe: jest.fn().mockResolvedValue(mockSub),
        },
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: jest.fn().mockResolvedValue(registration),
          addEventListener: jest.fn(),
        },
        configurable: true,
        writable: true,
      });

      const store = setupStore();

      // Initial init — SW present, no subscription yet → 'not-subscribed'
      await store.init();
      expect(store.status()).toBe('not-subscribed');

      // User subscribes
      const ok = await store.subscribe();
      expect(ok).toBe(true);
      expect(store.status()).toBe('subscribed');

      // Simulate component re-mount calling init() again — the guard must
      // block re-execution so status stays 'subscribed'.
      await store.init();
      expect(store.status()).toBe('subscribed');
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: zombie subscriptions with Chromium's `permanently-removed.invalid`
  // sentinel endpoint.
  //
  // Observed in prod on Edge for Android: once the push service invalidates a
  // subscription, `pushManager.getSubscription()` keeps returning a
  // PushSubscription object whose endpoint has been sanitized to
  // `https://permanently-removed.invalid/fcm/send/...`. The `.invalid` TLD
  // cannot resolve, so every server-side send fails with a DNS error (no HTTP
  // statusCode → not detected as expired by the 410/404 cleanup). The zombie
  // stayed in Firestore indefinitely, silencing all background push.
  //
  // Fix: detect the sentinel locally, call `sub.unsubscribe()`, and treat the
  // user as not-subscribed instead of saving the zombie to the backend.
  // ---------------------------------------------------------------------------
  describe('regression: zombie subscription on `permanently-removed.invalid`', () => {
    const ZOMBIE_ENDPOINT =
      'https://permanently-removed.invalid/fcm/send/fgr7FAJdyMU:APA91bEq';

    it('init() unsubscribes a zombie, surfaces not-subscribed, and never saves it server-side', async () => {
      const zombieSub = makeMockSubscription(ZOMBIE_ENDPOINT);
      const registration = {
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(zombieSub),
        },
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: jest.fn().mockResolvedValue(registration),
          addEventListener: jest.fn(),
        },
        configurable: true,
        writable: true,
      });

      // Track every callable invocation; savePushSubscription must never run.
      const callable = jest.fn();
      (httpsCallable as jest.Mock).mockReturnValue(callable);

      const store = setupStore();
      await store.init();

      expect(zombieSub.unsubscribe).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('not-subscribed');
      expect(store.deviceCount()).toBe(0);
      // No callable invoked — we must not re-save a zombie to the backend.
      expect(callable).not.toHaveBeenCalled();
    });

    it('reacts to PUSH_SUBSCRIPTION_CHANGED from the SW by saving the fresh subscription server-side', async () => {
      // Capture the SW message listener the store registers on init().
      const messageListeners: Array<(ev: MessageEvent) => void> = [];
      const registration = {
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(null),
        },
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: jest.fn().mockResolvedValue(registration),
          addEventListener: jest.fn(
            (type: string, listener: (ev: MessageEvent) => void) => {
              if (type === 'message') messageListeners.push(listener);
            }
          ),
        },
        configurable: true,
        writable: true,
      });

      const callable = jest.fn().mockResolvedValue({
        data: { ok: true, subId: 'sub-new', deviceCount: 1 },
      });
      (httpsCallable as jest.Mock).mockReturnValue(callable);

      const store = setupStore();
      await store.init();

      // SW reports a fresh subscription after pushsubscriptionchange —
      // the store must persist it without requiring a page reload.
      const freshJson = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fresh',
        keys: { p256dh: 'p', auth: 'a' },
      };
      for (const listener of messageListeners) {
        listener({
          data: { type: 'PUSH_SUBSCRIPTION_CHANGED', sub: freshJson },
        } as MessageEvent);
      }
      // Flush all pending microtasks so the IIFE -> saveSubscriptionJson ->
      // callable -> patchState chain settles. A zero-ms setTimeout yields
      // after the microtask queue drains, unlike chaining N `await
      // Promise.resolve()` which is fragile if the chain deepens.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callable).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: freshJson.endpoint,
          keys: freshJson.keys,
        })
      );
      expect(store.status()).toBe('subscribed');
    });

    it('subscribe() discards an existing zombie and requests a fresh PushSubscription', async () => {
      const zombieSub = makeMockSubscription(ZOMBIE_ENDPOINT);
      const freshSub = makeMockSubscription(
        'https://fcm.googleapis.com/fcm/send/fresh'
      );
      const subscribeMock = jest.fn().mockResolvedValue(freshSub);
      const registration = {
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(zombieSub),
          subscribe: subscribeMock,
        },
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: jest.fn().mockResolvedValue(registration),
          addEventListener: jest.fn(),
        },
        configurable: true,
        writable: true,
      });

      const store = setupStore();
      const ok = await store.subscribe();

      expect(ok).toBe(true);
      // The zombie must be dropped before we ask the browser for a new sub,
      // otherwise the new subscription request is a no-op (existing sub wins).
      expect(zombieSub.unsubscribe).toHaveBeenCalledTimes(1);
      expect(subscribeMock).toHaveBeenCalledWith(
        expect.objectContaining({ userVisibleOnly: true })
      );
      expect(store.status()).toBe('subscribed');
    });
  });
});
