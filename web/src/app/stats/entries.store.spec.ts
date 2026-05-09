import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  ExerciseFirestoreService,
  LiveDataStore,
  StatsApiService,
} from '@pu-stats/data-access';
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

      expect(apiMock.deletePushup).toHaveBeenCalledWith('1');
      expect(appDataMock.reloadAfterMutation).toHaveBeenCalledTimes(1);
    });

    it('Given a failing delete, Then app-level resources are not reloaded', async () => {
      const store = setup();
      apiMock.deletePushup.mockReturnValueOnce(
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

      expect(apiMock.createPushup).toHaveBeenCalled();
      expect(appDataMock.reloadAfterMutation).toHaveBeenCalledTimes(1);
    });

    it('Given a payload without kind, Then it falls back to the legacy pushup path', async () => {
      const store = setup();

      await store.createEntry({
        timestamp: '2026-04-27T08:00:00',
        reps: 12,
      });

      expect(apiMock.createPushup).toHaveBeenCalled();
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

      expect(apiMock.updatePushup).toHaveBeenCalled();
      expect(appDataMock.reloadAfterMutation).toHaveBeenCalledTimes(1);
    });

    it('Given a failing update, Then app-level resources are not reloaded', async () => {
      const store = setup();
      apiMock.updatePushup.mockReturnValueOnce(
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
