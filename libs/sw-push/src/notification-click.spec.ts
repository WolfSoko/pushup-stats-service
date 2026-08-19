/**
 * Unit tests for the `notificationclick` routing. Run against the pure
 * exports in `notification-click.ts` without any Service Worker runtime.
 */

import {
  DRAIN_INTENTS_MESSAGE,
  handleNotificationClick,
  INTENT_ACK_TIMEOUT_MS,
  SNOOZE_MINUTES,
  SW_QUICK_LOG_MAX,
  type NotificationClickEventLike,
} from './notification-click';
import { type PushIntent } from './intent-queue';
import { type SwContext } from './handlers';

type ClientLike = {
  url: string;
  focus: jest.Mock;
  postMessage: jest.Mock;
};

/**
 * Window-client double that answers the drain channel the way the app does
 * (`push-intent-drain.service.ts`). `ok: false` models a client that could
 * not apply the intent (e.g. the snooze callable failed).
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

/** Client that never answers — a frozen PWA tab. */
function makeFrozenClient(url = 'https://pushup-stats.com/de/app'): ClientLike {
  return {
    url,
    focus: jest.fn().mockResolvedValue(undefined),
    postMessage: jest.fn(),
  };
}

function makeCtx(overrides?: {
  matchAllResult?: ClientLike[];
  saveIntent?: jest.Mock;
}): {
  ctx: SwContext;
  matchAll: jest.Mock;
  openWindow: jest.Mock;
  saveIntent: jest.Mock;
} {
  const matchAll = jest.fn().mockResolvedValue(overrides?.matchAllResult ?? []);
  const openWindow = jest.fn().mockResolvedValue(undefined);
  const saveIntent =
    overrides?.saveIntent ?? jest.fn().mockResolvedValue(undefined);
  const ctx = {
    registration: {
      showNotification: jest.fn().mockResolvedValue(undefined),
      pushManager: { subscribe: jest.fn() } as unknown as PushManager,
    } as SwContext['registration'],
    clients: { matchAll, openWindow },
    origin: 'https://pushup-stats.com',
    saveIntent,
  };
  return { ctx, matchAll, openWindow, saveIntent };
}

/** The intent handed to `ctx.saveIntent` on the last call. */
function savedIntent(saveIntent: jest.Mock): PushIntent {
  return saveIntent.mock.calls.at(-1)?.[0] as PushIntent;
}

describe('handleNotificationClick', () => {
  function makeEvent(
    action: string,
    data?: { locale?: string; url?: string; quickLogReps?: number } | null
  ): {
    event: NotificationClickEventLike;
    close: jest.Mock;
    settled: () => Promise<unknown>;
  } {
    const close = jest.fn();
    let waited: Promise<unknown> | undefined;
    const event: NotificationClickEventLike = {
      action,
      notification: { data: data ?? null, close },
      waitUntil: (promise) => {
        waited = promise;
      },
    };
    return { close, event, settled: () => waited ?? Promise.resolve() };
  }

  it('should close the notification on every click', () => {
    // given
    const { ctx } = makeCtx();
    const { event, close } = makeEvent('');

    // when
    handleNotificationClick(event, ctx);

    // then
    expect(close).toHaveBeenCalledTimes(1);
  });

  describe('snooze action', () => {
    it('should store a snooze intent before touching any window', async () => {
      // given an open, responsive client
      const client = makeAckingClient();
      const { ctx, saveIntent, openWindow } = makeCtx({
        matchAllResult: [client],
      });
      const { event, settled } = makeEvent('snooze', { locale: 'de' });

      // when the snooze button is tapped
      handleNotificationClick(event, ctx);
      await settled();

      // then the intent is durable, and the ack spares the user a window
      expect(savedIntent(saveIntent)).toMatchObject({
        type: 'snooze',
        snoozeMinutes: SNOOZE_MINUTES,
      });
      expect(savedIntent(saveIntent).id).toEqual(expect.any(String));
      expect(savedIntent(saveIntent).createdAt).toEqual(expect.any(Number));
      expect(client.postMessage).toHaveBeenCalledWith(
        { type: DRAIN_INTENTS_MESSAGE },
        expect.any(Array)
      );
      expect(openWindow).not.toHaveBeenCalled();
    });

    // Regression: a backgrounded PWA on Android is frozen. `matchAll` returns
    // it, but the nudge sits unprocessed in its queue — the snooze must not
    // depend on it being answered.
    it('should focus a frozen client so it thaws and drains the intent', async () => {
      // given a client that never acknowledges
      jest.useFakeTimers();
      const client = makeFrozenClient();
      const { ctx, saveIntent, openWindow } = makeCtx({
        matchAllResult: [client],
      });
      const { event, settled } = makeEvent('snooze', { locale: 'de' });

      // when the ack window elapses
      handleNotificationClick(event, ctx);
      await jest.advanceTimersByTimeAsync(INTENT_ACK_TIMEOUT_MS + 1);
      await settled();
      jest.useRealTimers();

      // then the intent survives and a window is brought to the front
      expect(saveIntent).toHaveBeenCalledTimes(1);
      expect(client.focus).toHaveBeenCalledTimes(1);
      expect(openWindow).not.toHaveBeenCalled();
    });

    it('should open a window when no client is open at all', async () => {
      // given a fully closed app
      const { ctx, saveIntent, openWindow } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('snooze', { locale: 'de' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then the intent is stored and the app is opened to drain it —
      // no `?snooze=` param, which Android drops on task resume
      expect(saveIntent).toHaveBeenCalledTimes(1);
      expect(openWindow).toHaveBeenCalledWith('/de/app');
    });

    it('should fall back to a window when the client reports it could not act', async () => {
      // given a client whose snooze callable failed
      jest.useFakeTimers();
      const client = makeAckingClient('https://pushup-stats.com/de/app', false);
      const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
      const { event, settled } = makeEvent('snooze', { locale: 'de' });

      // when
      handleNotificationClick(event, ctx);
      await jest.advanceTimersByTimeAsync(INTENT_ACK_TIMEOUT_MS + 1);
      await settled();
      jest.useRealTimers();

      // then the user still ends up in front of the app
      expect(client.focus).toHaveBeenCalledTimes(1);
      expect(openWindow).not.toHaveBeenCalled();
    });

    it('should nudge every open client, not just the first', async () => {
      // given two clients where only the second answers
      const frozen = makeFrozenClient('https://pushup-stats.com/de/history');
      const live = makeAckingClient();
      const { ctx, openWindow } = makeCtx({ matchAllResult: [frozen, live] });
      const { event, settled } = makeEvent('snooze', { locale: 'de' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then both were asked and the ack ended it
      expect(frozen.postMessage).toHaveBeenCalledTimes(1);
      expect(live.postMessage).toHaveBeenCalledTimes(1);
      expect(openWindow).not.toHaveBeenCalled();
    });

    // Regression: the reported bug — a snooze tap must never produce an entry.
    it('should never store a quick-log intent, even when the payload carries reps', async () => {
      // given a payload that also has a quick-log count
      const { ctx, saveIntent, openWindow } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('snooze', {
        locale: 'de',
        quickLogReps: 20,
      });

      // when the snooze button is tapped
      handleNotificationClick(event, ctx);
      await settled();

      // then nothing about logging reaches the app
      expect(savedIntent(saveIntent).type).toBe('snooze');
      expect(savedIntent(saveIntent).reps).toBeUndefined();
      expect(openWindow).toHaveBeenCalledWith('/de/app');
    });

    it('should give up quietly when the intent cannot be stored', async () => {
      // given an unavailable IndexedDB
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // silence the expected diagnostic
      });
      const saveIntent = jest.fn().mockRejectedValue(new Error('no idb'));
      const { ctx, openWindow, matchAll } = makeCtx({ saveIntent });
      const { event, settled } = makeEvent('snooze', { locale: 'de' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then no window is opened for an action that cannot be carried out
      expect(matchAll).not.toHaveBeenCalled();
      expect(openWindow).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it('should route to the locale-prefixed URL for non-de/en locales (zh)', async () => {
      // given
      const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('snooze', { locale: 'zh' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith('/zh/app');
    });
  });

  describe('quick-log action', () => {
    it('should store a quick-log intent with the payload reps', async () => {
      // given an open, responsive client
      const client = makeAckingClient();
      const { ctx, saveIntent, openWindow } = makeCtx({
        matchAllResult: [client],
      });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        quickLogReps: 12,
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(savedIntent(saveIntent)).toMatchObject({
        type: 'quick-log',
        reps: 12,
      });
      expect(openWindow).not.toHaveBeenCalled();
    });

    it('should open the app when no client is open', async () => {
      // given a closed app
      const { ctx, saveIntent, openWindow } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        quickLogReps: 12,
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then the count travels in the intent store, never in the URL —
      // a `?quickLog=` param sticks in the Android task and replays
      expect(savedIntent(saveIntent).reps).toBe(12);
      expect(openWindow).toHaveBeenCalledWith('/de/app');
    });

    it('should offer the dialog when the intent cannot be stored', async () => {
      // given an unavailable IndexedDB
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        // silence the expected diagnostic
      });
      const saveIntent = jest.fn().mockRejectedValue(new Error('no idb'));
      const { ctx, openWindow } = makeCtx({ saveIntent });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        quickLogReps: 12,
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then the button is not silently dead
      expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
      errSpy.mockRestore();
    });

    it('should fall back to ?log=1 when payload reps are missing or invalid', async () => {
      // given a payload without a usable count
      const { ctx, saveIntent, openWindow } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('quick-log', { locale: 'de' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then nothing is queued and the user gets the normal dialog
      expect(saveIntent).not.toHaveBeenCalled();
      expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
    });

    it('should clamp an out-of-range payload to the SW max', async () => {
      // given a tampered/stale payload
      const { ctx, saveIntent } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        quickLogReps: 9999,
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(savedIntent(saveIntent).reps).toBe(SW_QUICK_LOG_MAX);
    });

    it('should floor fractional reps to an integer', async () => {
      // given
      const { ctx, saveIntent } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        quickLogReps: 12.9,
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(savedIntent(saveIntent).reps).toBe(12);
    });
  });

  describe('log action and body tap', () => {
    it('should open the app with ?log=1 for the log action', async () => {
      // given
      const { ctx, openWindow } = makeCtx();
      const { event, settled } = makeEvent('log', { locale: 'de' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
    });

    it('should route the log action to the locale-prefixed URL (fr)', async () => {
      // given
      const { ctx, openWindow } = makeCtx();
      const { event, settled } = makeEvent('log', { locale: 'fr' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith('/fr/app?log=1');
    });

    it('should fall back to the default locale for an unsupported tag', async () => {
      // given 'xx' is not in SW_SUPPORTED_LOCALES
      const { ctx, openWindow } = makeCtx();
      const { event, settled } = makeEvent('log', { locale: 'xx' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
    });

    it('should focus an existing window that already points at the target', async () => {
      // given
      const client = makeFrozenClient('https://pushup-stats.com/de/app');
      const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
      const { event, settled } = makeEvent('', { locale: 'de' });

      // when the notification body is tapped
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(client.focus).toHaveBeenCalled();
      expect(openWindow).not.toHaveBeenCalled();
    });

    it('should open a new window when no matching client exists', async () => {
      // given
      const { ctx, openWindow } = makeCtx({ matchAllResult: [] });
      const { event, settled } = makeEvent('', {
        locale: 'en',
        url: '/en/app?x=1',
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith(
        'https://pushup-stats.com/en/app?x=1'
      );
    });
  });
});
