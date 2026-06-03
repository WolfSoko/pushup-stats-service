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
 * Captures the success callbacks the store passes to `onSnapshot` so a
 * test can drive each subscription. The store subscribes pushups first,
 * then exerciseEntries (the call order in `onInit`).
 */
function captureSnapshotCallbacks(): {
  pushups: () => SnapshotCallback;
  exercises: () => SnapshotCallback;
} {
  const onNext: SnapshotCallback[] = [];
  jest
    .mocked(onSnapshot)
    .mockImplementation((_query, next: SnapshotCallback) => {
      onNext.push(next);
      return jest.fn();
    });
  return {
    pushups: () => onNext[0],
    exercises: () => onNext[1],
  };
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
      expect(store.entries()).toEqual([]);
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
      expect(store.entries()).toEqual([]);
      expect(store.updateTick()).toBe(0);
    });
  });

  describe('exerciseEntries loading', () => {
    it('should mark exerciseEntries loaded after the first exercise snapshot', () => {
      // given a browser-platform store wired to a signed-in user, with both
      // Firestore subscriptions captured but not yet fired
      jest.mocked(authState).mockReturnValue(of({ uid: 'u1' }) as never);
      const callbacks = captureSnapshotCallbacks();
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

      // then it starts unloaded — no exercise snapshot has arrived
      expect(store.exerciseEntriesLoaded()).toBe(false);

      // when the exerciseEntries subscription delivers its first snapshot
      callbacks.exercises()({ docs: [] });

      // then the loaded flag flips, independent of the pushup stream
      expect(store.exerciseEntriesLoaded()).toBe(true);
      expect(store.connected()).toBe(false);
    });

    it('should hide staged pushup-sentinel copies from the live exerciseEntries feed', () => {
      // given a browser-platform store wired to a signed-in user, with both
      // Firestore subscriptions captured but not yet fired
      jest.mocked(authState).mockReturnValue(of({ uid: 'u1' }) as never);
      const callbacks = captureSnapshotCallbacks();
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

      // when the exerciseEntries snapshot delivers a native squats entry
      // alongside a migrated pushup-sentinel copy
      callbacks.exercises()({
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

      // then only the non-pushup entry surfaces and the feed is marked loaded
      expect(store.exerciseEntries().map((e) => e._id)).toEqual(['squats-1']);
      expect(
        store.exerciseEntries().some((e) => e.exerciseId === 'pushup')
      ).toBe(false);
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
      const callbacks = captureSnapshotCallbacks();
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
      callbacks.exercises()({
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
      expect(store.entries()).toEqual([]);
      expect(store.exerciseEntries()).toEqual([]);
      expect(store.exerciseEntriesLoaded()).toBe(false);
    });
  });
});
