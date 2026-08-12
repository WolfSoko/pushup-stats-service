/**
 * Unit tests for the `notificationclick` routing. Run against the pure
 * exports in `notification-click.ts` without any Service Worker runtime.
 */

import {
  handleNotificationClick,
  SNOOZE_ACK_TIMEOUT_MS,
  type NotificationClickEventLike,
} from './notification-click';
import { type SwContext } from './handlers';

type ClientLike = {
  url: string;
  focus: jest.Mock;
  postMessage: jest.Mock;
};

/**
 * Window-client double that answers the snooze ack channel the way the app
 * does (`push-subscription.store.ts`). `ok: false` models a client whose
 * `snoozeReminder` call failed.
 */
function makeAckingClient(
  url = 'https://pushup-stats.com/de/app',
  ok = true
): ClientLike {
  const postMessage = jest.fn((_message: unknown, transfer?: unknown[]) => {
    const port = transfer?.[0] as MessagePort | undefined;
    port?.postMessage({ ok });
  });
  return { url, focus: jest.fn().mockResolvedValue(undefined), postMessage };
}

function makeCtx(overrides?: { matchAllResult?: ClientLike[] }): {
  ctx: SwContext;
  matchAll: jest.Mock;
  openWindow: jest.Mock;
} {
  const matchAll = jest.fn().mockResolvedValue(overrides?.matchAllResult ?? []);
  const openWindow = jest.fn().mockResolvedValue(undefined);
  const ctx = {
    registration: {
      showNotification: jest.fn().mockResolvedValue(undefined),
      pushManager: { subscribe: jest.fn() } as unknown as PushManager,
    } as SwContext['registration'],
    clients: { matchAll, openWindow },
    origin: 'https://pushup-stats.com',
  };
  return { ctx, matchAll, openWindow };
}

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
    const client = makeAckingClient();
    const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('snooze', { locale: 'de' });
    event.waitUntil = (p) => {
      waited = p;
    };
    handleNotificationClick(event, ctx);
    await waited;
    expect(client.postMessage).toHaveBeenCalledWith(
      { type: 'SNOOZE_REMINDER', snoozeMinutes: 30 },
      [expect.anything()]
    );
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

  // Regression (production): a backgrounded tab can be frozen — `matchAll`
  // still returns it, but the posted message is never handled and dies with
  // the tab. That silently dropped every snooze (zero `snoozeReminder`
  // invocations server-side while reminders kept firing). Falling back to
  // the deep link keeps the snooze reaching the backend.
  it('falls back to the ?snooze deep link when a client never acknowledges', async () => {
    jest.useFakeTimers();
    try {
      // given a client that receives the message but never answers (frozen)
      const frozen: ClientLike = {
        url: 'https://pushup-stats.com/de/app',
        focus: jest.fn(),
        postMessage: jest.fn(),
      };
      const { ctx, openWindow } = makeCtx({ matchAllResult: [frozen] });
      let waited: Promise<unknown> | undefined;
      const { event } = makeEvent('snooze', { locale: 'de' });
      event.waitUntil = (p) => {
        waited = p;
      };

      // when the ack window elapses
      handleNotificationClick(event, ctx);
      await jest.advanceTimersByTimeAsync(SNOOZE_ACK_TIMEOUT_MS);
      await waited;

      // then the snooze still reaches the app via the deep link
      expect(frozen.postMessage).toHaveBeenCalled();
      expect(openWindow).toHaveBeenCalledWith('/de/app?snooze=30');
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to the ?snooze deep link when the client reports the callable failed', async () => {
    jest.useFakeTimers();
    try {
      // given a client whose snoozeReminder call rejected
      const failing = makeAckingClient(
        'https://pushup-stats.com/de/app',
        false
      );
      const { ctx, openWindow } = makeCtx({ matchAllResult: [failing] });
      let waited: Promise<unknown> | undefined;
      const { event } = makeEvent('snooze', { locale: 'de' });
      event.waitUntil = (p) => {
        waited = p;
      };

      // when the ack window elapses
      handleNotificationClick(event, ctx);
      await jest.advanceTimersByTimeAsync(SNOOZE_ACK_TIMEOUT_MS);
      await waited;

      // then the deep link takes over instead of dropping the snooze
      expect(openWindow).toHaveBeenCalledWith('/de/app?snooze=30');
    } finally {
      jest.useRealTimers();
    }
  });

  it('messages every open client, not just the first, and stops at the first ack', async () => {
    // given a frozen tab ordered before the live one
    const frozen: ClientLike = {
      url: 'https://pushup-stats.com/de/blog',
      focus: jest.fn(),
      postMessage: jest.fn(),
    };
    const live = makeAckingClient();
    const { ctx, openWindow } = makeCtx({ matchAllResult: [frozen, live] });
    let waited: Promise<unknown> | undefined;
    const { event } = makeEvent('snooze', { locale: 'de' });
    event.waitUntil = (p) => {
      waited = p;
    };

    // when the snooze action is clicked
    handleNotificationClick(event, ctx);
    await waited;

    // then the live client's ack settles it without opening a window
    expect(frozen.postMessage).toHaveBeenCalled();
    expect(live.postMessage).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  // Regression: a snooze click on a notification that ALSO carries
  // `quickLogReps` (the configured "Log N" button data) must never produce
  // a quick-log message — only SNOOZE_REMINDER. Locks in the contract that
  // the snooze handler ignores `data.quickLogReps` and the message types
  // stay strictly partitioned, so a snooze click can never silently log
  // push-ups even on a notification built with the quick-log action.
  it('snooze action ignores notification.data.quickLogReps and never posts QUICK_LOG_PUSHUPS', async () => {
    const client = makeAckingClient();
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
    expect(client.postMessage).toHaveBeenCalledWith(
      { type: 'SNOOZE_REMINDER', snoozeMinutes: 30 },
      [expect.anything()]
    );
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
