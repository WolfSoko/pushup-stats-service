import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
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
  onSnapshot: jest.fn(),
  orderBy: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
}));

describe('PushupLiveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('does not set up listener on server platform', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(false);
    const firestoreMod = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    TestBed.inject(PushupLiveService);
    TestBed.flushEffects();

    expect(firestoreMod.onSnapshot).not.toHaveBeenCalled();
  });

  it('does not set up listener when auth/firestore are not provided', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);
    const firestoreMod = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: null },
        { provide: Firestore, useValue: null },
      ],
    });
    TestBed.inject(PushupLiveService);
    TestBed.flushEffects();

    expect(firestoreMod.onSnapshot).not.toHaveBeenCalled();
  });

  it('connects and increments tick when Firestore emits data for authenticated user', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as jest.Mock).mockReturnValue(userSubject.asObservable());

    let snapshotNext!: () => void;
    (firestoreMod.onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      snapshotNext = next;
      return jest.fn();
    });

    TestBed.configureTestingModule({
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = TestBed.inject(PushupLiveService);
    TestBed.flushEffects();

    expect(service.connected()).toBe(false);
    expect(service.updateTick()).toBe(0);

    snapshotNext();
    expect(service.connected()).toBe(true);
    expect(service.updateTick()).toBe(1);

    snapshotNext();
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

    let snapshotNext!: () => void;
    (firestoreMod.onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      snapshotNext = next;
      return jest.fn();
    });

    TestBed.configureTestingModule({
      providers: [
        PushupLiveService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = TestBed.inject(PushupLiveService);
    TestBed.flushEffects();

    snapshotNext();
    expect(service.connected()).toBe(true);

    userSubject.next(null);
    TestBed.flushEffects();
    expect(service.connected()).toBe(false);
  });
});
