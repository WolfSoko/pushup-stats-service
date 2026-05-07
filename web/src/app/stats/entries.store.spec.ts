import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  ExerciseFirestoreService,
  LiveDataStore,
  StatsApiService,
} from '@pu-stats/data-access';
import type { ExerciseEntry, PushupRecord } from '@pu-stats/models';
import { AppDataFacade } from '../core/app-data.facade';
import { EntriesStore } from './entries.store';

const pushupRows: PushupRecord[] = [
  {
    _id: '1',
    timestamp: '2026-04-27T08:00:00',
    reps: 10,
    source: 'web',
    type: 'Standard',
  },
];

const exerciseRows: ExerciseEntry[] = [
  {
    _id: 'e1',
    userId: 'u1',
    exerciseId: 'abs.situps',
    timestamp: '2026-04-26T07:00:00Z',
    reps: 30,
    source: 'web',
  },
  {
    _id: 'e2',
    userId: 'u1',
    exerciseId: 'legs.squats',
    timestamp: '2026-04-28T09:00:00Z',
    reps: 20,
    source: 'web',
  },
];

describe('EntriesStore', () => {
  const rows = pushupRows;

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
      ],
    });
    return TestBed.inject(EntriesStore);
  }

  describe('rows computed', () => {
    it('merges pushup and exercise entries from the live store sorted by timestamp', () => {
      liveMock.entries = signal(pushupRows) as never;
      liveMock.exerciseEntries = signal(exerciseRows) as never;
      const store = setup();

      const result = store.rows();

      // Should contain both pushup and exercise entries
      expect(result.length).toBe(3);
      // Sorted ascending by timestamp
      const timestamps = result.map((r) => r.timestamp);
      const sorted = [...timestamps].sort((a, b) => a.localeCompare(b));
      expect(timestamps).toEqual(sorted);
    });

    it('maps pushup records to kind="pushup"', () => {
      liveMock.entries = signal(pushupRows) as never;
      liveMock.exerciseEntries = signal([]) as never;
      const store = setup();

      const result = store.rows();

      expect(result.every((r) => r.kind === 'pushup')).toBe(true);
    });

    it('maps exercise entries to kind="exercise"', () => {
      liveMock.entries = signal([]) as never;
      liveMock.exerciseEntries = signal(exerciseRows) as never;
      const store = setup();

      const result = store.rows();

      expect(result.every((r) => r.kind === 'exercise')).toBe(true);
    });

    it('returns empty array when both live sources are empty', () => {
      liveMock.entries = signal([]) as never;
      liveMock.exerciseEntries = signal([]) as never;
      const store = setup();

      expect(store.rows()).toEqual([]);
    });
  });

  describe('kindOptionsRaw computed', () => {
    it('returns ["pushup"] when only pushup entries are present', () => {
      liveMock.entries = signal(pushupRows) as never;
      liveMock.exerciseEntries = signal([]) as never;
      const store = setup();

      expect(store.kindOptionsRaw()).toEqual(['pushup']);
    });

    it('returns ["pushup", <exerciseIds>] with pushup always first', () => {
      liveMock.entries = signal(pushupRows) as never;
      liveMock.exerciseEntries = signal(exerciseRows) as never;
      const store = setup();

      const opts = store.kindOptionsRaw();
      expect(opts[0]).toBe('pushup');
      expect(opts).toContain('abs.situps');
      expect(opts).toContain('legs.squats');
    });

    it('de-duplicates exercise ids that appear multiple times', () => {
      const duplicateExercises: ExerciseEntry[] = [
        { _id: 'e1', userId: 'u1', exerciseId: 'abs.situps', timestamp: '2026-04-01T10:00:00Z', reps: 10, source: 'web' },
        { _id: 'e2', userId: 'u1', exerciseId: 'abs.situps', timestamp: '2026-04-02T10:00:00Z', reps: 15, source: 'web' },
      ];
      liveMock.entries = signal([]) as never;
      liveMock.exerciseEntries = signal(duplicateExercises) as never;
      const store = setup();

      const opts = store.kindOptionsRaw();
      const situpCount = opts.filter((k) => k === 'abs.situps').length;
      expect(situpCount).toBe(1);
    });

    it('returns empty array when no rows exist', () => {
      liveMock.entries = signal([]) as never;
      liveMock.exerciseEntries = signal([]) as never;
      const store = setup();

      expect(store.kindOptionsRaw()).toEqual([]);
    });
  });

  describe('filteredRows with kinds filter', () => {
    beforeEach(() => {
      liveMock.entries = signal(pushupRows) as never;
      liveMock.exerciseEntries = signal(exerciseRows) as never;
    });

    it('shows all rows when kinds is empty', () => {
      const store = setup();
      // kinds defaults to []
      expect(store.filteredRows().length).toBe(3);
    });

    it('shows only pushup rows when kinds=["pushup"]', () => {
      const store = setup();
      store.setKinds(['pushup']);

      const filtered = store.filteredRows();
      expect(filtered.every((r) => r.kind === 'pushup')).toBe(true);
    });

    it('shows only abs.situps rows when kinds=["abs.situps"]', () => {
      const store = setup();
      store.setKinds(['abs.situps']);

      const filtered = store.filteredRows();
      expect(filtered.length).toBe(1);
      expect((filtered[0] as { exerciseId?: string }).exerciseId).toBe('abs.situps');
    });

    it('shows rows matching any of multiple selected kinds', () => {
      const store = setup();
      store.setKinds(['abs.situps', 'legs.squats']);

      const filtered = store.filteredRows();
      expect(filtered.length).toBe(2);
      expect(filtered.every((r) => r.kind === 'exercise')).toBe(true);
    });

    it('returns empty when kinds filter matches nothing', () => {
      const store = setup();
      store.setKinds(['nonexistent.exercise']);

      expect(store.filteredRows()).toEqual([]);
    });
  });

  describe('setKinds', () => {
    it('stores the kinds value and reflects it in state', () => {
      liveMock.entries = signal([]) as never;
      liveMock.exerciseEntries = signal([]) as never;
      const store = setup();

      store.setKinds(['abs.situps', 'legs.squats']);

      expect(store.kinds()).toEqual(['abs.situps', 'legs.squats']);
    });

    it('clears the filter when set to an empty array', () => {
      liveMock.entries = signal([]) as never;
      liveMock.exerciseEntries = signal([]) as never;
      const store = setup();

      store.setKinds(['abs.situps']);
      store.setKinds([]);

      expect(store.kinds()).toEqual([]);
    });
  });

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
    it('Given a successful create, When createEntry resolves, Then app-level resources are reloaded so the toolbar count refreshes', async () => {
      const store = setup();

      await store.createEntry({
        timestamp: '2026-04-27T08:00:00',
        reps: 12,
      });

      expect(apiMock.createPushup).toHaveBeenCalled();
      expect(appDataMock.reloadAfterMutation).toHaveBeenCalledTimes(1);
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
  });
});
