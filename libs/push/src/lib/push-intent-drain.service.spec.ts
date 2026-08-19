import 'fake-indexeddb/auto';
import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '@pu-auth/auth';
import { IDBFactory } from 'fake-indexeddb';

import {
  DRAIN_INTENTS_MESSAGE,
  PushIntentDrainService,
} from './push-intent-drain.service';
import {
  PUSH_INTENT_DB,
  PUSH_INTENT_DB_VERSION,
  PUSH_INTENT_MAX_AGE_MS,
  PUSH_INTENT_STORE,
  type PushIntent,
} from './push-intent-queue';
import { PushSubscriptionStore } from './push-subscription.store';
import { QuickLogService } from './quick-log.service';

jest.mock('@angular/fire/firestore', () => ({ Firestore: jest.fn() }));
jest.mock('@angular/fire/auth', () => ({ Auth: jest.fn() }));

function intent(overrides: Partial<PushIntent> = {}): PushIntent {
  return {
    id: `id-${Math.random()}`,
    type: 'snooze',
    createdAt: Date.now(),
    snoozeMinutes: 30,
    ...overrides,
  };
}

async function seed(intents: PushIntent[]): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PUSH_INTENT_DB, PUSH_INTENT_DB_VERSION);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(PUSH_INTENT_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PUSH_INTENT_STORE, 'readwrite');
    for (const item of intents) tx.objectStore(PUSH_INTENT_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

describe('PushIntentDrainService', () => {
  const swDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker'
  );

  let messageListeners: Array<(ev: MessageEvent) => void>;
  let snooze: jest.Mock;
  let logEntry: jest.Mock;
  let authResolved: ReturnType<typeof signal<boolean>>;

  function setup(): PushIntentDrainService {
    return TestBed.inject(PushIntentDrainService);
  }

  /**
   * IndexedDB resolves each request on its own macrotask, so a single tick is
   * not enough to observe a fire-and-forget drain triggered by an event.
   */
  async function flushAsync(): Promise<void> {
    for (let i = 0; i < 25; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  function emitSwMessage(data: unknown, ports: MessagePort[] = []): void {
    for (const listener of messageListeners) {
      listener({ data, ports } as unknown as MessageEvent);
    }
  }

  beforeEach(() => {
    // Fresh database per test — intents are consumed on read, so leakage
    // between tests would mask exactly the bug these tests guard.
    globalThis.indexedDB = new IDBFactory() as unknown as globalThis.IDBFactory;

    messageListeners = [];
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: jest.fn(
          (type: string, listener: (ev: MessageEvent) => void) => {
            if (type === 'message') messageListeners.push(listener);
          }
        ),
        removeEventListener: jest.fn(
          (type: string, listener: (ev: MessageEvent) => void) => {
            if (type !== 'message') return;
            const index = messageListeners.indexOf(listener);
            if (index >= 0) messageListeners.splice(index, 1);
          }
        ),
      },
      configurable: true,
      writable: true,
    });

    snooze = jest.fn().mockResolvedValue(undefined);
    logEntry = jest.fn().mockResolvedValue(true);
    authResolved = signal(true);

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: PushSubscriptionStore, useValue: { snooze } },
        { provide: QuickLogService, useValue: { logEntry } },
        { provide: AuthStore, useValue: { authResolved } },
      ],
    });
  });

  afterEach(() => {
    if (swDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', swDescriptor);
    } else {
      delete (navigator as Record<string, unknown>)['serviceWorker'];
    }
  });

  it('should apply a stored snooze once auth has resolved', async () => {
    // given a snooze tapped while the app was closed
    await seed([intent({ snoozeMinutes: 30 })]);

    // when the app boots and the effect fires
    setup();
    TestBed.tick();
    await TestBed.inject(PushIntentDrainService).drain();

    // then the callable finally reaches the backend
    expect(snooze).toHaveBeenCalledWith(30);
  });

  // Regression: the snooze callable needs a Firebase Auth token. Intents are
  // consumed on read, so draining before auth resolves would burn them.
  it('should not touch the store before auth has resolved', async () => {
    // given an unresolved session and a pending snooze
    authResolved.set(false);
    await seed([intent()]);

    // when
    const service = setup();
    TestBed.tick();
    const applied = await service.drain();

    // then nothing was consumed, and a later drain still finds it
    expect(applied).toBe(false);
    expect(snooze).not.toHaveBeenCalled();
    authResolved.set(true);
    await service.drain();
    expect(snooze).toHaveBeenCalledWith(30);
  });

  // Regression: the reported bug. A quick-log intent that outlived the push
  // TTL must never be applied — production wrote a 20-rep entry at 02:05,
  // inside quiet hours, when a frozen tab finally thawed.
  it('should discard a stale quick-log instead of writing a phantom entry', async () => {
    // given a quick-log tap from well beyond the TTL
    await seed([
      intent({
        type: 'quick-log',
        reps: 20,
        createdAt: Date.now() - PUSH_INTENT_MAX_AGE_MS - 1,
      }),
    ]);

    // when the app resumes much later
    const service = setup();
    const applied = await service.drain();

    // then no entry is created
    expect(logEntry).not.toHaveBeenCalled();
    expect(applied).toBe(false);
  });

  // Regression: the SW nudge and `visibilitychange` routinely overlap.
  it('should apply an intent at most once across racing drains', async () => {
    // given one fresh quick-log
    await seed([intent({ type: 'quick-log', reps: 20 })]);

    // when two drains race
    const service = setup();
    const results = await Promise.all([service.drain(), service.drain()]);
    await service.drain();

    // then exactly one entry is written, and only the drain that claimed the
    // intent reports success — the other read an empty store
    expect(logEntry).toHaveBeenCalledTimes(1);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  // Regression: a nudge arriving mid-drain asks about an intent the running
  // drain never read. Answering it from that stale read would tell the SW the
  // tap was handled, so no window is focused and the intent waits — possibly
  // past its expiry.
  it('should give a drain that starts mid-flight its own read', async () => {
    // given a settled startup drain, then a snooze whose callable hangs
    const service = setup();
    await flushAsync();
    let releaseFirst: () => void = () => undefined;
    snooze.mockImplementation(
      () => new Promise<void>((resolve) => (releaseFirst = resolve))
    );
    await seed([intent()]);
    const first = service.drain();
    await flushAsync();

    // when a second intent lands and a second drain is triggered
    await seed([intent({ type: 'quick-log', reps: 20 })]);
    const second = service.drain();
    releaseFirst();

    // then the late intent is applied instead of being reported as handled
    await Promise.all([first, second]);
    expect(await second).toBe(true);
    expect(logEntry).toHaveBeenCalledWith(20);
  });

  it('should drain and acknowledge when the service worker nudges', async () => {
    // given a running app whose startup drain has already settled, and a
    // snooze tapped after that
    const service = setup();
    service.init();
    await flushAsync();
    await seed([intent()]);
    const postMessage = jest.fn();

    // when the SW asks the client to drain
    emitSwMessage({ type: DRAIN_INTENTS_MESSAGE }, [
      { postMessage } as unknown as MessagePort,
    ]);
    await flushAsync();

    // then the SW learns it need not open a window
    expect(snooze).toHaveBeenCalledWith(30);
    expect(postMessage).toHaveBeenCalledWith({ ok: true });
  });

  it('should report failure on the port when the snooze callable rejects', async () => {
    // given a callable that fails (e.g. offline)
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {
      // silence the expected diagnostic
    });
    snooze.mockRejectedValue(new Error('unauthenticated'));
    const service = setup();
    service.init();
    await flushAsync();
    await seed([intent()]);
    const postMessage = jest.fn();

    // when
    emitSwMessage({ type: DRAIN_INTENTS_MESSAGE }, [
      { postMessage } as unknown as MessagePort,
    ]);
    await flushAsync();

    // then the SW falls back to bringing a window up
    expect(postMessage).toHaveBeenCalledWith({ ok: false });
    errSpy.mockRestore();
  });

  it('should ignore unrelated service-worker messages', async () => {
    // given a pending snooze that the startup drain has not seen
    const service = setup();
    service.init();
    await flushAsync();
    await seed([intent()]);

    // when
    emitSwMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', sub: {} });
    await flushAsync();

    // then the pending intent is left untouched for a real trigger
    expect(snooze).not.toHaveBeenCalled();
  });

  // Regression: Android resumes an existing PWA task instead of navigating,
  // so the SW's nudge can stay queued — becoming visible is the only signal
  // that reliably arrives.
  it('should drain when the document becomes visible', async () => {
    // given a snooze tapped while the app sat frozen in the background
    const service = setup();
    service.init();
    await flushAsync();
    await seed([intent()]);

    // when the PWA is brought to the front
    document.dispatchEvent(new Event('visibilitychange'));
    await flushAsync();

    // then
    expect(snooze).toHaveBeenCalledWith(30);
  });

  it('should register its listeners only once across repeated init() calls', () => {
    // given / when
    const service = setup();
    service.init();
    service.init();
    service.init();

    // then
    expect(messageListeners.length).toBe(1);
  });

  it('should apply both intent kinds when they queue up together', async () => {
    // given a quick-log and a snooze from two notifications
    await seed([
      intent({ type: 'quick-log', reps: 20, createdAt: Date.now() - 2000 }),
      intent({ createdAt: Date.now() - 1000 }),
    ]);

    // when
    const service = setup();
    await service.drain();

    // then both reach their handler
    expect(logEntry).toHaveBeenCalledWith(20);
    expect(snooze).toHaveBeenCalledWith(30);
  });
});
