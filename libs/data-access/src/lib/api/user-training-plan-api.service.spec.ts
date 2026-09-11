import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import * as firestoreFns from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { UserTrainingPlan } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { Observable, of } from 'rxjs';
import { UserTrainingPlanApiService } from './user-training-plan-api.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(),
  docData: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  runTransaction: jest.fn(),
  arrayUnion: jest.fn((...values: unknown[]) => ({
    __type: 'arrayUnion',
    values,
  })),
  arrayRemove: jest.fn((...values: unknown[]) => ({
    __type: 'arrayRemove',
    values,
  })),
  deleteField: jest.fn(() => ({ __type: 'deleteField' })),
}));

describe('UserTrainingPlanApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('streams the active plan from Firestore', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(
      of({
        userId: 'u',
        planId: 'challenge-30d-v1',
        startDate: '2026-04-01',
        status: 'active',
        completedDays: [1, 2],
      } satisfies UserTrainingPlan)
    );

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    let result: UserTrainingPlan | null | undefined;
    service.getActivePlan('u').subscribe((r) => (result = r));

    await Promise.resolve();
    expect(result?.planId).toBe('challenge-30d-v1');
  });

  it('returns null when the doc does not exist', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(of(undefined));

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    let result: UserTrainingPlan | null | undefined;
    service.getActivePlan('u').subscribe((r) => (result = r));

    await Promise.resolve();
    expect(result).toBeNull();
  });

  it('uses the auth uid (not the passed-in userId) for the doc path', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'real' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(of(undefined));

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'real' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    service.getActivePlan('forged').subscribe();

    await Promise.resolve();
    expect(firestoreFns.doc).toHaveBeenCalledWith(
      expect.anything(),
      'userTrainingPlans',
      'real'
    );
  });

  it('writes a new active plan via setPlan (overwrites stale state)', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    let result: UserTrainingPlan | undefined;
    service
      .setPlan('u', {
        planId: 'challenge-30d-v1',
        startDate: '2026-05-01',
        status: 'active',
        completedDays: [],
      })
      .subscribe((r) => (result = r));

    await Promise.resolve();
    expect(firestoreFns.setDoc).toHaveBeenCalled();
    expect(result?.planId).toBe('challenge-30d-v1');
    expect(result?.userId).toBe('u');
    // Stamped so entries logged before this activation can't leak into
    // whichever day now resolves to today's date.
    expect(result?.dayActivatedAt).toEqual(expect.any(String));
    expect(new Date(result?.dayActivatedAt as string).getTime()).not.toBeNaN();
  });

  it('merges patches via updatePlan', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    service.updatePlan('u', { completedDays: [1, 2, 3] }).subscribe();

    await Promise.resolve();
    expect(firestoreFns.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        completedDays: [1, 2, 3],
        userId: 'u',
      }),
      { merge: true }
    );
  });

  it('uses arrayUnion for addCompletedDay so concurrent writes merge atomically', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    service.addCompletedDay('u', 5).subscribe();

    await Promise.resolve();
    expect(firestoreFns.arrayUnion).toHaveBeenCalledWith(5);
    expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        completedDays: expect.objectContaining({ __type: 'arrayUnion' }),
      })
    );
  });

  it('addCompletedDay also clears the same day from skippedDays atomically', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    service.addCompletedDay('u', 5).subscribe();

    await Promise.resolve();
    expect(firestoreFns.arrayUnion).toHaveBeenCalledWith(5);
    expect(firestoreFns.arrayRemove).toHaveBeenCalledWith(5);
    expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        completedDays: expect.objectContaining({ __type: 'arrayUnion' }),
        skippedDays: expect.objectContaining({ __type: 'arrayRemove' }),
      })
    );
  });

  it('addSkippedDay adds to skippedDays and removes from completedDays atomically', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    service.addSkippedDay('u', 7).subscribe();

    await Promise.resolve();
    expect(firestoreFns.arrayUnion).toHaveBeenCalledWith(7);
    expect(firestoreFns.arrayRemove).toHaveBeenCalledWith(7);
    expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skippedDays: expect.objectContaining({ __type: 'arrayUnion' }),
        completedDays: expect.objectContaining({ __type: 'arrayRemove' }),
      })
    );
  });

  it('jumpToDay reads completedDays/skippedDays inside a transaction and rewrites both fields atomically', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    // Capture the transaction body so we can run it against a fake
    // snapshot and inspect the resulting tx.update payload.
    let capturedUpdate: Record<string, unknown> | null = null;
    (firestoreFns.runTransaction as jest.Mock).mockImplementation(
      async (_fs: unknown, body: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: async () => ({
            // Fresh server state: a concurrent skip(7) landed before the
            // transaction reads, plus prior completion of day 10.
            data: () => ({
              completedDays: [10],
              skippedDays: [7],
            }),
          }),
          update: (_ref: unknown, payload: Record<string, unknown>) => {
            capturedUpdate = payload;
          },
        };
        await body(tx);
      }
    );

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    // Jump to day 8 in a 30-day plan; non-rest days < 8 are 1..6 (7 is
    // a rest day, omitted by caller).
    await new Promise<void>((resolve, reject) =>
      service
        .jumpToDay('u', {
          newStartDate: '2026-04-15',
          targetDayIndex: 8,
          nonRestDaysBeforeTarget: [1, 2, 3, 4, 5, 6],
        })
        .subscribe({ next: () => resolve(), error: reject })
    );

    expect(firestoreFns.runTransaction).toHaveBeenCalled();
    expect(capturedUpdate).not.toBeNull();
    const payload = capturedUpdate as Record<string, unknown>;
    expect(payload['startDate']).toBe('2026-04-15');
    // Re-anchoring can hand today's date to a different day index, so the
    // jump stamps a fresh activation instant too.
    expect(typeof payload['dayActivatedAt']).toBe('string');
    expect(
      new Date(payload['dayActivatedAt'] as string).getTime()
    ).not.toBeNaN();
    // Day 10 stays completed (preserved server-side); day 7 was the
    // concurrent skip — it's NOT in nonRestDaysBeforeTarget but IS in
    // priorSkipped, so it should be preserved as well. Days 1..6 sans
    // 10 are bulk-skipped.
    expect(payload['skippedDays']).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('pausePlan freezes the day without moving the start date', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    service.pausePlan('u', 7).subscribe();

    await Promise.resolve();
    const patch = (firestoreFns.updateDoc as jest.Mock).mock.calls[0][1];
    expect(patch.status).toBe('paused');
    expect(patch.pausedDayIndex).toBe(7);
    expect(patch.pausedAt).toEqual(expect.any(String));
    expect(patch.startDate).toBeUndefined();
  });

  it('resumePlan re-anchors the schedule and deletes the pause marks', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    service.resumePlan('u', '2026-10-01').subscribe();

    await Promise.resolve();
    const patch = (firestoreFns.updateDoc as jest.Mock).mock.calls[0][1];
    expect(patch.status).toBe('active');
    expect(patch.startDate).toBe('2026-10-01');
    // Deleted, not zeroed — a leftover mark reads as a still-paused plan.
    expect(patch.pausedAt).toEqual({ __type: 'deleteField' });
    expect(patch.pausedDayIndex).toEqual({ __type: 'deleteField' });
    expect(patch.dayActivatedAt).toEqual(expect.any(String));
  });

  it('resumePlan leaves the schedule alone without a new start date', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    service.resumePlan('u', null).subscribe();

    await Promise.resolve();
    const patch = (firestoreFns.updateDoc as jest.Mock).mock.calls[0][1];
    expect(patch.status).toBe('active');
    expect(patch.startDate).toBeUndefined();
  });

  it('removeSkippedDay uses arrayRemove on skippedDays', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    service.removeSkippedDay('u', 3).subscribe();

    await Promise.resolve();
    expect(firestoreFns.arrayRemove).toHaveBeenCalledWith(3);
    expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skippedDays: expect.objectContaining({ __type: 'arrayRemove' }),
      })
    );
  });

  it('uses arrayRemove for removeCompletedDay', async () => {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    service.removeCompletedDay('u', 2).subscribe();

    await Promise.resolve();
    expect(firestoreFns.arrayRemove).toHaveBeenCalledWith(2);
    expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        completedDays: expect.objectContaining({ __type: 'arrayRemove' }),
      })
    );
  });
  it('should add per-exercise check-offs via arrayUnion', async () => {
    // given
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });
    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    // when
    service.addCompletedItems('u', ['5:0', '5:1']).subscribe();

    // then
    await Promise.resolve();
    expect(firestoreFns.arrayUnion).toHaveBeenCalledWith('5:0', '5:1');
    expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        completedItems: expect.objectContaining({ __type: 'arrayUnion' }),
      })
    );
  });

  it('should remove per-exercise check-offs via arrayRemove', async () => {
    // given
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });
    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    // when
    service.removeCompletedItems('u', ['5:0']).subscribe();

    // then
    await Promise.resolve();
    expect(firestoreFns.arrayRemove).toHaveBeenCalledWith('5:0');
    expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        completedItems: expect.objectContaining({ __type: 'arrayRemove' }),
      })
    );
  });

  it('should skip the write when no item ids are given', async () => {
    // given
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });
    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );

    // when
    service.addCompletedItems('u', []).subscribe();
    service.removeCompletedItems('u', []).subscribe();

    // then
    await Promise.resolve();
    expect(firestoreFns.updateDoc).not.toHaveBeenCalled();
  });

  /** Runs a transaction-backed call against fake server state and returns
   *  the payload the service handed to `tx.update`. */
  async function captureTestResultWrite(
    serverState: Record<string, unknown>,
    call: (service: UserTrainingPlanApiService) => Observable<void>
  ): Promise<Record<string, unknown>> {
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    let captured: Record<string, unknown> | null = null;
    (firestoreFns.runTransaction as jest.Mock).mockImplementation(
      async (_fs: unknown, body: (tx: unknown) => Promise<void>) => {
        await body({
          get: async () => ({ data: () => serverState }),
          update: (_ref: unknown, payload: Record<string, unknown>) => {
            captured = payload;
          },
        });
      }
    );

    const { fixture } = await render('', {
      providers: [
        UserTrainingPlanApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });
    const service = fixture.debugElement.injector.get(
      UserTrainingPlanApiService
    );
    await new Promise<void>((resolve, reject) =>
      call(service).subscribe({ next: () => resolve(), error: reject })
    );
    expect(captured).not.toBeNull();
    return captured as unknown as Record<string, unknown>;
  }

  it('should record a measured value alongside the day other measurements', async () => {
    // given a baseline whose plank hold is already recorded
    const payload = await captureTestResultWrite(
      { testResults: ['1:0:45'] },
      (service) => service.setTestResult('u', 1, 1, 12)
    );

    // then the pushup value joins it instead of replacing the array
    expect(payload['testResults']).toEqual(['1:0:45', '1:1:12']);
  });

  it('should replace a revised value without touching the day other fields', async () => {
    // given all three fields of a Core Foundations baseline recorded
    const payload = await captureTestResultWrite(
      { testResults: ['1:0:45', '1:1:12', '1:2:30'] },
      (service) => service.setTestResult('u', 1, 1, 15)
    );

    // then only the pushup field is rewritten — `arrayUnion` alone would
    // leave both values behind, and Firestore allows one transform per field
    expect(payload['testResults']).toEqual(['1:0:45', '1:2:30', '1:1:15']);
  });

  it('should drop only the requested field when a value is discarded', async () => {
    // given a three-value baseline
    const payload = await captureTestResultWrite(
      { testResults: ['1:0:45', '1:1:12', '1:2:30'] },
      (service) => service.removeTestResult('u', 1, 1)
    );

    // then the plank and hollow values survive
    expect(payload['testResults']).toEqual(['1:0:45', '1:2:30']);
  });

  it('should keep another day results when one day field is rewritten', async () => {
    // given values for both the opening and the closing test
    const payload = await captureTestResultWrite(
      { testResults: ['1:0:45', '28:0:60'] },
      (service) => service.setTestResult('u', 1, 0, 50)
    );

    // then the closing test is untouched
    expect(payload['testResults']).toEqual(['28:0:60', '1:0:50']);
  });

  it('should replace a legacy single-value entry rather than duplicating it', async () => {
    // given a doc written before test days could measure several things
    const payload = await captureTestResultWrite(
      { testResults: ['1:37'] },
      (service) => service.setTestResult('u', 1, 0, 40)
    );

    // then it resolves to field 0 and is superseded, not stacked on
    expect(payload['testResults']).toEqual(['1:0:40']);
  });

  it('should record the first value on a doc that has none', async () => {
    const payload = await captureTestResultWrite({}, (service) =>
      service.setTestResult('u', 1, 0, 20)
    );
    expect(payload['testResults']).toEqual(['1:0:20']);
  });
});
