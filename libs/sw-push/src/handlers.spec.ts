/**
 * Handler unit tests. These run against the pure exports in `handlers.ts`
 * without any Service Worker runtime — the original vm-based harness lived
 * in `web/src/sw-push.spec.ts` and was tightly coupled to a raw JS file.
 */

import {
  handlePush,
  handlePushSubscriptionChange,
  SW_PUSH_VERSION,
  type PushEventLike,
  type PushSubscriptionChangeEventLike,
  type SwContext,
} from './handlers';

type ClientLike = {
  url: string;
  focus: jest.Mock;
  postMessage: jest.Mock;
};

function makeCtx(overrides?: {
  matchAllResult?: ClientLike[];
  subscribe?: jest.Mock;
}): {
  ctx: SwContext;
  showNotification: jest.Mock;
  subscribe: jest.Mock;
  matchAll: jest.Mock;
  openWindow: jest.Mock;
} {
  const showNotification = jest.fn().mockResolvedValue(undefined);
  const subscribe = overrides?.subscribe ?? jest.fn();
  const matchAll = jest.fn().mockResolvedValue(overrides?.matchAllResult ?? []);
  const openWindow = jest.fn().mockResolvedValue(undefined);
  const ctx = {
    registration: {
      showNotification,
      pushManager: { subscribe } as unknown as PushManager,
    } as SwContext['registration'],
    clients: {
      matchAll,
      openWindow,
    },
    origin: 'https://pushup-stats.com',
  };
  return { ctx, showNotification, subscribe, matchAll, openWindow };
}

describe('SW_PUSH_VERSION', () => {
  it('exposes a non-empty string (either injected or unversioned fallback)', () => {
    expect(typeof SW_PUSH_VERSION).toBe('string');
    expect(SW_PUSH_VERSION.length).toBeGreaterThan(0);
  });
});

describe('handlePush', () => {
  it('is a no-op when the event has no payload', () => {
    const { ctx, showNotification } = makeCtx();
    const event: PushEventLike = {
      data: null,
      waitUntil: jest.fn(),
    };
    handlePush(event, ctx);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('shows a notification with German default actions when locale is missing', async () => {
    const { ctx, showNotification } = makeCtx();
    let waited: Promise<unknown> | undefined;
    const event: PushEventLike = {
      data: {
        json: () => ({ title: 'T', body: 'B' }),
        text: () => '',
      },
      waitUntil: (p) => {
        waited = p;
      },
    };
    handlePush(event, ctx);
    await waited;
    expect(showNotification).toHaveBeenCalledWith(
      'T',
      expect.objectContaining({
        body: 'B',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'reminder',
        actions: [
          { action: 'snooze', title: '⏰ 30 Min snoozen' },
          { action: 'log', title: '✅ Eintragen' },
        ],
      })
    );
  });

  it('uses English default actions when data.locale starts with "en"', async () => {
    const { ctx, showNotification } = makeCtx();
    const event: PushEventLike = {
      data: {
        json: () => ({ title: 'T', body: 'B', data: { locale: 'en-US' } }),
        text: () => '',
      },
      waitUntil: jest.fn(),
    };
    handlePush(event, ctx);
    const options = showNotification.mock.calls[0][1];
    expect(options.actions).toEqual([
      { action: 'snooze', title: '⏰ Snooze 30 min' },
      { action: 'log', title: '✅ Log push-ups' },
    ]);
  });

  it('falls back to event.data.text() when json() throws', async () => {
    const { ctx, showNotification } = makeCtx();
    const event: PushEventLike = {
      data: {
        json: () => {
          throw new Error('not json');
        },
        text: () => 'raw text',
      },
      waitUntil: jest.fn(),
    };
    handlePush(event, ctx);
    expect(showNotification).toHaveBeenCalledWith(
      'PushUp Stats',
      expect.objectContaining({ body: 'raw text' })
    );
  });

  it('honours renotify: false when explicitly set in the payload', () => {
    const { ctx, showNotification } = makeCtx();
    const event: PushEventLike = {
      data: {
        json: () => ({ title: 'T', renotify: false }),
        text: () => '',
      },
      waitUntil: jest.fn(),
    };
    handlePush(event, ctx);
    const options = showNotification.mock.calls[0][1];
    expect(options.renotify).toBe(false);
  });
});

describe('handlePushSubscriptionChange', () => {
  it('uses event.newSubscription when provided and posts to clients', async () => {
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn(),
      postMessage: jest.fn(),
    };
    const { ctx, subscribe } = makeCtx({ matchAllResult: [client] });
    const subJson = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/fresh',
      keys: { p256dh: 'p', auth: 'a' },
    };
    const newSub = {
      toJSON: () => subJson,
    } as unknown as PushSubscription;
    let waited: Promise<unknown> | undefined;
    const event: PushSubscriptionChangeEventLike = {
      oldSubscription: null,
      newSubscription: newSub,
      waitUntil: (p) => {
        waited = p;
      },
    };
    handlePushSubscriptionChange(event, ctx);
    await waited;
    expect(subscribe).not.toHaveBeenCalled();
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      sub: subJson,
    });
  });

  it('re-subscribes with old options when newSubscription is absent', async () => {
    const oldOptions = {
      userVisibleOnly: true,
      applicationServerKey: new ArrayBuffer(65),
    } as PushSubscriptionOptions;
    const freshJson = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/resubscribed',
      keys: { p256dh: 'p', auth: 'a' },
    };
    const freshSub = {
      toJSON: () => freshJson,
    } as unknown as PushSubscription;
    const subscribe = jest.fn().mockResolvedValue(freshSub);
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn(),
      postMessage: jest.fn(),
    };
    const { ctx } = makeCtx({ subscribe, matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const event: PushSubscriptionChangeEventLike = {
      oldSubscription: {
        options: oldOptions,
      } as unknown as PushSubscription,
      newSubscription: null,
      waitUntil: (p) => {
        waited = p;
      },
    };
    handlePushSubscriptionChange(event, ctx);
    await waited;
    expect(subscribe).toHaveBeenCalledWith(oldOptions);
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      sub: freshJson,
    });
  });

  it('resolves quietly when no clients are open', async () => {
    const { ctx } = makeCtx({ matchAllResult: [] });
    const newSub = {
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/bg' }),
    } as unknown as PushSubscription;
    let waited: Promise<unknown> | undefined;
    const event: PushSubscriptionChangeEventLike = {
      oldSubscription: null,
      newSubscription: newSub,
      waitUntil: (p) => {
        waited = p;
      },
    };
    handlePushSubscriptionChange(event, ctx);
    await expect(waited).resolves.toBeUndefined();
  });

  it('swallows errors so the event loop doesn’t reject', async () => {
    const subscribe = jest.fn().mockRejectedValue(new Error('boom'));
    const { ctx } = makeCtx({ subscribe });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {
      // silent
    });
    let waited: Promise<unknown> | undefined;
    const event: PushSubscriptionChangeEventLike = {
      oldSubscription: {
        options: {
          userVisibleOnly: true,
          applicationServerKey: new ArrayBuffer(65),
        },
      } as unknown as PushSubscription,
      newSubscription: null,
      waitUntil: (p) => {
        waited = p;
      },
    };
    handlePushSubscriptionChange(event, ctx);
    await expect(waited).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
