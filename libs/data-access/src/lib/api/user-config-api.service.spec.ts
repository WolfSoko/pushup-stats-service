import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { UserConfigApiService } from './user-config-api.service';
import { PendingRequestsService } from '../pending-requests.service';

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  doc: jest.fn(),
  docData: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
}));

describe('UserConfigApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('streams config from Firestore in real time when authenticated', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(
      of({ userId: 'u', dailyGoal: 99 })
    );

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

  it('falls back to a stub config when the Firestore doc is missing', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(of(undefined));

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
    expect(result).toEqual({ userId: 'u' });
  });

  it('uses currentUser.uid (not passed-in userId) for Firestore getConfig doc path', async () => {
    const firestoreFns = await import('@angular/fire/firestore');
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'actual-uid' });
    (firestoreFns.docData as jest.Mock).mockReturnValue(of(undefined));

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

    await new Promise<void>((resolve) => setTimeout(resolve));
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

  describe('pending-request tracking', () => {
    async function setupTracking(): Promise<{
      service: UserConfigApiService;
      track: jest.SpyInstance;
    }> {
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
      const injector = fixture.debugElement.injector;
      return {
        service: injector.get(UserConfigApiService),
        track: jest.spyOn(injector.get(PendingRequestsService), 'track'),
      };
    }

    it('should track updateConfig as a pending request', async () => {
      // given
      const { service, track } = await setupTracking();

      // when
      service
        .updateConfig('u', { dailyGoal: 120 } as UserConfigUpdate)
        .subscribe();
      await Promise.resolve();

      // then
      expect(track).toHaveBeenCalledTimes(1);
    });

    it('should track setConfig as a pending request', async () => {
      // given
      const { service, track } = await setupTracking();

      // when
      await service.setConfig('u', {
        userId: 'u',
        dailyGoal: 50,
      } as UserConfig);

      // then
      expect(track).toHaveBeenCalledTimes(1);
    });
  });
});
