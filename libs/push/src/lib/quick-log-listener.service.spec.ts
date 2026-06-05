import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ExerciseFirestoreService,
  PushupValidationError,
} from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import { of, throwError } from 'rxjs';
import { QuickLogListenerService } from './quick-log-listener.service';

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock('@angular/fire/auth', () => ({ Auth: jest.fn() }));

describe('QuickLogListenerService', () => {
  const swDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker'
  );

  let messageListeners: Array<(ev: MessageEvent) => void>;
  let createEntry: jest.Mock;
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

    createEntry = jest.fn().mockReturnValue(of({ _id: 'new-entry' }));
    snackOpen = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ExerciseFirestoreService,
          useValue: { createEntry },
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => 'test-uid' },
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

  it('should create a pushup exercise entry when a QUICK_LOG_PUSHUPS message arrives', async () => {
    // given
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    // when
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 15 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // then
    expect(createEntry).toHaveBeenCalledTimes(1);
    const [userId, payload] = createEntry.mock.calls[0];
    expect(userId).toBe('test-uid');
    expect(payload.exerciseId).toBe('pushup');
    expect(payload.reps).toBe(15);
    expect(payload.sets).toEqual([15]);
    expect(payload.source).toBe('reminder');
    // Pushups carry no variant post-cutover, so no variantId is sent.
    expect(payload.variantId).toBeUndefined();
    expect(typeof payload.timestamp).toBe('string');
  });

  it('should ignore messages with non-positive or non-finite reps', async () => {
    // given
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    // when
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 0 });
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: -3 });
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: Number.POSITIVE_INFINITY });
    emitMessage({ type: 'QUICK_LOG_PUSHUPS' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // then
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('should ignore unrelated SW messages', async () => {
    // given
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    // when
    emitMessage({ type: 'SNOOZE_REMINDER', snoozeMinutes: 30 });
    emitMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', sub: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // then
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('should only register the message listener once across multiple init() calls', () => {
    // given / when
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    service.init();
    service.init();
    // then
    expect(messageListeners.length).toBe(1);
  });

  it('should floor fractional reps', async () => {
    // given
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    // when
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 12.9 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // then
    expect(createEntry.mock.calls[0][1].reps).toBe(12);
  });

  it('should clamp oversized reps to QUICK_LOG_REPS_MAX (defense-in-depth)', async () => {
    // given
    const service = TestBed.inject(QuickLogListenerService);
    service.init();
    // when
    emitMessage({ type: 'QUICK_LOG_PUSHUPS', reps: 9999 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // then
    expect(createEntry).toHaveBeenCalledTimes(1);
    expect(createEntry.mock.calls[0][1].reps).toBe(500);
  });

  it('should show a success snackbar after a successful entry', async () => {
    // given
    const service = TestBed.inject(QuickLogListenerService);
    // when
    await service.logEntry(20);
    // then
    expect(snackOpen).toHaveBeenCalled();
    const message = snackOpen.mock.calls[0][0];
    expect(message).toContain('20');
  });

  it('should show an error snackbar when createEntry fails', async () => {
    // given
    createEntry.mockReturnValue(throwError(() => new Error('boom')));
    const service = TestBed.inject(QuickLogListenerService);
    // when
    await service.logEntry(10);
    // then
    expect(snackOpen).toHaveBeenCalled();
  });

  it('Given a PushupValidationError When logEntry fails Then snack-bar shows the localized cap message', async () => {
    // given
    createEntry.mockReturnValue(
      throwError(() => new PushupValidationError('reps', 'out-of-range'))
    );
    const service = TestBed.inject(QuickLogListenerService);
    // when
    await service.logEntry(10);
    // then
    expect(snackOpen).toHaveBeenCalled();
    const message = snackOpen.mock.calls[0][0];
    expect(message).toMatch(/zwischen 1.*und 500.*liegen/);
  });

  it('Given a non-integer PushupValidationError When logEntry fails Then snack-bar surfaces the integer hint', async () => {
    // given
    createEntry.mockReturnValue(
      throwError(() => new PushupValidationError('reps', 'not-integer'))
    );
    const service = TestBed.inject(QuickLogListenerService);
    // when
    await service.logEntry(10);
    // then
    expect(snackOpen).toHaveBeenCalled();
    const message = snackOpen.mock.calls[0][0];
    expect(message).toMatch(/ganze Zahl/);
  });
});
