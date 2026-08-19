import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ExerciseFirestoreService,
  PushupValidationError,
} from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import { of, throwError } from 'rxjs';
import { QuickLogService } from './quick-log.service';

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock('@angular/fire/auth', () => ({ Auth: jest.fn() }));

describe('QuickLogService', () => {
  let createEntry: jest.Mock;
  let snackOpen: jest.Mock;
  let userId: string;

  function setup(): QuickLogService {
    return TestBed.inject(QuickLogService);
  }

  beforeEach(() => {
    createEntry = jest.fn().mockReturnValue(of({ _id: 'new-entry' }));
    snackOpen = jest.fn();
    userId = 'test-uid';

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ExerciseFirestoreService, useValue: { createEntry } },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => userId },
        },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ],
    });
  });

  it('should create a pushup entry attributed to the reminder', async () => {
    // given a claimed quick-log intent
    const service = setup();

    // when
    const ok = await service.logEntry(15);

    // then
    expect(ok).toBe(true);
    expect(createEntry).toHaveBeenCalledTimes(1);
    const [uid, payload] = createEntry.mock.calls[0];
    expect(uid).toBe('test-uid');
    expect(payload.exerciseId).toBe('pushup');
    expect(payload.reps).toBe(15);
    expect(payload.sets).toEqual([15]);
    expect(payload.source).toBe('reminder');
    // Pushups carry no variant post-cutover, so no variantId is sent.
    expect(payload.variantId).toBeUndefined();
    expect(typeof payload.timestamp).toBe('string');
  });

  it('should ignore non-positive or non-finite reps', async () => {
    // given
    const service = setup();

    // when
    const results = await Promise.all([
      service.logEntry(0),
      service.logEntry(-3),
      service.logEntry(Number.POSITIVE_INFINITY),
      service.logEntry(NaN),
    ]);

    // then
    expect(results).toEqual([false, false, false, false]);
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('should floor fractional reps', async () => {
    // given
    const service = setup();

    // when
    await service.logEntry(12.9);

    // then
    expect(createEntry.mock.calls[0][1].reps).toBe(12);
  });

  it('should clamp oversized reps to QUICK_LOG_REPS_MAX (defense-in-depth)', async () => {
    // given a count that survived a stale payload
    const service = setup();

    // when
    await service.logEntry(9999);

    // then
    expect(createEntry).toHaveBeenCalledTimes(1);
    expect(createEntry.mock.calls[0][1].reps).toBe(500);
  });

  it('should report failure and skip the write when nobody is signed in', async () => {
    // given a drain that ran before auth settled
    userId = '';
    const service = setup();

    // when
    const ok = await service.logEntry(20);

    // then the SW learns it must bring a window up for the message
    expect(ok).toBe(false);
    expect(createEntry).not.toHaveBeenCalled();
    expect(snackOpen).toHaveBeenCalled();
  });

  it('should show a success snackbar after a successful entry', async () => {
    // given
    const service = setup();

    // when
    await service.logEntry(20);

    // then
    expect(snackOpen).toHaveBeenCalled();
    expect(snackOpen.mock.calls[0][0]).toContain('20');
  });

  it('should report failure when createEntry fails', async () => {
    // given
    createEntry.mockReturnValue(throwError(() => new Error('boom')));
    const service = setup();

    // when
    const ok = await service.logEntry(10);

    // then
    expect(ok).toBe(false);
    expect(snackOpen).toHaveBeenCalled();
  });

  it('should surface the localized cap message for a range validation error', async () => {
    // given
    createEntry.mockReturnValue(
      throwError(() => new PushupValidationError('reps', 'out-of-range'))
    );
    const service = setup();

    // when
    await service.logEntry(10);

    // then
    expect(snackOpen.mock.calls[0][0]).toMatch(/zwischen 1.*und 500.*liegen/);
  });

  it('should surface the integer hint for a non-integer validation error', async () => {
    // given
    createEntry.mockReturnValue(
      throwError(() => new PushupValidationError('reps', 'not-integer'))
    );
    const service = setup();

    // when
    await service.logEntry(10);

    // then
    expect(snackOpen.mock.calls[0][0]).toMatch(/ganze Zahl/);
  });
});
