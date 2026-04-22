import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Vitest/Vite resolves both `__dirname` and `import.meta.url` to workspace
// root, so hardcode the path relative to CWD (Nx runs tests from the repo
// root). sw-push.js lives alongside this spec.
const SW_REL_PATH = 'web/src/sw-push.js';

/**
 * sw-push.js runs inside the Service Worker global, which we can't import the
 * file into. Instead, read the source and execute it inside a Node vm
 * context with a mocked `self` / `clients` / `importScripts`. That lets us
 * assert the listeners the SW registers without spinning up a real SW harness.
 */

type Listener = (event: unknown) => unknown;

const SW_PATH = resolve(process.cwd(), SW_REL_PATH);

function loadSwPush(context: Record<string, unknown>): void {
  const swSource = readFileSync(SW_PATH, 'utf8');
  runInNewContext(swSource, context, { filename: 'sw-push.js' });
}

function makeContext(): {
  listeners: Record<string, Listener>;
  context: Record<string, unknown>;
  subscribe: ReturnType<typeof vi.fn>;
  matchAll: ReturnType<typeof vi.fn>;
} {
  const listeners: Record<string, Listener> = {};
  const subscribe = vi.fn();
  const matchAll = vi.fn().mockResolvedValue([]);
  const self: Record<string, unknown> = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    registration: {
      pushManager: { subscribe },
      showNotification: vi.fn(),
    },
    location: new URL('https://example.com/sw-push.js'),
  };
  const clients = {
    matchAll,
    openWindow: vi.fn(),
  };
  // vm contexts don't provide globals automatically — wire what sw-push needs.
  const context: Record<string, unknown> = {
    self,
    clients,
    importScripts: () => undefined,
    console,
    URL,
  };
  return { listeners, context, subscribe, matchAll };
}

describe('sw-push.js — pushsubscriptionchange regression', () => {
  let ctx: ReturnType<typeof makeContext>;

  beforeEach(() => {
    ctx = makeContext();
    loadSwPush(ctx.context);
  });

  it('registers a pushsubscriptionchange listener', () => {
    // Without this listener, a subscription invalidated by the push service
    // silently becomes a zombie — every server-side send fails forever.
    expect(ctx.listeners['pushsubscriptionchange']).toBeDefined();
  });

  it('uses event.newSubscription when provided and notifies clients to save it', async () => {
    const handler = ctx.listeners['pushsubscriptionchange'];
    expect(handler).toBeDefined();

    const postMessage = vi.fn();
    ctx.matchAll.mockResolvedValue([{ postMessage }]);

    const newSub = {
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/fresh',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    };
    let waited: Promise<unknown> | undefined;
    const event = {
      oldSubscription: null,
      newSubscription: newSub,
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
    };

    handler(event);
    await waited;

    // Must NOT re-subscribe when the browser already handed us newSubscription.
    expect(ctx.subscribe).not.toHaveBeenCalled();
    // Clients receive the fresh subscription so the app can call savePushSubscription.
    expect(postMessage).toHaveBeenCalledWith({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      sub: newSub.toJSON(),
    });
  });

  it('re-subscribes using the old options when newSubscription is absent', async () => {
    const handler = ctx.listeners['pushsubscriptionchange'];
    const oldOptions = {
      userVisibleOnly: true,
      applicationServerKey: new ArrayBuffer(65),
    };
    const newSub = {
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/resubscribed',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    };
    ctx.subscribe.mockResolvedValue(newSub);

    const postMessage = vi.fn();
    ctx.matchAll.mockResolvedValue([{ postMessage }]);

    let waited: Promise<unknown> | undefined;
    const event = {
      oldSubscription: { options: oldOptions },
      newSubscription: null,
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
    };

    handler(event);
    await waited;

    // Re-subscribing must reuse the applicationServerKey from the old sub so
    // the new sub remains valid against the same VAPID keypair.
    expect(ctx.subscribe).toHaveBeenCalledWith(oldOptions);
    expect(postMessage).toHaveBeenCalledWith({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      sub: newSub.toJSON(),
    });
  });

  it('does not throw when there are no open clients to notify', async () => {
    const handler = ctx.listeners['pushsubscriptionchange'];
    const newSub = {
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/bg',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    };
    ctx.matchAll.mockResolvedValue([]);

    let waited: Promise<unknown> | undefined;
    const event = {
      oldSubscription: null,
      newSubscription: newSub,
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
    };

    handler(event);
    // Must resolve without throwing; the next time the app opens, its
    // init() will re-register the new subscription anyway.
    await expect(waited).resolves.toBeUndefined();
  });
});
