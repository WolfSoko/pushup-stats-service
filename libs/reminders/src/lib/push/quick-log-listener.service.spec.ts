import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StatsApiService } from '@pu-stats/data-access';
import { of, throwError } from 'rxjs';
import { QuickLogListenerService } from './quick-log-listener.service';

describe('QuickLogListenerService', () => {
  const swDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker'
  );

  let messageListeners: Array<(ev: MessageEvent) => void>;
  let createPushup: jest.Mock;
  let snackOpen: jest.Mock;

  function emitMessage(data: unknown): void {
    for (const listener of messageListeners) {
      listener({ data } as MessageEvent);
    }
  }

  beforeEach(() => {
    messageListeners = [];
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

    createPushup = jest.fn().mockReturnValue(of({ _id: 'new-entry' }));
    snackOpen = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: StatsApiService,
          useValue: { createPushup },
        },
        {
          provide: MatSnackBar,
          useValue: { open: snackOpen },
        },
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

  it('creates a pushup entry when a QUICK_LOG_PUSHUPS message arrives', async () => {
    const service = TestBed.inject(QuickLogListenerService);
    service.init();

    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 15 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createPushup).toHaveBeenCalledTimes(1);
    const payload = createPushup.mock.calls[0][0];
    expect(payload.reps).toBe(15);
    expect(payload.sets).toEqual([15]);
    expect(payload.source).toBe('reminder');
    expect(payload.type).toBe('Standard');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('ignores messages with non-positive or non-finite reps', async () => {
    const service = TestBed.inject(QuickLogListenerService);
    service.init();

    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 0 });
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: -3 });
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: Number.POSITIVE_INFINITY });
    emitMessage({ type: 'QUICK_LOG_PUSHUPS' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createPushup).not.toHaveBeenCalled();
  });

  it('ignores unrelated SW messages', async () => {
    const service = TestBed.inject(QuickLogListenerService);
    service.init();

    emitMessage({ type: 'SNOOZE_REMINDER', snoozeMinutes: 30 });
    emitMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', sub: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createPushup).not.toHaveBeenCalled();
  });

  it('only registers the message listener once across multiple init() calls', () => {
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    service.init();
    service.init();
    expect(messageListeners.length).toBe(1);
  });

  it('floors fractional reps', async () => {
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 12.9 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createPushup.mock.calls[0][0].reps).toBe(12);
  });

  it('clamps oversized reps to QUICK_LOG_REPS_MAX (defense-in-depth)', async () => {
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 9999 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createPushup).toHaveBeenCalledTimes(1);
    expect(createPushup.mock.calls[0][0].reps).toBe(500);
  });

  it('shows a success snackbar after a successful entry', async () => {
    const service = TestBed.inject(QuickLogListenerService);
    await service.logEntry(20);
    expect(snackOpen).toHaveBeenCalled();
    const message = snackOpen.mock.calls[0][0];
    expect(message).toContain('20');
  });

  it('shows an error snackbar when createPushup fails', async () => {
    createPushup.mockReturnValue(throwError(() => new Error('boom')));
    const service = TestBed.inject(QuickLogListenerService);
    await service.logEntry(10);
    expect(snackOpen).toHaveBeenCalled();
  });
});
