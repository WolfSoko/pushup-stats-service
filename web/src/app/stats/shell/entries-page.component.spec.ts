import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntriesPageComponent } from './entries-page.component';
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { AppDataFacade } from '../../core/app-data.facade';
import { EntriesStore } from '../entries.store';

describe('EntriesPageComponent', () => {
  let fixture: ComponentFixture<EntriesPageComponent>;
  let store: InstanceType<typeof EntriesStore>;

  const rows = [
    {
      _id: '1',
      timestamp: '2026-02-10T08:00:00',
      reps: 10,
      source: 'wa',
      type: 'Standard',
    },
    {
      _id: '2',
      timestamp: '2026-02-11T09:00:00',
      reps: 25,
      source: 'web',
      type: 'Diamond',
    },
    {
      _id: '3',
      timestamp: '2026-02-11T11:00:00',
      reps: 15,
      source: 'wa',
      type: 'Wide',
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

  beforeEach(async () => {
    vitest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [EntriesPageComponent],
      providers: [
        { provide: StatsApiService, useValue: apiMock },
        { provide: LiveDataStore, useValue: liveMock },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        { provide: AppDataFacade, useValue: appDataMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntriesPageComponent);
    store = fixture.debugElement.injector.get(EntriesStore);
    await fixture.whenStable();
  });

  it('prefills date range with oldest and today (browser uses live entries)', () => {
    expect(store.from()).toBe('2026-02-10');
    expect(store.to()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('applies source, type and reps filter', () => {
    store.setSource('wa');
    store.setType('Wide');
    store.setRepsMin(11);

    expect(store.filteredRows().map((x: any) => x._id)).toEqual(['3']);
  });

  it('creates an entry via api', async () => {
    await store.createEntry({
      timestamp: '2026-02-11T20:00',
      reps: 12,
      source: 'web',
    });

    expect(apiMock.createPushup).toHaveBeenCalledWith({
      timestamp: '2026-02-11T20:00',
      reps: 12,
      source: 'web',
    });
  });

  it('updates an entry via api', async () => {
    await store.updateEntry({
      id: '1',
      timestamp: '2026-02-11T20:00',
      reps: 14,
      source: 'web',
      type: 'Diamond',
    });

    expect(apiMock.updatePushup).toHaveBeenCalledWith('1', {
      timestamp: '2026-02-11T20:00',
      reps: 14,
      source: 'web',
      type: 'Diamond',
    });
  });

  it('deletes a single row via api', async () => {
    await store.deleteEntry('2');

    expect(apiMock.deletePushup).toHaveBeenCalledWith('2');
  });
});
