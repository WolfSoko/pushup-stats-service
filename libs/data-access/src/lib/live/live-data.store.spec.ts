import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { LiveDataStore } from './live-data.store';

// Mock Firebase modules to avoid fetch polyfill issues in Jest
jest.mock('@angular/fire/auth', () => ({
  Auth: class {},
  authState: jest.fn(),
}));
jest.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  collection: jest.fn((_, name: string) => ({ _collectionName: name })),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
}));

describe('LiveDataStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

    it('exposes exerciseEntries signal that starts empty on server', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      const store = TestBed.inject(LiveDataStore);

      expect(store.exerciseEntries()).toEqual([]);
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

    it('exposes exerciseEntries signal that starts empty in the browser', () => {
      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
        ],
      });
      const store = TestBed.inject(LiveDataStore);

      expect(store.exerciseEntries()).toEqual([]);
    });
  });

  describe('exerciseEntries snapshot handling', () => {
    /**
     * Sets up a browser-mode LiveDataStore with mocked auth that emits
     * a fake user. Returns the captured snapshot callbacks for both
     * Firestore subscriptions so individual tests can trigger them.
     */
    function setupBrowserStore(): {
      store: InstanceType<typeof LiveDataStore>;
      firePushupSnapshot: (docs: unknown[]) => void;
      firePushupError: () => void;
      fireExerciseSnapshot: (docs: unknown[]) => void;
    } {
      const { Auth, authState } = jest.requireMock('@angular/fire/auth');
      const { onSnapshot } =
        jest.requireMock('@angular/fire/firestore');

      const mockUser = { uid: 'u1' };
      // authState is used via toSignal → return an Observable-like object
      authState.mockReturnValue({
        subscribe: (cb: (v: unknown) => void) => {
          cb(mockUser);
          return { unsubscribe: jest.fn() };
        },
      });

      // Capture callbacks in order: pushups subscription is registered
      // first, exerciseEntries second (follows source code declaration order).
      const callbacks: Array<{
        query: { _collectionName?: string };
        success: (snap: unknown) => void;
        error?: () => void;
      }> = [];

      onSnapshot.mockImplementation(
        (
          query: { _collectionName?: string },
          success: (snap: unknown) => void,
          error?: () => void
        ) => {
          callbacks.push({ query, success, error });
          return jest.fn(); // unsub
        }
      );

      TestBed.configureTestingModule({
        providers: [
          LiveDataStore,
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: Auth, useValue: new Auth() },
        ],
      });
      const store = TestBed.inject(LiveDataStore);
      TestBed.flushEffects();

      const makeSnapshot = (docs: unknown[]) => ({ docs });

      // Determine pushup vs exercise by collectionName or fall back to order
      const pushupCb = callbacks.find(
        (c) => c.query._collectionName === 'pushups'
      );
      const exerciseCb = callbacks.find(
        (c) => c.query._collectionName === 'exerciseEntries'
      );

      return {
        store,
        firePushupSnapshot: (docs) =>
          pushupCb?.success(makeSnapshot(docs)),
        firePushupError: () => pushupCb?.error?.(),
        fireExerciseSnapshot: (docs) =>
          exerciseCb?.success(makeSnapshot(docs)),
      };
    }

    it('updates exerciseEntries when an exerciseEntries snapshot arrives', () => {
      const { store, fireExerciseSnapshot } = setupBrowserStore();

      fireExerciseSnapshot([
        {
          id: 'e1',
          data: () => ({
            userId: 'u1',
            exerciseId: 'abs.situps',
            timestamp: '2026-04-15T10:00:00Z',
            reps: 30,
            source: 'web',
          }),
        },
      ]);

      const exerciseEntries = store.exerciseEntries();
      expect(exerciseEntries).toHaveLength(1);
      expect(exerciseEntries[0]).toMatchObject({
        _id: 'e1',
        exerciseId: 'abs.situps',
        reps: 30,
      });
    });

    it('increments updateTick when an exerciseEntries snapshot arrives', () => {
      const { store, fireExerciseSnapshot } = setupBrowserStore();
      const tickBefore = store.updateTick();

      fireExerciseSnapshot([]);

      expect(store.updateTick()).toBeGreaterThan(tickBefore);
    });

    it('does not flip connected to true when only the exerciseEntries snapshot arrives', () => {
      const { store, fireExerciseSnapshot } = setupBrowserStore();

      fireExerciseSnapshot([]);

      // `connected` is driven by the pushups subscription only
      expect(store.connected()).toBe(false);
    });

    it('sets connected to true when the pushup snapshot arrives', () => {
      const { store, firePushupSnapshot } = setupBrowserStore();

      firePushupSnapshot([]);

      expect(store.connected()).toBe(true);
    });

    it('sets connected to false when the pushup snapshot errors', () => {
      const { store, firePushupSnapshot, firePushupError } =
        setupBrowserStore();

      // First connect via pushup snapshot
      firePushupSnapshot([]);
      expect(store.connected()).toBe(true);

      // Then error it
      firePushupError();
      expect(store.connected()).toBe(false);
    });

    it('keeps exerciseEntries stable when pushup subscription errors', () => {
      const { store, fireExerciseSnapshot, firePushupError } =
        setupBrowserStore();

      fireExerciseSnapshot([
        {
          id: 'e1',
          data: () => ({
            userId: 'u1',
            exerciseId: 'legs.squats',
            timestamp: '2026-04-20T09:00:00Z',
            reps: 50,
            source: 'web',
          }),
        },
      ]);
      firePushupError();

      // exerciseEntries should NOT be cleared by a pushup error
      expect(store.exerciseEntries()).toHaveLength(1);
    });

    it('updates exerciseEntries with multiple entries', () => {
      const { store, fireExerciseSnapshot } = setupBrowserStore();

      fireExerciseSnapshot([
        {
          id: 'e1',
          data: () => ({
            userId: 'u1',
            exerciseId: 'abs.situps',
            timestamp: '2026-04-15T10:00:00Z',
            reps: 30,
            source: 'web',
          }),
        },
        {
          id: 'e2',
          data: () => ({
            userId: 'u1',
            exerciseId: 'legs.squats',
            timestamp: '2026-04-16T10:00:00Z',
            reps: 40,
            source: 'web',
          }),
        },
      ]);

      const entries = store.exerciseEntries();
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e._id)).toContain('e1');
      expect(entries.map((e) => e._id)).toContain('e2');
    });
  });
});
