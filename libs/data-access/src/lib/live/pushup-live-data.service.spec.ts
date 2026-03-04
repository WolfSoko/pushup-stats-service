import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { PushupRecord } from '@pu-stats/models';
import { BehaviorSubject } from 'rxjs';
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
  onSnapshot: jest.fn(),
  orderBy: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
}));

type FakeSnapshot = { docs: Array<{ id: string; data: () => Record<string, unknown> }> };

describe('PushupLiveDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('does not set up listener on server platform', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(false);
    const firestoreMod = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    TestBed.inject(PushupLiveDataService);
    TestBed.flushEffects();

    expect(firestoreMod.onSnapshot).not.toHaveBeenCalled();
  });

  it('delivers entries from Firestore for authenticated user', async () => {
    (isPlatformBrowser as jest.Mock).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as jest.Mock).mockReturnValue(userSubject.asObservable());

    let snapshotNext!: (s: FakeSnapshot) => void;
    (firestoreMod.onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      snapshotNext = next;
      return jest.fn();
    });

    TestBed.configureTestingModule({
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = TestBed.inject(PushupLiveDataService);
    TestBed.flushEffects();

    expect(service.connected()).toBe(false);
    expect(service.entries()).toEqual([]);

    const records: PushupRecord[] = [
      { _id: '1', timestamp: 't', reps: 1, source: 's' },
    ];
    snapshotNext({
      docs: records.map((r) => ({ id: r._id!, data: () => ({ ...r }) })),
    });
    expect(service.connected()).toBe(true);
    expect(service.entries()).toEqual(records);

    const records2: PushupRecord[] = [
      { _id: '2', timestamp: 't2', reps: 2, source: 's2' },
    ];
    snapshotNext({
      docs: records2.map((r) => ({ id: r._id!, data: () => ({ ...r }) })),
    });
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

    let snapshotNext!: (s: FakeSnapshot) => void;
    (firestoreMod.onSnapshot as jest.Mock).mockImplementation((_q, next) => {
      snapshotNext = next;
      return jest.fn();
    });

    TestBed.configureTestingModule({
      providers: [
        PushupLiveDataService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
      ],
    });
    const service = TestBed.inject(PushupLiveDataService);
    TestBed.flushEffects();

    snapshotNext({
      docs: [{ id: '1', data: () => ({ timestamp: 't', reps: 1, source: 's' }) }],
    });
    expect(service.connected()).toBe(true);
    expect(service.entries().length).toBe(1);

    userSubject.next(null);
    TestBed.flushEffects();
    expect(service.connected()).toBe(false);
    expect(service.entries()).toEqual([]);
  });
});
