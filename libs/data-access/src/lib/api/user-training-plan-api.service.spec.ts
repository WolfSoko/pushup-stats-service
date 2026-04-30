import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { UserTrainingPlan } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { UserTrainingPlanApiService } from './user-training-plan-api.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(),
  docData: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
}));

describe('UserTrainingPlanApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('streams the active plan from Firestore', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
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
    const firestoreFns = await import('@angular/fire/firestore');
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
    const firestoreFns = await import('@angular/fire/firestore');
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
    const firestoreFns = await import('@angular/fire/firestore');
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
  });

  it('merges patches via updatePlan', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
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
});
