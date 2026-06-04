import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, onSnapshot } from '@angular/fire/firestore';
import { LiveDataStore } from './live-data.store';

// Mock Firebase modules to avoid fetch polyfill issues in Jest
jest.mock('@angular/fire/auth', () => ({
  Auth: class {},
  authState: jest.fn(),
}));
jest.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  collection: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));

type SnapshotCallback = (snapshot: {
  docs: { id: string; data: () => unknown }[];
}) => void;

/**
 * Captures the success callback the store passes to `onSnapshot`. Post
 * Phase-7 cutover there is a single subscription — `exerciseEntries`
 * (pushups included) — so the first captured callback is that feed.
 */
function captureExercisesCallback(): () => SnapshotCallback {
  const onNext: SnapshotCallback[] = [];
  jest
    .mocked(onSnapshot)
    .mockImplementation((_query, next: SnapshotCallback) => {
      onNext.push(next);
      return jest.fn();
    });
  return () => onNext[0];
}

describe('LiveDataStore', () => {
  describe('SSR (server platform)', () => {
    it('does not connect on server', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      const store = TestBed.inject(LiveDataStore);

      expect(store.connected()).toBe(false);
      expect(store.exerciseEntries()).toEqual([]);
      expect(store.updateTick()).toBe(0);
    });
  });

  describe('initial state', () => {
    it('starts disconnected with empty entries', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });
      const store = TestBed.inject(LiveDataStore);

      expect(store.connected()).toBe(false);
      expect(store.exerciseEntries()).toEqual([]);
      expect(store.updateTick()).toBe(0);
    });
  });

  describe('exerciseEntries loading', () => {
    it('should connect and mark loaded after the first exercise snapshot', () => {
      // given a browser-platform store wired to a signed-in user, with the
      // Firestore subscription captured but not yet fired
      jest.mocked(authState).mockReturnValue(of({ uid: 'u1' }) as never);
      const exercises = captureExercisesCallback();
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: Auth, useValue: {} },
          { provide: Firestore, useValue: {} },
        ],
      });
      const store = TestBed.inject(LiveDataStore);
      TestBed.tick();

      // then it starts unloaded — no snapshot has arrived
      expect(store.exerciseEntriesLoaded()).toBe(false);
      expect(store.connected()).toBe(false);

      // when the exerciseEntries subscription delivers its first snapshot
      exercises()({ docs: [] });

      // then both the loaded flag and the canonical liveness signal flip
      expect(store.exerciseEntriesLoaded()).toBe(true);
      expect(store.connected()).toBe(true);
    });

    it('should surface pushups (exerciseId:"pushup") on the live feed post-cutover', () => {
      // given a browser-platform store wired to a signed-in user
      jest.mocked(authState).mockReturnValue(of({ uid: 'u1' }) as never);
      const exercises = captureExercisesCallback();
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: Auth, useValue: {} },
          { provide: Firestore, useValue: {} },
        ],
      });
      const store = TestBed.inject(LiveDataStore);
      TestBed.tick();

      // when the snapshot delivers a squats entry alongside a pushup entry
      exercises()({
        docs: [
          {
            id: 'squats-1',
            data: () => ({
              userId: 'u1',
              exerciseId: 'legs.squats',
              timestamp: '2026-05-01T08:00:00.000Z',
              reps: 20,
            }),
          },
          {
            id: 'pushup-1',
            data: () => ({
              userId: 'u1',
              exerciseId: 'pushup',
              timestamp: '2026-05-01T08:00:00.000Z',
              reps: 25,
            }),
          },
        ],
      });

      // then both surface — pushups are no longer filtered out
      expect(store.exerciseEntries().map((e) => e._id)).toEqual([
        'squats-1',
        'pushup-1',
      ]);
      expect(
        store.exerciseEntries().some((e) => e.exerciseId === 'pushup')
      ).toBe(true);
      expect(store.exerciseEntriesLoaded()).toBe(true);
    });
  });

  describe('uid change', () => {
    it('should reset live mirrors when the authenticated uid changes', () => {
      // given a browser-platform store subscribed to user u1, whose
      // exerciseEntries mirror holds one of u1's entries
      const authSubject = new BehaviorSubject<{ uid: string } | null>({
        uid: 'u1',
      });
      jest.mocked(authState).mockReturnValue(authSubject as never);
      const exercises = captureExercisesCallback();
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: Auth, useValue: {} },
          { provide: Firestore, useValue: {} },
        ],
      });
      const store = TestBed.inject(LiveDataStore);
      TestBed.tick();
      exercises()({
        docs: [
          {
            id: 'squats-1',
            data: () => ({
              userId: 'u1',
              exerciseId: 'legs.squats',
              timestamp: '2026-05-01T08:00:00.000Z',
              reps: 20,
            }),
          },
        ],
      });
      expect(store.exerciseEntries()).toHaveLength(1);
      expect(store.exerciseEntriesLoaded()).toBe(true);

      // when the authenticated uid switches to u2 without a sign-out
      authSubject.next({ uid: 'u2' });
      TestBed.tick();

      // then u1's mirrors are dropped before u2's snapshots arrive
      expect(store.exerciseEntries()).toEqual([]);
      expect(store.exerciseEntriesLoaded()).toBe(false);
      expect(store.connected()).toBe(false);
    });
  });
});
