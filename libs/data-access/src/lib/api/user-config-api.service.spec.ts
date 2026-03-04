import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { UserConfigApiService } from './user-config-api.service';

jest.mock('@angular/common', () => ({
  ...jest.requireActual('@angular/common'),
  isPlatformServer: jest.fn(),
}));

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
  let httpMock: { get: jest.Mock; put: jest.Mock };

  beforeEach(() => {
    httpMock = {
      get: jest.fn(),
      put: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('reads config from Firestore when authenticated in browser', async () => {
    const common = await import('@angular/common');
    const firestoreFns = await import('@angular/fire/firestore');
    (common.isPlatformServer as jest.Mock).mockReturnValue(false);
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });
    (firestoreFns.getDoc as jest.Mock).mockResolvedValue({
      data: () => ({ userId: 'u', dailyGoal: 99 }),
    });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
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
    expect(httpMock.get).not.toHaveBeenCalled();
  });

  it('uses currentUser.uid (not passed-in userId) for Firestore getConfig doc path', async () => {
    const common = await import('@angular/common');
    const firestoreFns = await import('@angular/fire/firestore');
    (common.isPlatformServer as jest.Mock).mockReturnValue(false);
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'actual-uid' });
    (firestoreFns.getDoc as jest.Mock).mockResolvedValue({
      data: () => undefined,
    });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
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
    const common = await import('@angular/common');
    const firestoreFns = await import('@angular/fire/firestore');
    (common.isPlatformServer as jest.Mock).mockReturnValue(false);
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'actual-uid' });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
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

  it('reads config from HTTP when unauthenticated in browser', async () => {
    const common = await import('@angular/common');
    (common.isPlatformServer as jest.Mock).mockReturnValue(false);

    const config: UserConfig = { userId: 'u', dailyGoal: 55 };
    httpMock.get.mockReturnValue(of(config));

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: null } },
      ],
    });

    const service = fixture.debugElement.injector.get(UserConfigApiService);
    let result: UserConfig | undefined;
    service.getConfig('u').subscribe((r) => (result = r));

    expect(result).toEqual(config);
    expect(httpMock.get).toHaveBeenCalledWith('/api/users/u/config');
  });

  it('updates config in Firestore when authenticated in browser', async () => {
    const common = await import('@angular/common');
    const firestoreFns = await import('@angular/fire/firestore');
    (common.isPlatformServer as jest.Mock).mockReturnValue(false);
    (firestoreFns.doc as jest.Mock).mockReturnValue({ id: 'u' });

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
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
    expect(httpMock.put).not.toHaveBeenCalled();
  });

  it('updates config via HTTP when unauthenticated in browser', async () => {
    const common = await import('@angular/common');
    const firestoreFns = await import('@angular/fire/firestore');
    (common.isPlatformServer as jest.Mock).mockReturnValue(false);

    const updated: UserConfig = { userId: 'u', dailyGoal: 120 };
    httpMock.put.mockReturnValue(of(updated));

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
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

    expect(result).toEqual(updated);
    expect(httpMock.put).toHaveBeenCalledWith('/api/users/u/config', {
      dailyGoal: 120,
    });
    expect(firestoreFns.setDoc).not.toHaveBeenCalled();
  });

  it('uses HTTP on server', async () => {
    const common = await import('@angular/common');
    (common.isPlatformServer as jest.Mock).mockReturnValue(true);

    const config: UserConfig = { userId: 'u', dailyGoal: 80 };
    httpMock.get.mockReturnValue(of(config));
    httpMock.put.mockReturnValue(of({ userId: 'u', dailyGoal: 90 }));

    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Firestore, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u' } } },
      ],
    });

    const service = fixture.debugElement.injector.get(UserConfigApiService);

    let getResult: UserConfig | undefined;
    service.getConfig('u').subscribe((r) => (getResult = r));
    expect(getResult).toEqual(config);

    let putResult: UserConfig | undefined;
    service
      .updateConfig('u', { dailyGoal: 90 } as UserConfigUpdate)
      .subscribe((r) => (putResult = r));
    expect(putResult).toEqual({ userId: 'u', dailyGoal: 90 });

    expect(httpMock.get).toHaveBeenCalled();
    expect(httpMock.put).toHaveBeenCalled();
  });
});
