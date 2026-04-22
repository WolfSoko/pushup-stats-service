// Regression tests for the Android push race condition fixed in 7a6eccbf.
//
// The bug: PushSubscriptionStore.subscribe() waited only 5 s for the SW
// via `navigator.serviceWorker.ready`, while the Angular SW was registered
// 30 s after app stabilisation. On first Android visit the race was lost:
// subscribe() timed out, silently set status to 'not-subscribed', and no
// real pushManager.subscribe() call was ever made — users saw background
// push as broken because no subscription was ever saved server-side.
//
// The fix (7a6eccbf):
//   • SW_READY_TIMEOUT_MS bumped 5 s → 15 s
//   • `navigator.serviceWorker.ready` replaced by a 250 ms polling loop
//     over getRegistration() (avoids hanging forever in dev / no-SW envs)
//   • Timeout surfaces as status='error', NOT 'not-subscribed', so the UI
//     can show a "try again" state instead of silently appearing enabled
//   • SW registration delay in app.config.ts dropped 30 s → 2 s
//
// These tests focus exclusively on the race/timing scenarios; non-race
// behaviour (permission denial, rehydration, unsubscribe) lives in the
// sibling push-subscription.store.spec.ts.

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

type CallableResult = { data: { ok: boolean; subId: string; deviceCount: number } };

const VAPID_KEY_B64 = 'BP1234567890abcdef';

function mockHttpsCallable(deviceCount = 1): void {
  const callable = jest
    .fn()
    .mockResolvedValue({
      data: { ok: true, subId: 'sub-race-1', deviceCount },
    } satisfies CallableResult);
  (httpsCallable as jest.Mock).mockReturnValue(callable);
}

function makeMockSubscription(endpoint = 'https://fcm/race-endpoint'): PushSubscription {
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

describe('PushSubscriptionStore — Android push race condition (regression: 7a6eccbf)', () => {
  const swDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  const notifDescriptor = Object.getOwnPropertyDescriptor(window, 'Notification');
  const pushManagerDescriptor = Object.getOwnPropertyDescriptor(window, 'PushManager');

  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockHttpsCallable();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // Notification API — granted by default
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(jest.fn() as unknown as typeof Notification, {
        permission: 'granted' as NotificationPermission,
        requestPermission: jest.fn().mockResolvedValue('granted'),
      }),
      configurable: true,
      writable: true,
    });

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
        { provide: Functions, useValue: {} },
      ],
    });
    return TestBed.inject(PushSubscriptionStore);
  }

  // ---------------------------------------------------------------------------
  // 1. Core observable from the bug: timeout must surface 'error', not
  //    'not-subscribed'. Before the fix the store silently fell back to
  //    'not-subscribed', making the UI look functional while no real
  //    subscription existed and background push was never delivered.
  // ---------------------------------------------------------------------------
  it('REGRESSION: SW timeout surfaces status=error, NOT not-subscribed (pre-fix silent fallback)', async () => {
    jest.useFakeTimers();
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          // Simulates the pre-fix scenario: SW never registers within the
          // window that subscribe() waits — the old code used a 5s Promise.race
          // against navigator.serviceWorker.ready that always lost on first load.
          getRegistration: jest.fn().mockResolvedValue(undefined),
          addEventListener: jest.fn(),
        },
        configurable: true,
        writable: true,
      });

      const store = setupStore();
      const subscribePromise = store.subscribe();

      // Advance past the 15 s polling deadline (generous slack for final iteration)
      await jest.advanceTimersByTimeAsync(16_000);

      const ok = await subscribePromise;

      // Must be false — no subscription created
      expect(ok).toBe(false);
      // KEY assertion: 'error', not 'not-subscribed'.
      // Before 7a6eccbf this was 'not-subscribed', hiding the failure from the UI.
      expect(store.status()).toBe('error');
      // The console.error must be emitted so operators can diagnose the issue.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Service Worker not available')
      );
    } finally {
      jest.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // 2. init() is idempotent — rapid / concurrent re-entrancy must not produce
  //    duplicate side-effects or clobber state.
  // ---------------------------------------------------------------------------
  it('REGRESSION: concurrent init() calls are idempotent (initStarted guard)', async () => {
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

  // ---------------------------------------------------------------------------
  // 3. Concurrent init() + subscribe() while SW is registering late.
  //
  //    This is the exact Android race that was silenced: the component
  //    constructor called init() at the same moment the user tapped
  //    "Enable reminders" (triggering subscribe()). Both raced to
  //    getSwRegistration(). Under the old 5 s / navigator.serviceWorker.ready
  //    implementation subscribe() would lose the race and time out before
  //    the SW finished registering (which happened at ~2-30 s).
  //
  //    After the fix both resolve correctly because:
  //    - The polling loop in getSwRegistration() is independent per-caller
  //    - The timeout is 15 s, well above the 2 s registration delay
  // ---------------------------------------------------------------------------
  it('REGRESSION: concurrent init()+subscribe() while SW registers at 3s both resolve correctly', async () => {
    jest.useFakeTimers();
    try {
      const subscribeMock = jest.fn().mockResolvedValue(makeMockSubscription());
      const registration = {
        pushManager: {
          getSubscription: jest.fn().mockResolvedValue(null),
          subscribe: subscribeMock,
        },
      } as unknown as ServiceWorkerRegistration;

      // SW becomes available after 3 s — well inside the 15 s timeout but
      // past the old 5 s limit that caused subscribe() to lose the race.
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

      // Fire both concurrently — mirroring the Android first-load scenario
      const initPromise = store.init();
      const subscribePromise = store.subscribe();

      // Advance past the 3 s SW activation, well under the 15 s ceiling.
      await jest.advanceTimersByTimeAsync(5_000);

      const [, subscribeOk] = await Promise.all([initPromise, subscribePromise]);

      // subscribe() must succeed — it must NOT time out because init()
      // was also polling getRegistration() at the same time.
      expect(subscribeOk).toBe(true);
      expect(store.status()).toBe('subscribed');
      expect(subscribeMock).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Once subscribed, a subsequent init() re-entry must NOT regress status
  //    back to 'not-subscribed'.
  //
  //    Pre-fix: initStarted guard was absent; a re-mounted component calling
  //    init() again after the user had subscribed would race with the live
  //    subscription and could overwrite it with 'not-subscribed' if
  //    getSubscription() was checked before the browser propagated the new
  //    subscription object.
  // ---------------------------------------------------------------------------
  it('REGRESSION: status does not regress from subscribed→not-subscribed on init() re-entry', async () => {
    const mockSub = makeMockSubscription();
    const registration = {
      pushManager: {
        // First call returns null (before subscribe), subsequent calls
        // return the subscription (simulating what the browser does after
        // a successful pushManager.subscribe()).
        getSubscription: jest
          .fn()
          .mockResolvedValueOnce(null)   // init() first run
          .mockResolvedValue(mockSub),   // any re-entry attempt
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
