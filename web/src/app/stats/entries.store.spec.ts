import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  ExerciseFirestoreService,
  StatsApiService,
} from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { UserContextService } from '@pu-auth/auth';
import { AppDataFacade } from '../core/app-data.facade';
import { EntriesStore } from './entries.store';

describe('EntriesStore', () => {
  const rows = [
    {
      _id: '1',
      timestamp: '2026-04-27T08:00:00',
      reps: 10,
      source: 'web',
      type: 'Standard',
    },
  ];

  const apiMock = {
    listPushups: vitest.fn().mockReturnValue(of(rows)),
    deletePushup: vitest.fn().mockReturnValue(of({ ok: true })),
    createPushup: vitest.fn().mockReturnValue(of({ _id: 'x' })),
    updatePushup: vitest.fn().mockReturnValue(of({ _id: '1' })),
  };

  const exerciseServiceMock = {
    listEntries: vitest.fn().mockReturnValue(of([])),
    createEntry: vitest.fn().mockReturnValue(of({ _id: 'x' })),
    updateEntry: vitest.fn().mockReturnValue(of(undefined)),
    deleteEntry: vitest.fn().mockReturnValue(of({ ok: true })),
  };

  const liveMock = {
    connected: signal(true),
    entries: signal(rows),
    exerciseEntries: signal([] as never[]),
    updateTick: signal(0),
  };

  const appDataMock = {
    reloadAfterMutation: vitest.fn(),
  };

  const userContextMock = {
    userIdSafe: () => 'u1',
  } as unknown as UserContextService;

  function setup(): InstanceType<typeof EntriesStore> {
    vitest.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        EntriesStore,
        { provide: StatsApiService, useValue: apiMock },
        { provide: ExerciseFirestoreService, useValue: exerciseServiceMock },
        { provide: LiveDataStore, useValue: liveMock },
        { provide: AppDataFacade, useValue: appDataMock },
        { provide: UserContextService, useValue: userContextMock },
      ],
    });
    return TestBed.inject(EntriesStore);
  }

  describe('deleteEntry', () => {
    it('Given a successful pushup delete, Then app-level resources are reloaded so the toolbar count refreshes', async () => {
      const store = setup();

      await store.deleteEntry({ kind: 'pushup', id: '1' });

      expect(exerciseServiceMock.deleteEntry).toHaveBeenCalledWith('1');
      expect(appDataMock.reloadAfterMutation).toHaveBeenCalledTimes(1);
    });

    it('Given a failing delete, Then app-level resources are not reloaded', async () => {
      const store = setup();
      exerciseServiceMock.deleteEntry.mockReturnValueOnce(
        throwError(() => new Error('boom'))
      );

      await store.deleteEntry({ kind: 'pushup', id: '1' });

      expect(appDataMock.reloadAfterMutation).not.toHaveBeenCalled();
      expect(store.error()).toBe('boom');
    });

    it('Given an exercise-kind delete, Then ExerciseFirestoreService.deleteEntry is called', async () => {
      const store = setup();

      await store.deleteEntry({ kind: 'exercise', id: 's42' });

      expect(exerciseServiceMock.deleteEntry).toHaveBeenCalledWith('s42');
      expect(apiMock.deletePushup).not.toHaveBeenCalled();
    });
  });

  describe('createEntry', () => {
    it('Given a pushup-kind create, When createEntry resolves, Then app-level resources are reloaded so the toolbar count refreshes', async () => {
      const store = setup();

      await store.createEntry({
        kind: 'pushup',
        timestamp: '2026-04-27T08:00:00',
        reps: 12,
      });

      expect(exerciseServiceMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ exerciseId: 'pushup', reps: 12 })
      );
      expect(appDataMock.reloadAfterMutation).toHaveBeenCalledTimes(1);
    });

    it('should persist the pushup Typ as the variant on create', async () => {
      // given a new pushup entry logged with a specific type
      const store = setup();

      // when the create is dispatched
      await store.createEntry({
        kind: 'pushup',
        timestamp: '2026-04-27T08:00:00',
        reps: 12,
        type: 'diamond',
      });

      // then the type is stored as the entry's variant
      expect(exerciseServiceMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ variantId: 'diamond' })
      );
    });

    it('Given an exercise-kind create, Then ExerciseFirestoreService.createEntry is called with the user id', async () => {
      const store = setup();

      await store.createEntry({
        kind: 'exercise',
        exerciseId: 'plank.standard',
        timestamp: '2026-04-27T08:00:00',
        durationSec: 90,
      });

      expect(exerciseServiceMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          exerciseId: 'plank.standard',
          durationSec: 90,
        })
      );
      expect(apiMock.createPushup).not.toHaveBeenCalled();
    });

    it('Given an endurance create with intervals, Then the per-interval breakdown is forwarded to the service', async () => {
      // given
      const store = setup();

      // when
      await store.createEntry({
        kind: 'exercise',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-27T08:00:00',
        distanceM: 1200,
        intervals: [400, 400, 400],
      });

      // then
      expect(exerciseServiceMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ intervals: [400, 400, 400] })
      );
    });

    it('Given a running create with per-interval split times, Then intervalDurationsSec is forwarded to the service', async () => {
      // given
      const store = setup();

      // when
      await store.createEntry({
        kind: 'exercise',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-27T08:00:00',
        distanceM: 3000,
        durationSec: 900,
        intervals: [1000, 1000, 1000],
        intervalDurationsSec: [270, 265, 280],
      });

      // then
      expect(exerciseServiceMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ intervalDurationsSec: [270, 265, 280] })
      );
    });

    it('Given an exercise-kind create without exerciseId, Then no service is called and store.error is set', async () => {
      const store = setup();

      await store.createEntry({
        kind: 'exercise',
        timestamp: '2026-04-27T08:00:00',
        durationSec: 90,
      });

      // Guard branch: omitting exerciseId on an exercise-kind payload
      // is a programmer error. The store reports it via `error` rather
      // than silently dispatching to the wrong Firestore collection.
      expect(exerciseServiceMock.createEntry).not.toHaveBeenCalled();
      expect(apiMock.createPushup).not.toHaveBeenCalled();
      expect(store.error()).toMatch(/exerciseId is required/i);
    });

    it('Given an exercise-kind create with an empty user id, Then no service is called and store.error is set', async () => {
      vitest.clearAllMocks();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          EntriesStore,
          { provide: StatsApiService, useValue: apiMock },
          { provide: ExerciseFirestoreService, useValue: exerciseServiceMock },
          { provide: LiveDataStore, useValue: liveMock },
          { provide: AppDataFacade, useValue: appDataMock },
          {
            provide: UserContextService,
            useValue: { userIdSafe: () => '' },
          },
        ],
      });
      const store = TestBed.inject(EntriesStore);

      await store.createEntry({
        kind: 'exercise',
        exerciseId: 'plank.standard',
        timestamp: '2026-04-27T08:00:00',
        durationSec: 90,
      });

      expect(exerciseServiceMock.createEntry).not.toHaveBeenCalled();
      expect(apiMock.createPushup).not.toHaveBeenCalled();
      expect(store.error()).toMatch(/missing user id/i);
    });
  });

  describe('updateEntry', () => {
    it('Given a successful pushup update, Then app-level resources are reloaded', async () => {
      const store = setup();

      await store.updateEntry({
        kind: 'pushup',
        id: '1',
        timestamp: '2026-04-27T08:00:00',
        reps: 25,
      });

      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        '1',
        'pushup',
        expect.objectContaining({ reps: 25 })
      );
      expect(appDataMock.reloadAfterMutation).toHaveBeenCalledTimes(1);
    });

    it('Given a failing update, Then app-level resources are not reloaded', async () => {
      const store = setup();
      exerciseServiceMock.updateEntry.mockReturnValueOnce(
        throwError(() => new Error('boom'))
      );

      await store.updateEntry({
        kind: 'pushup',
        id: '1',
        timestamp: '2026-04-27T08:00:00',
        reps: 25,
      });

      expect(appDataMock.reloadAfterMutation).not.toHaveBeenCalled();
      expect(store.error()).toBe('boom');
    });

    it('should persist the pushup Typ as the variant', async () => {
      // given a pushup edit where the dialog's "Typ" autocomplete resolved
      // to a catalog type
      const store = setup();

      // when the update is dispatched
      await store.updateEntry({
        kind: 'pushup',
        id: '1',
        timestamp: '2026-04-27T08:00:00',
        reps: 25,
        type: 'diamond',
      });

      // then it reaches Firestore as `variantId` — dropping it would make
      // the Typ field in the edit dialog a no-op
      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        '1',
        'pushup',
        expect.objectContaining({ variantId: 'diamond' })
      );
    });

    it('should clear the variant when the pushup Typ is emptied', async () => {
      // given a pushup edit whose Typ field was cleared
      const store = setup();

      // when the update is dispatched
      await store.updateEntry({
        kind: 'pushup',
        id: '1',
        timestamp: '2026-04-27T08:00:00',
        reps: 25,
        type: '',
      });

      // then the null clear sentinel reaches the service, so the stored
      // variant is removed rather than left stale
      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        '1',
        'pushup',
        expect.objectContaining({ variantId: null })
      );
    });

    it('Given an exercise-kind update with exerciseId, Then ExerciseFirestoreService.updateEntry is called', async () => {
      const store = setup();

      await store.updateEntry({
        kind: 'exercise',
        id: 's42',
        exerciseId: 'abs.situps',
        timestamp: '2026-04-27T08:00:00',
        reps: 25,
      });

      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        's42',
        'abs.situps',
        expect.objectContaining({ reps: 25 })
      );
      expect(apiMock.updatePushup).not.toHaveBeenCalled();
    });

    it('Given an endurance update with intervals, Then the per-interval breakdown is forwarded to the service', async () => {
      // given
      const store = setup();

      // when
      await store.updateEntry({
        kind: 'exercise',
        id: 's42',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-27T08:00:00',
        distanceM: 1200,
        intervals: [400, 400, 400],
      });

      // then
      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        's42',
        'cardio.running',
        expect.objectContaining({ intervals: [400, 400, 400] })
      );
    });

    it('Given a running update with per-interval split times, Then intervalDurationsSec is forwarded to the service', async () => {
      // given
      const store = setup();

      // when
      await store.updateEntry({
        kind: 'exercise',
        id: 's42',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-27T08:00:00',
        intervals: [1000, 1000],
        intervalDurationsSec: [270, 265],
      });

      // then
      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        's42',
        'cardio.running',
        expect.objectContaining({ intervalDurationsSec: [270, 265] })
      );
    });

    it('Given a running update clearing intervalDurationsSec, Then the empty-array clear sentinel reaches the service', async () => {
      // given
      const store = setup();

      // when
      await store.updateEntry({
        kind: 'exercise',
        id: 's42',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-27T08:00:00',
        intervalDurationsSec: [],
      });

      // then
      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        's42',
        'cardio.running',
        expect.objectContaining({ intervalDurationsSec: [] })
      );
    });

    it('Given an endurance update clearing intervals, Then the empty-array clear sentinel reaches the service', async () => {
      // given
      const store = setup();

      // when
      await store.updateEntry({
        kind: 'exercise',
        id: 's42',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-27T08:00:00',
        distanceM: 1200,
        intervals: [],
      });

      // then
      expect(exerciseServiceMock.updateEntry).toHaveBeenCalledWith(
        's42',
        'cardio.running',
        expect.objectContaining({ intervals: [] })
      );
    });

    it('Given an exercise-kind update WITHOUT exerciseId, Then the guard sets store.error and skips the service call', async () => {
      const store = setup();

      await store.updateEntry({
        kind: 'exercise',
        id: 's42',
        timestamp: '2026-04-27T08:00:00',
        reps: 25,
      });

      expect(exerciseServiceMock.updateEntry).not.toHaveBeenCalled();
      expect(apiMock.updatePushup).not.toHaveBeenCalled();
      expect(store.error()).toMatch(/exerciseId is required/i);
      expect(store.busyAction()).toBeNull();
    });
  });
});
