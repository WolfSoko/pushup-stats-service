/**
 * Unit tests for the `notificationclick` routing. Run against the pure
 * exports in `notification-click.ts` without any Service Worker runtime.
 */

import {
  handleNotificationClick,
  type NotificationClickEventLike,
  type ReminderActionFeedback,
  type ReminderActionRef,
} from './notification-click';
import { type SwContext } from './handlers';

type ClientLike = {
  url: string;
  focus: jest.Mock;
  postMessage: jest.Mock;
};

const ACTION_URL =
  'https://europe-west3-pushup-stats.cloudfunctions.net/reminderAction';

function makeRef(
  overrides: Partial<ReminderActionRef> = {}
): ReminderActionRef {
  return { uid: 'user-1', token: 'tok-1', url: ACTION_URL, ...overrides };
}

function serverSays(result: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(result),
  } as unknown as Response;
}

function makeCtx(overrides?: {
  matchAllResult?: ClientLike[];
  fetch?: jest.Mock;
}): {
  ctx: SwContext;
  matchAll: jest.Mock;
  openWindow: jest.Mock;
  showNotification: jest.Mock;
  fetch: jest.Mock;
} {
  const matchAll = jest.fn().mockResolvedValue(overrides?.matchAllResult ?? []);
  const openWindow = jest.fn().mockResolvedValue(undefined);
  const showNotification = jest.fn().mockResolvedValue(undefined);
  const fetch =
    overrides?.fetch ??
    jest.fn().mockResolvedValue(serverSays({ result: { ok: true } }));
  const ctx: SwContext = {
    registration: {
      showNotification,
      pushManager: { subscribe: jest.fn() } as unknown as PushManager,
    } as unknown as SwContext['registration'],
    clients: { matchAll, openWindow },
    origin: 'https://pushup-stats.com',
    fetch,
  };
  return { ctx, matchAll, openWindow, showNotification, fetch };
}

/** The JSON body the SW posted on the last call. */
function postedBody(fetch: jest.Mock): { data: Record<string, unknown> } {
  const init = fetch.mock.calls.at(-1)?.[1] as RequestInit;
  return JSON.parse(init.body as string) as { data: Record<string, unknown> };
}

function makeEvent(
  action: string,
  data?: {
    locale?: string;
    url?: string;
    reminderAction?: ReminderActionRef | null;
    feedback?: ReminderActionFeedback | null;
  } | null
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

describe('handleNotificationClick', () => {
  it('should close the notification on every click', () => {
    // given
    const { ctx } = makeCtx();
    const { event, close } = makeEvent('');

    // when
    handleNotificationClick(event, ctx);

    // then
    expect(close).toHaveBeenCalledTimes(1);
  });

  describe('legacy snooze action', () => {
    it('should never call the server for a snooze button from an older notification', async () => {
      // given a notification still showing the removed snooze button
      const { ctx, fetch, showNotification } = makeCtx();
      const { event, settled } = makeEvent('snooze', {
        locale: 'de',
        reminderAction: makeRef(),
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then nothing is posted and no confirmation is faked
      expect(fetch).not.toHaveBeenCalled();
      expect(showNotification).not.toHaveBeenCalled();
    });

    it('should fall through to the body-tap route and just open the app', async () => {
      // given
      const { ctx, openWindow } = makeCtx();
      const { event, settled } = makeEvent('snooze', { locale: 'de' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith(
        'https://pushup-stats.com/de/app'
      );
    });
  });

  describe('quick-log action', () => {
    it('should complete the quick-log on the server without sending a count', async () => {
      // given — the server already knows the offered reps from the token
      const { ctx, fetch, openWindow } = makeCtx();
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        reminderAction: makeRef(),
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(postedBody(fetch)).toEqual({
        data: { uid: 'user-1', token: 'tok-1', action: 'quick-log' },
      });
      expect(openWindow).not.toHaveBeenCalled();
    });

    it('should confirm the entry with the localized feedback text', async () => {
      // given
      const { ctx, showNotification } = makeCtx();
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        reminderAction: makeRef(),
        feedback: { logged: '✅ 10 Liegestütze eingetragen' },
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(showNotification).toHaveBeenCalledWith(
        '✅ 10 Liegestütze eingetragen',
        expect.objectContaining({ data: { url: '/de/app', locale: 'de' } })
      );
    });

    it('should open the entry dialog instead of logging silently when the server refuses', async () => {
      // given
      const { ctx, openWindow, showNotification } = makeCtx({
        fetch: jest.fn().mockResolvedValue(serverSays({}, false)),
      });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'en',
        reminderAction: makeRef(),
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith('/en/app?log=1');
      expect(showNotification).not.toHaveBeenCalled();
    });

    it('should open the entry dialog when the server answers without ok', async () => {
      // given
      const { ctx, openWindow } = makeCtx({
        fetch: jest.fn().mockResolvedValue(serverSays({ result: {} })),
      });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        reminderAction: makeRef(),
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
    });

    it('should open the entry dialog when the payload has no token', async () => {
      // given a notification sent by an older dispatcher
      const { ctx, fetch, openWindow } = makeCtx();
      const { event, settled } = makeEvent('quick-log', { locale: 'zh' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(fetch).not.toHaveBeenCalled();
      expect(openWindow).toHaveBeenCalledWith('/zh/app?log=1');
    });

    it('should open the entry dialog when the network is down', async () => {
      // given
      const { ctx, openWindow } = makeCtx({
        fetch: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      });
      const { event, settled } = makeEvent('quick-log', {
        locale: 'de',
        reminderAction: makeRef(),
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith('/de/app?log=1');
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
      // given
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
      const client: ClientLike = {
        url: 'https://pushup-stats.com/de/app',
        focus: jest.fn().mockResolvedValue(undefined),
        postMessage: jest.fn(),
      };
      const { ctx, openWindow } = makeCtx({ matchAllResult: [client] });
      const { event, settled } = makeEvent('', {
        url: '/de/app',
        locale: 'de',
      });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(client.focus).toHaveBeenCalledTimes(1);
      expect(openWindow).not.toHaveBeenCalled();
    });

    it('should open a new window when no matching client exists', async () => {
      // given
      const { ctx, openWindow } = makeCtx();
      const { event, settled } = makeEvent('', { locale: 'en' });

      // when
      handleNotificationClick(event, ctx);
      await settled();

      // then
      expect(openWindow).toHaveBeenCalledWith(
        'https://pushup-stats.com/en/app'
      );
    });
  });
});
