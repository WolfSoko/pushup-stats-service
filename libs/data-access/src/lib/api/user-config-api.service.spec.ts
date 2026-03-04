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

  it('returns default config when unauthenticated', async () => {
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
    service.getConfig('u').subscribe((r) => (result = r));

    expect(result).toEqual({ userId: 'u' });
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

  it('returns default when updating config unauthenticated', async () => {
    const firestoreFns = await import('@angular/fire/firestore');

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

    expect(result).toEqual({ userId: 'u', dailyGoal: 120 });
    expect(firestoreFns.setDoc).not.toHaveBeenCalled();
  });
});
