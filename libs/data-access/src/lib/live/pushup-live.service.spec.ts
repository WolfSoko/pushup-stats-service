import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { render } from '@testing-library/angular';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { PushupLiveService } from './pushup-live.service';

jest.mock('@angular/common', () => ({
  ...jest.requireActual('@angular/common'),
  isPlatformBrowser: jest.fn(),
}));

jest.mock('@angular/fire/auth', () => ({
  Auth: jest.fn(),
  authState: jest.fn(),
}));

jest.mock('@angular/fire/firestore', () => ({
  Firestore: jest.fn(),
  collection: jest.fn(() => ({})),
  collectionData: jest.fn(),
  orderBy: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
}));

describe('PushupLiveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not subscribe on server platform', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(false);
    const authMod = await import('@angular/fire/auth');
    await render('', {
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    expect(authMod.authState).not.toHaveBeenCalled();
  });

  it('does not subscribe when auth/firestore are not provided', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);
    const authMod = await import('@angular/fire/auth');
    await render('', {
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: null },
        { provide: Firestore, useValue: null },
      ],
    });
    expect(authMod.authState).not.toHaveBeenCalled();
  });

  it('connects and increments tick when Firestore emits data for authenticated user', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as jest.Mock).mockReturnValue(userSubject.asObservable());

    const dataSubject = new Subject<unknown[]>();
    (firestoreMod.collectionData as jest.Mock).mockReturnValue(
      dataSubject.asObservable()
    );

    const { fixture } = await render('', {
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = fixture.debugElement.injector.get(PushupLiveService);

    expect(service.connected()).toBe(false);
    expect(service.updateTick()).toBe(0);

    dataSubject.next([]);
    expect(service.connected()).toBe(true);
    expect(service.updateTick()).toBe(1);

    dataSubject.next([{}]);
    expect(service.updateTick()).toBe(2);
  });

  it('disconnects when user signs out', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as jest.Mock).mockReturnValue(userSubject.asObservable());

    const dataSubject = new Subject<unknown[]>();
    (firestoreMod.collectionData as jest.Mock).mockReturnValue(
      dataSubject.asObservable()
    );

    const { fixture } = await render('', {
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = fixture.debugElement.injector.get(PushupLiveService);

    dataSubject.next([]);
    expect(service.connected()).toBe(true);

    userSubject.next(null);
    expect(service.connected()).toBe(false);
  });
});
