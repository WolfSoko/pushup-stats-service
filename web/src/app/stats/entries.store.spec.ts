import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
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

  const liveMock = {
    connected: signal(true),
    entries: signal(rows),
  };

  const appDataMock = {
    reloadAfterQuickAdd: vitest.fn(),
  };

  function setup(): InstanceType<typeof EntriesStore> {
    vitest.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        EntriesStore,
        { provide: StatsApiService, useValue: apiMock },
        { provide: LiveDataStore, useValue: liveMock },
        { provide: AppDataFacade, useValue: appDataMock },
      ],
    });
    return TestBed.inject(EntriesStore);
  }

  describe('deleteEntry', () => {
    it('Given a successful delete, When deleteEntry resolves, Then app-level resources are reloaded so the toolbar count refreshes', async () => {
      const store = setup();

      await store.deleteEntry('1');

      expect(apiMock.deletePushup).toHaveBeenCalledWith('1');
      expect(appDataMock.reloadAfterQuickAdd).toHaveBeenCalledTimes(1);
    });

    it('Given a failing delete, When the api throws, Then app-level resources are not reloaded', async () => {
      const store = setup();
      apiMock.deletePushup.mockReturnValueOnce(
        throwError(() => new Error('boom'))
      );

      await store.deleteEntry('1');

      expect(appDataMock.reloadAfterQuickAdd).not.toHaveBeenCalled();
      expect(store.error()).toBe('boom');
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
      expect(appDataMock.reloadAfterQuickAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateEntry', () => {
    it('Given a successful update, When updateEntry resolves, Then app-level resources are reloaded so the toolbar count refreshes', async () => {
      const store = setup();

      await store.updateEntry({
        id: '1',
        timestamp: '2026-04-27T08:00:00',
        reps: 25,
      });

      expect(apiMock.updatePushup).toHaveBeenCalled();
      expect(appDataMock.reloadAfterQuickAdd).toHaveBeenCalledTimes(1);
    });
  });
});
