import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { PushupRecord } from '@pu-stats/models';
import { BehaviorSubject } from 'rxjs';
import { PushupLiveDataService } from './pushup-live-data.service';

vi.mock('@angular/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/common')>();
  return { ...actual, isPlatformBrowser: vi.fn() };
});

vi.mock('@angular/fire/auth', () => ({
  Auth: vi.fn(),
  authState: vi.fn(),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: vi.fn(),
  collection: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
}));

type FakeSnapshot = {
  docs: Array<{ id: string; data: () => Record<string, unknown> }>;
};

describe('PushupLiveDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('does not set up listener on server platform', async () => {
    (isPlatformBrowser as any).mockReturnValue(false);
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
    (isPlatformBrowser as any).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as any).mockReturnValue(userSubject.asObservable());

    let snapshotNext!: (s: FakeSnapshot) => void;
    (firestoreMod.onSnapshot as any).mockImplementation(
      (_q: unknown, next: (...args: unknown[]) => void) => {
        snapshotNext = next;
        return vi.fn();
      }
    );

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
    (isPlatformBrowser as any).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as any).mockReturnValue(userSubject.asObservable());

    let snapshotNext!: (s: FakeSnapshot) => void;
    (firestoreMod.onSnapshot as any).mockImplementation(
      (_q: unknown, next: (...args: unknown[]) => void) => {
        snapshotNext = next;
        return vi.fn();
      }
    );

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
      docs: [
        { id: '1', data: () => ({ timestamp: 't', reps: 1, source: 's' }) },
      ],
    });
    expect(service.connected()).toBe(true);
    expect(service.entries().length).toBe(1);

    userSubject.next(null);
    TestBed.flushEffects();
    expect(service.connected()).toBe(false);
    expect(service.entries()).toEqual([]);
  });
});
