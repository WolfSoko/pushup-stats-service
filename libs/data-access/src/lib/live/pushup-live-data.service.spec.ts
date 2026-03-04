import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { PushupRecord } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { BehaviorSubject, Subject } from 'rxjs';
import { PushupLiveDataService } from './pushup-live-data.service';

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

describe('PushupLiveDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not subscribe on server platform', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(false);
    const authMod = await import('@angular/fire/auth');
    await render('', {
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    expect(authMod.authState).not.toHaveBeenCalled();
  });

  it('delivers entries from Firestore for authenticated user', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as jest.Mock).mockReturnValue(userSubject.asObservable());

    const dataSubject = new Subject<PushupRecord[]>();
    (firestoreMod.collectionData as jest.Mock).mockReturnValue(
      dataSubject.asObservable()
    );

    const { fixture } = await render('', {
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = fixture.debugElement.injector.get(PushupLiveDataService);

    expect(service.connected()).toBe(false);
    expect(service.entries()).toEqual([]);

    const records: PushupRecord[] = [
      { _id: '1', timestamp: 't', reps: 1, source: 's' },
    ];
    dataSubject.next(records);
    expect(service.connected()).toBe(true);
    expect(service.entries()).toEqual(records);

    const records2: PushupRecord[] = [
      { _id: '2', timestamp: 't2', reps: 2, source: 's2' },
    ];
    dataSubject.next(records2);
    expect(service.entries()).toEqual(records2);
  });

  it('clears entries and disconnects when user signs out', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as jest.Mock).mockReturnValue(userSubject.asObservable());

    const dataSubject = new Subject<PushupRecord[]>();
    (firestoreMod.collectionData as jest.Mock).mockReturnValue(
      dataSubject.asObservable()
    );

    const { fixture } = await render('', {
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = fixture.debugElement.injector.get(PushupLiveDataService);

    dataSubject.next([{ _id: '1', timestamp: 't', reps: 1, source: 's' }]);
    expect(service.connected()).toBe(true);
    expect(service.entries().length).toBe(1);

    userSubject.next(null);
    expect(service.connected()).toBe(false);
    expect(service.entries()).toEqual([]);
  });
});
