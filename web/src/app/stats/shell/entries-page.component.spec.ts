import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntriesPageComponent } from './entries-page.component';
import {
  ExerciseFirestoreService,
  LiveDataStore,
  StatsApiService,
} from '@pu-stats/data-access';
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
      // Legacy English entryLabel form (older Firestore docs).
      type: 'Standard',
    },
    {
      _id: '2',
      timestamp: '2026-02-11T09:00:00',
      reps: 25,
      source: 'web',
      // Legacy English entryLabel form.
      type: 'Diamond',
    },
    {
      _id: '3',
      timestamp: '2026-02-11T11:00:00',
      reps: 15,
      source: 'wa',
      type: 'Wide',
    },
    {
      _id: '4',
      timestamp: '2026-02-12T07:00:00',
      reps: 20,
      source: 'web',
      // New canonical id form. Combined with row 2 above, this exercises
      // the typeOptions / filteredRows bucket-collapse guarantee.
      type: 'diamond',
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
    // EntriesStore now reads from both pushups and exerciseEntries via
    // LiveDataStore. The Phase-0 history flow only exercises pushups
    // here, so an empty exerciseEntries signal is enough.
    exerciseEntries: signal([] as never[]),
    updateTick: signal(0),
  };

  const exerciseServiceMock = {
    listEntries: vitest.fn().mockReturnValue(of([])),
    createEntry: vitest.fn().mockReturnValue(of({ _id: 'x' })),
    updateEntry: vitest.fn().mockReturnValue(of(undefined)),
    deleteEntry: vitest.fn().mockReturnValue(of({ ok: true })),
  };

  const appDataMock = {
    reloadAfterMutation: vitest.fn(),
  };

  beforeEach(async () => {
    vitest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [EntriesPageComponent],
      providers: [
        { provide: StatsApiService, useValue: apiMock },
        { provide: ExerciseFirestoreService, useValue: exerciseServiceMock },
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
    // The filter dropdown emits canonical kebab-case ids. Legacy
    // entryLabel rows ("Wide") still match because the store
    // canonicalizes both sides before comparing.
    store.setSource('wa');
    store.setType('wide');
    store.setRepsMin(11);

    expect(store.filteredRows().map((x: any) => x._id)).toEqual(['3']);
  });

  it('creates an entry via api', async () => {
    await store.createEntry({
      kind: 'pushup',
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
      kind: 'pushup',
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
    await store.deleteEntry({ kind: 'pushup', id: '2' });

    expect(apiMock.deletePushup).toHaveBeenCalledWith('2');
  });

  it('deduplicates legacy entryLabel and new canonical id in typeOptions', () => {
    // Rows 2 ("Diamond") and 4 ("diamond") must collapse into a single
    // filter option keyed by the canonical id.
    const options = store.typeOptions();
    const diamondOptions = options.filter((o) => o.value === 'diamond');
    expect(diamondOptions).toHaveLength(1);
    // Filter selection on the canonical id must match both legacy AND
    // new-form rows in filteredRows.
    store.setType('diamond');
    expect(
      store
        .filteredRows()
        .map((x: any) => x._id)
        .sort()
    ).toEqual(['2', '4']);
  });

  describe('kindFilterOptions + kindLabel', () => {
    it('maps kindOptionsRaw values into { value, label } pairs', () => {
      const component = fixture.componentInstance;
      const opts = component.kindFilterOptions();
      // The mock rows are all pushup-kind, so the only filter key is
      // 'pushup' (variants collapse via unifiedEntryFilterKey).
      expect(opts).toHaveLength(1);
      expect(opts[0].value).toBe('pushup');
      // The label is the localized "Liegestütze" string ($localize
      // returns the source German in tests because no locale runtime
      // is loaded).
      expect(opts[0].label).toBe('Liegestütze');
    });
    // Note: the exercise-id branch of `kindLabel` is exercised
    // indirectly through `exerciseDisplayName` (covered in
    // stats-table.component.spec.ts via the exerciseLabel path)
    // rather than re-mocking the store here — the store is wired
    // through DI as a component provider, so a stub instance can't
    // be injected without rebuilding the whole TestBed.
  });
});
