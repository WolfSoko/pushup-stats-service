/**
 * Handler unit tests. These run against the pure exports in `handlers.ts`
 * without any Service Worker runtime — the original vm-based harness lived
 * in `web/src/sw-push.spec.ts` and was tightly coupled to a raw JS file.
 */

import {
  handleNotificationClick,
  handlePush,
  handlePushSubscriptionChange,
  SW_PUSH_VERSION,
  type NotificationClickEventLike,
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

describe('handleNotificationClick', () => {
  function makeEvent(
    action: string,
    data?: { locale?: string; url?: string; quickLogReps?: number } | null
  ): { event: NotificationClickEventLike; close: jest.Mock } {
    const close = jest.fn();
    return {
      close,
      event: {
        action,
        notification: { data: data ?? null, close },
        waitUntil: jest.fn(),
      },
    };
  }

  it('closes the notification on every click', () => {
    const { ctx } = makeCtx();
    const { event, close } = makeEvent('');
    handleNotificationClick(event, ctx);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('posts SNOOZE_REMINDER when a client is open for the snooze action', async () => {
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn(),
      postMessage: jest.fn(),
    };
    const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('snooze', { locale: 'de' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'SNOOZE_REMINDER',
      snoozeMinutes: 30,
    });
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens the app with ?snooze=30 when no client is open', async () => {
    const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('snooze', { locale: 'en' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/en/app?snooze=30');
  });

  // Regression: a snooze click on a notification that ALSO carries
  // `quickLogReps` (the configured "Log N" button data) must never produce
  // a quick-log message — only SNOOZE_REMINDER. Locks in the contract that
  // the snooze handler ignores `data.quickLogReps` and the message types
  // stay strictly partitioned, so a snooze click can never silently log
  // push-ups even on a notification built with the quick-log action.
  it('snooze action ignores notification.data.quickLogReps and never posts QUICK_LOG_PUSHUPS', async () => {
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn(),
      postMessage: jest.fn(),
    };
    const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('snooze', {
      locale: 'de',
      quickLogReps: 25,
    });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;

    // Exactly one message, of type SNOOZE_REMINDER. No QUICK_LOG_PUSHUPS
    // leaks out, and the snooze count is 30 — not the quickLogReps value.
    expect(client.postMessage).toHaveBeenCalledTimes(1);
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'SNOOZE_REMINDER',
      snoozeMinutes: 30,
    });
    const allMessageTypes = client.postMessage.mock.calls.map(
      (call) => (call[0] as { type?: string }).type
    );
    expect(allMessageTypes).not.toContain('QUICK_LOG_PUSHUPS');
    expect(openWindow).not.toHaveBeenCalled();
  });

  // Regression: when no client is open, the snooze deep-link URL must not
  // include `quickLog` even if `data.quickLogReps` was set on the
  // notification. App.ts handles `?snooze=30` by calling the snoozeReminder
  // Cloud Function — the dashboard must not see a `quickLog` param that
  // would silently create an entry alongside.
  it('snooze action without an open client opens ?snooze=30 only — never with quickLog', async () => {
    const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('snooze', {
      locale: 'de',
      quickLogReps: 25,
    });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(openWindow).toHaveBeenCalledWith('/de/app?snooze=30');
    const openedUrl = openWindow.mock.calls[0][0] as string;
    expect(openedUrl).not.toContain('quickLog');
    expect(openedUrl).not.toContain('log=1');
  });

  it('opens the app with ?log=1 for the log action', async () => {
    const { ctx, openWindow } = makeCtx();
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('log', { locale: 'de' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
  });

  it('routes the log action to the locale-prefixed URL for non-de/en locales (fr)', async () => {
    const { ctx, openWindow } = makeCtx();
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('log', { locale: 'fr' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/fr/app?log=1');
  });

  it('routes the snooze action to the locale-prefixed URL for non-de/en locales (zh)', async () => {
    const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('snooze', { locale: 'zh' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/zh/app?snooze=30');
  });

  it('falls back to the default locale URL for an unsupported locale tag', async () => {
    const { ctx, openWindow } = makeCtx();
    let waited: Promise<unknown> | undefined;
    // 'xx' is not in SW_SUPPORTED_LOCALES, so we fall back to the default
    // (de) and open `/de/app?log=1` rather than `/xx/app?log=1`.
    const { event } = makeEvent('log', { locale: 'xx' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
  });

  it('quick-log: posts QUICK_LOG_PUSHUPS to an open client and skips openWindow', async () => {
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn().mockResolvedValue(undefined),
      postMessage: jest.fn(),
    };
    const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('quick-log', {
      locale: 'de',
      quickLogReps: 25,
    });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'QUICK_LOG_PUSHUPS',
      reps: 25,
    });
    expect(client.focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('quick-log: opens the app with ?quickLog=N when no client is open', async () => {
    const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('quick-log', {
      locale: 'en',
      quickLogReps: 7,
    });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/en/app?quickLog=7');
  });

  it('quick-log: falls back to ?log=1 when payload reps are missing/invalid', async () => {
    const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('quick-log', { locale: 'de' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
  });

  it('quick-log: clamps an out-of-range payload to the SW max (defense-in-depth)', async () => {
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn().mockResolvedValue(undefined),
      postMessage: jest.fn(),
    };
    const { ctx } = makeCtx({ matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('quick-log', {
      locale: 'de',
      quickLogReps: 99999,
    });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'QUICK_LOG_PUSHUPS',
      reps: 500,
    });
  });

  it('quick-log: clamps the deep-link reps when no client is open', async () => {
    const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('quick-log', {
      locale: 'en',
      quickLogReps: 99999,
    });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith('/en/app?quickLog=500');
  });

  it('quick-log: floors fractional reps to an integer', async () => {
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn().mockResolvedValue(undefined),
      postMessage: jest.fn(),
    };
    const { ctx } = makeCtx({ matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('quick-log', {
      locale: 'de',
      quickLogReps: 12.9,
    });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'QUICK_LOG_PUSHUPS',
      reps: 12,
    });
  });

  it('focuses an existing window if it already points to the target URL', async () => {
    const client: ClientLike = {
      url: 'https://pushup-stats.com/de/app',
      focus: jest.fn().mockResolvedValue(undefined),
      postMessage: jest.fn(),
    };
    const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('', { locale: 'de' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(client.focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a new window when no matching client exists', async () => {
    const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('', { locale: 'en', url: '/en/app?x=1' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(openWindow).toHaveBeenCalledWith(
      'https://pushup-stats.com/en/app?x=1'
    );
  });
});
