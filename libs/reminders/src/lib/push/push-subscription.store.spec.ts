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
      data: { ok: true, subId: 'sub-1', deviceCount },
    } satisfies CallableResult);
  (httpsCallable as jest.Mock).mockReturnValue(callable);
}

/**
 * Build a mock PushSubscription that survives JSON round-trips.
 */
function makeMockSubscription(endpoint = 'https://fcm/endpoint'): PushSubscription {
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
      value: Object.assign(
        jest.fn() as unknown as typeof Notification,
        {
          permission: 'granted' as NotificationPermission,
          requestPermission: jest.fn().mockResolvedValue('granted'),
        }
      ),
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
      const subscribeMock = jest
        .fn()
        .mockResolvedValue(makeMockSubscription());
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

  it('subscribe() sets status=error (not not-subscribed) when SW never registers', async () => {
    jest.useFakeTimers();
    try {
      // Simulate the bug: SW registration never happens (e.g. dev mode, or
      // registerWhenStable delay exceeds the subscribe timeout). The store
      // must surface this as 'error', not silently fall back to
      // 'not-subscribed' — otherwise the UI shows the toggle as enabled
      // while no real subscription exists and background push never arrives.
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          // Always undefined — polling loop must time out cleanly.
          getRegistration: jest.fn().mockResolvedValue(undefined),
          addEventListener: jest.fn(),
        },
        configurable: true,
        writable: true,
      });

      const store = setupStore();
      const subscribePromise = store.subscribe();

      // Advance past the 15s polling deadline (add slack for the final
      // poll iteration).
      await jest.advanceTimersByTimeAsync(16_000);

      const ok = await subscribePromise;

      expect(ok).toBe(false);
      expect(store.status()).toBe('error');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Service Worker not available')
      );
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
});
