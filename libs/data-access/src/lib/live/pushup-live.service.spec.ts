import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { PushupLiveService } from './pushup-live.service';

vi.mock('@angular/common', async () => ({
  ...((await vi.importActual('@angular/common')) as object),
  isPlatformBrowser: vi.fn(),
}));

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

describe('PushupLiveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('does not set up listener on server platform', async () => {
    (isPlatformBrowser as any).mockReturnValue(false);
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
    (isPlatformBrowser as any).mockReturnValue(true);
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
    (isPlatformBrowser as any).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as any).mockReturnValue(userSubject.asObservable());

    let snapshotNext!: () => void;
    (firestoreMod.onSnapshot as any).mockImplementation(
      (_q: unknown, next: (...args: unknown[]) => void) => {
        snapshotNext = next;
        return vi.fn();
      }
    );

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
    (isPlatformBrowser as any).mockReturnValue(true);

    const authMod = await import('@angular/fire/auth');
    const firestoreMod = await import('@angular/fire/firestore');

    const userSubject = new BehaviorSubject<{ uid: string } | null>({
      uid: 'u1',
    });
    (authMod.authState as any).mockReturnValue(userSubject.asObservable());

    let snapshotNext!: () => void;
    (firestoreMod.onSnapshot as any).mockImplementation(
      (_q: unknown, next: (...args: unknown[]) => void) => {
        snapshotNext = next;
        return vi.fn();
      }
    );

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
