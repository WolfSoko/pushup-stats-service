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
import { PushSwRegistrationService } from './push-sw-registration.service';
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

/**
 * Test double for PushSwRegistrationService — the production service handles
 * the navigator.serviceWorker.register() dance; these tests bypass it and
 * feed the store whatever registration (or delay) the scenario needs.
 */
class FakePushSwRegistrationService {
  private resolver: Promise<ServiceWorkerRegistration | undefined> =
    Promise.resolve(undefined);

  setRegistration(reg: ServiceWorkerRegistration | undefined): void {
    this.resolver = Promise.resolve(reg);
  }

  setDelayedRegistration(
    reg: ServiceWorkerRegistration | undefined,
    delayMs: number
  ): void {
    this.resolver = new Promise((resolve) =>
      setTimeout(() => resolve(reg), delayMs)
    );
  }

  async getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    return this.resolver;
  }
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

  let errorSpy: jest.SpyInstance;
  let pushSw: FakePushSwRegistrationService;

  beforeEach(() => {
    mockHttpsCallable();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    pushSw = new FakePushSwRegistrationService();

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

    // The store still attaches a `message` listener on navigator.serviceWorker
    // to react to PUSH_SUBSCRIPTION_CHANGED events from the SW. Minimal stub
    // with just addEventListener so registerSwListener() doesn't throw.
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: jest.fn(),
      },
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
        { provide: PushSwRegistrationService, useValue: pushSw },
      ],
    });
    return TestBed.inject(PushSubscriptionStore);
  }

  function makeRegistration(overrides?: {
    existingSubscription?: PushSubscription | null;
    subscribeResult?: PushSubscription;
  }): {
    registration: ServiceWorkerRegistration;
    subscribe: jest.Mock;
    getSubscription: jest.Mock;
  } {
    const subscribe = jest
      .fn()
      .mockResolvedValue(overrides?.subscribeResult ?? makeMockSubscription());
    const getSubscription = jest
      .fn()
      .mockResolvedValue(overrides?.existingSubscription ?? null);
    const registration = {
      pushManager: { getSubscription, subscribe },
    } as unknown as ServiceWorkerRegistration;
    return { registration, subscribe, getSubscription };
  }

  it('subscribe() succeeds when the push SW is already registered', async () => {
    const { registration, subscribe } = makeRegistration();
    pushSw.setRegistration(registration);

    const store = setupStore();
    const ok = await store.subscribe();

    expect(ok).toBe(true);
    expect(store.status()).toBe('subscribed');
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
  });

  it('init() sets status=not-subscribed when the registration has no subscription', async () => {
    const { registration } = makeRegistration();
    pushSw.setRegistration(registration);

    const store = setupStore();
    await store.init();

    expect(store.status()).toBe('not-subscribed');
    expect(store.deviceCount()).toBe(0);
  });

  it('init() rehydrates status=subscribed when an existing push subscription is found', async () => {
    const existingSub = makeMockSubscription();
    const { registration } = makeRegistration({
      existingSubscription: existingSub,
    });
    pushSw.setRegistration(registration);
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
    const { registration } = makeRegistration();
    pushSw.setRegistration(registration);

    const store = setupStore();
    const ok = await store.subscribe();

    expect(ok).toBe(false);
    expect(store.status()).toBe('denied');
  });

  // ---------------------------------------------------------------------------
  // Regression: push SW unavailable (register() never succeeds).
  //
  // Pre-fix (before separating SW registrations): a stuck SW registration
  // silently flipped the store to 'not-subscribed' so the UI looked fine
  // while no real subscription existed. The contract is now: if the push SW
  // can't be reached, surface 'error' and log, so the UI can show a retry
  // affordance.
  // ---------------------------------------------------------------------------
  describe('regression: push SW unavailable', () => {
    it('subscribe() surfaces status=error (not not-subscribed) and logs when push SW is unavailable', async () => {
      pushSw.setRegistration(undefined);

      const store = setupStore();
      const ok = await store.subscribe();

      expect(ok).toBe(false);
      expect(store.status()).toBe('error');
      expect(store.status()).not.toBe('not-subscribed');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Push service worker at /push/ is not available'
        )
      );
    });

    /**
     * Concurrent subscribe(): if the user taps "Push aktivieren" twice while
     * the push SW is still registering, the in-flight guard must coalesce
     * both calls onto a single `pushManager.subscribe()` to avoid duplicate
     * server-side subscription records.
     */
    it('concurrent subscribe() calls produce exactly one pushManager.subscribe()', async () => {
      jest.useFakeTimers();
      try {
        const created = makeMockSubscription();
        const subscribe = jest.fn().mockResolvedValue(created);

        // Shared pending null for the first two getSubscription() calls —
        // otherwise a naive `mockResolvedValueOnce(null).mockResolvedValue(...)`
        // would let the second caller short-circuit via "existing sub" and
        // the in-flight guard regression would pass silently.
        let gets = 0;
        const sharedMissing = new Promise<PushSubscription | null>((resolve) =>
          setTimeout(() => resolve(null), 0)
        );
        const getSubscription = jest.fn().mockImplementation(() => {
          gets += 1;
          return gets <= 2 ? sharedMissing : Promise.resolve(created);
        });
        const registration = {
          pushManager: { getSubscription, subscribe },
        } as unknown as ServiceWorkerRegistration;

        // Registration resolves after 3s; both concurrent calls await it.
        pushSw.setDelayedRegistration(registration, 3_000);

        const store = setupStore();
        const [p1, p2] = [store.subscribe(), store.subscribe()];
        await jest.advanceTimersByTimeAsync(4_000);
        const [ok1, ok2] = await Promise.all([p1, p2]);

        expect(ok1).toBe(true);
        expect(ok2).toBe(true);
        expect(store.status()).toBe('subscribed');
        expect(subscribe).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    /**
     * init() re-entrancy guard: rapid component re-mounts on Android can
     * call init() multiple times. initStarted must ensure only the first
     * call runs the async flow.
     */
    it('concurrent init() calls are idempotent (initStarted guard)', async () => {
      const { registration, getSubscription } = makeRegistration();
      pushSw.setRegistration(registration);

      const store = setupStore();
      await Promise.all([store.init(), store.init(), store.init()]);

      expect(getSubscription).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('not-subscribed');
    });

    /**
     * Status must not regress from 'subscribed' back to 'not-subscribed' if
     * a component re-mount triggers init() again after the user has already
     * subscribed.
     */
    it('status does not regress from subscribed to not-subscribed on init() re-entry', async () => {
      const mockSub = makeMockSubscription();
      const getSubscription = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue(mockSub);
      const subscribe = jest.fn().mockResolvedValue(mockSub);
      const registration = {
        pushManager: { getSubscription, subscribe },
      } as unknown as ServiceWorkerRegistration;
      pushSw.setRegistration(registration);

      const store = setupStore();

      await store.init();
      expect(store.status()).toBe('not-subscribed');

      const ok = await store.subscribe();
      expect(ok).toBe(true);
      expect(store.status()).toBe('subscribed');

      // Re-mount → init() again: guard blocks re-execution.
      await store.init();
      expect(store.status()).toBe('subscribed');
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: zombie subscriptions with Chromium's
  // `permanently-removed.invalid` sentinel endpoint.
  //
  // Once the push service invalidates a subscription, `getSubscription()`
  // keeps returning a PushSubscription whose endpoint is sanitized to
  // `https://permanently-removed.invalid/fcm/send/...`. That `.invalid` TLD
  // never resolves — every server-side send DNS-fails (no HTTP status → not
  // caught by the 410/404 cleanup), so the zombie lingers in Firestore and
  // silences all background push. Fix: detect locally, unsubscribe, treat as
  // not-subscribed.
  // ---------------------------------------------------------------------------
  describe('regression: zombie subscription on `permanently-removed.invalid`', () => {
    const ZOMBIE_ENDPOINT =
      'https://permanently-removed.invalid/fcm/send/fgr7FAJdyMU:APA91bEq';

    it('init() unsubscribes a zombie, surfaces browser-invalidated, and never saves it server-side', async () => {
      const zombieSub = makeMockSubscription(ZOMBIE_ENDPOINT);
      const { registration } = makeRegistration({
        existingSubscription: zombieSub,
      });
      pushSw.setRegistration(registration);

      const callable = jest.fn();
      (httpsCallable as jest.Mock).mockReturnValue(callable);

      const store = setupStore();
      await store.init();

      expect(zombieSub.unsubscribe).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('browser-invalidated');
      expect(store.deviceCount()).toBe(0);
      expect(callable).not.toHaveBeenCalled();
    });

    it('PUSH_SUBSCRIPTION_CHANGED with a zombie endpoint drops it and surfaces browser-invalidated', async () => {
      const messageListeners: Array<(ev: MessageEvent) => void> = [];
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          addEventListener: jest.fn(
            (type: string, listener: (ev: MessageEvent) => void) => {
              if (type === 'message') messageListeners.push(listener);
            }
          ),
        },
        configurable: true,
        writable: true,
      });
      const { registration } = makeRegistration();
      pushSw.setRegistration(registration);

      const callable = jest.fn();
      (httpsCallable as jest.Mock).mockReturnValue(callable);

      const store = setupStore();
      await store.init();

      const zombieJson = {
        endpoint: ZOMBIE_ENDPOINT,
        keys: { p256dh: 'p', auth: 'a' },
      };
      for (const listener of messageListeners) {
        listener({
          data: { type: 'PUSH_SUBSCRIPTION_CHANGED', sub: zombieJson },
        } as MessageEvent);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callable).not.toHaveBeenCalled();
      expect(store.status()).toBe('browser-invalidated');
    });

    it('subscribe() where the fresh pushManager.subscribe() also returns a zombie surfaces browser-invalidated and never saves it', async () => {
      const zombieFresh = makeMockSubscription(ZOMBIE_ENDPOINT);
      const { registration, subscribe } = makeRegistration({
        existingSubscription: null,
        subscribeResult: zombieFresh,
      });
      pushSw.setRegistration(registration);

      const callable = jest.fn();
      (httpsCallable as jest.Mock).mockReturnValue(callable);

      const store = setupStore();
      const ok = await store.subscribe();

      expect(ok).toBe(false);
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(zombieFresh.unsubscribe).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('browser-invalidated');
      expect(callable).not.toHaveBeenCalled();
    });

    it('reacts to PUSH_SUBSCRIPTION_CHANGED from the SW by saving the fresh subscription server-side', async () => {
      const messageListeners: Array<(ev: MessageEvent) => void> = [];
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          addEventListener: jest.fn(
            (type: string, listener: (ev: MessageEvent) => void) => {
              if (type === 'message') messageListeners.push(listener);
            }
          ),
        },
        configurable: true,
        writable: true,
      });
      const { registration } = makeRegistration();
      pushSw.setRegistration(registration);

      const callable = jest.fn().mockResolvedValue({
        data: { ok: true, subId: 'sub-new', deviceCount: 1 },
      });
      (httpsCallable as jest.Mock).mockReturnValue(callable);

      const store = setupStore();
      await store.init();

      const freshJson = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fresh',
        keys: { p256dh: 'p', auth: 'a' },
      };
      for (const listener of messageListeners) {
        listener({
          data: { type: 'PUSH_SUBSCRIPTION_CHANGED', sub: freshJson },
        } as MessageEvent);
      }
      // Flush microtasks so the async save pipeline settles.
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
      const { registration, subscribe } = makeRegistration({
        existingSubscription: zombieSub,
        subscribeResult: freshSub,
      });
      pushSw.setRegistration(registration);

      const store = setupStore();
      const ok = await store.subscribe();

      expect(ok).toBe(true);
      expect(zombieSub.unsubscribe).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledWith(
        expect.objectContaining({ userVisibleOnly: true })
      );
      expect(store.status()).toBe('subscribed');
    });
  });
});
