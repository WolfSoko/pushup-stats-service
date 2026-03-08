import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { UserConfigApiService } from './user-config-api.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
}));

describe('UserConfigApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads config from Firestore when authenticated', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    (firestoreFns.getDoc as jest.Mock).mockResolvedValue({
      data: () => ({ userId: 'u', dailyGoal: 99 }),
    });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(UserConfigApiService);
    let result: UserConfig | undefined;
    service.getConfig('u').subscribe((r) => (result = r));

    await Promise.resolve();
    expect(result).toEqual({ userId: 'u', dailyGoal: 99 });
  });

  it('uses currentUser.uid (not passed-in userId) for Firestore getConfig doc path', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'actual-uid' });
    (firestoreFns.getDoc as jest.Mock).mockResolvedValue({
      data: () => undefined,
    });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'actual-uid' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(UserConfigApiService);
    service.getConfig('different-id').subscribe();

    await Promise.resolve();
    expect(firestoreFns.doc).toHaveBeenCalledWith(
      expect.anything(),
      'userConfigs',
      'actual-uid'
    );
  });

  it('uses currentUser.uid (not passed-in userId) for Firestore updateConfig doc path', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'actual-uid' });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'actual-uid' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(UserConfigApiService);
    service
      .updateConfig('different-id', { dailyGoal: 5 } as UserConfigUpdate)
      .subscribe();

    await Promise.resolve();
    expect(firestoreFns.doc).toHaveBeenCalledWith(
      expect.anything(),
      'userConfigs',
      'actual-uid'
    );
    expect(firestoreFns.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { dailyGoal: 5, userId: 'actual-uid' },
      { merge: true }
    );
  });

  it('updates config in Firestore when authenticated', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(UserConfigApiService);
    let result: UserConfig | undefined;
    service
      .updateConfig('u', { dailyGoal: 120 } as UserConfigUpdate)
      .subscribe((r) => (result = r));

    await Promise.resolve();
    expect(firestoreFns.setDoc).toHaveBeenCalledWith(
      { id: 'u' },
      { userId: 'u', dailyGoal: 120 },
      { merge: true }
    );
    expect(result).toEqual({ userId: 'u', dailyGoal: 120 });
  });

  it('returns undefined when updating config unauthenticated', async () => {
    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: null } },
      ],
    });

    const service = fixture.debugElement.injector.get(UserConfigApiService);
    let result: UserConfig | undefined;
    service
      .updateConfig('u', { dailyGoal: 120 } as UserConfigUpdate)
      .subscribe((r) => (result = r));

    expect(result).toBeUndefined();
  });
});
