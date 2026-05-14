import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsTableComponent } from './stats-table.component';
import { UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import type { UnifiedEntry } from '@pu-stats/models';
import type { TrainingEntryDialogResult } from '../training-entry-dialog/training-entry-dialog.component';

describe('StatsTableComponent', () => {
  let fixture: ComponentFixture<StatsTableComponent>;

  const userMock = {
    userIdSafe: () => 'u1',
  } as unknown as UserContextService;

  const userConfigApiMock = {
    getConfig: vitest
      .fn()
      .mockReturnValue(
        of({ userId: 'u1', dailyGoal: 100, ui: { showSourceColumn: false } })
      ),
    updateConfig: vitest
      .fn()
      .mockReturnValue(of({ userId: 'u1', ui: { showSourceColumn: true } })),
  } as unknown as UserConfigApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsTableComponent],
      providers: [
        { provide: UserContextService, useValue: userMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsTableComponent);
  });

  it('binds entry data to table dataSource (mapped to UnifiedEntry)', async () => {
    const entries = [
      { _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' },
    ];
    fixture.componentRef.setInput('entries', entries);
    await fixture.whenStable();

    const data = fixture.componentInstance.dataSource.data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      kind: 'pushup',
      _id: '1',
      reps: 8,
      source: 'wa',
    });
  });

  it('binds all entries to dataSource for virtual viewport rendering', async () => {
    const component = fixture.componentInstance;
    const entries = Array.from({ length: 60 }).map((_, i) => ({
      _id: String(i + 1),
      timestamp: `2026-02-10T10:${String(i % 60).padStart(2, '0')}:00`,
      reps: i + 1,
      source: 'wa',
    }));

    fixture.componentRef.setInput('entries', entries);
    await fixture.whenStable();

    expect(component.dataSource.data.length).toBe(60);
  });

  describe('openCreateDialog()', () => {
    it('opens the unified dialog and emits a pushup create payload', () => {
      const component = fixture.componentInstance;
      const createSpy = vitest.fn();
      component.create.subscribe(createSpy);

      const result: TrainingEntryDialogResult = {
        kind: 'pushup',
        timestamp: '2026-02-11T07:00',
        reps: 12,
        sets: [12],
        source: 'web',
        type: 'standard',
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(result),
      } as never);

      component.openCreateDialog();

      // Single-set arrays are stripped before reaching the store —
      // they carry no information beyond the total reps.
      expect(createSpy).toHaveBeenCalledWith({
        kind: 'pushup',
        timestamp: result.timestamp,
        reps: 12,
        source: 'web',
        type: 'standard',
      });
    });

    it('emits an exercise create payload for non-pushup entries', () => {
      const component = fixture.componentInstance;
      const createSpy = vitest.fn();
      component.create.subscribe(createSpy);

      const result: TrainingEntryDialogResult = {
        kind: 'exercise',
        exerciseId: 'plank.standard',
        measurement: 'time',
        timestamp: '2026-02-11T07:00',
        reps: 0,
        sets: [],
        intervals: [],
        durationSec: 90,
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(result),
      } as never);

      component.openCreateDialog();

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'exercise',
          exerciseId: 'plank.standard',
          durationSec: 90,
        })
      );
    });

    it('does not emit create when dialog is cancelled', () => {
      const component = fixture.componentInstance;
      const createSpy = vitest.fn();
      component.create.subscribe(createSpy);

      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(undefined),
      } as never);

      component.openCreateDialog();

      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('openEditDialog()', () => {
    it('opens dialog with pushup entry data and emits update on close', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const entry: UnifiedEntry = {
        kind: 'pushup',
        _id: '1',
        timestamp: '2026-02-10T13:45:00',
        reps: 30,
        sets: [10, 10, 10] as number[],
        source: 'wa',
        variantType: 'Diamond',
      };

      const editResult: TrainingEntryDialogResult = {
        kind: 'pushup',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 35,
        sets: [10, 15, 10],
        source: 'web',
        type: 'diamond',
      };

      const openSpy = vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog(entry);

      // The dialog gets the edit payload tagged as pushup so the
      // category/exercise pickers stay locked.
      expect(openSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'pushup',
            timestamp: entry.timestamp,
            reps: entry.reps,
            sets: entry.sets,
            source: entry.source,
            type: entry.variantType,
          }),
        })
      );

      expect(updateSpy).toHaveBeenCalledWith({
        kind: 'pushup',
        id: '1',
        timestamp: editResult.timestamp,
        reps: editResult.reps,
        sets: editResult.sets,
        source: editResult.source,
        type: editResult.type,
      });
    });

    it('does not emit update when edit dialog is cancelled', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(undefined),
      } as never);

      component.openEditDialog({
        kind: 'pushup',
        _id: '1',
        timestamp: '2026-02-10T13:45:00',
        reps: 8,
        source: 'wa',
        variantType: null,
      });

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('passes pushup entry without sets to edit dialog correctly', () => {
      const component = fixture.componentInstance;
      const openSpy = vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(undefined),
      } as never);

      component.openEditDialog({
        kind: 'pushup',
        _id: '1',
        timestamp: '2026-02-10T13:45:00',
        reps: 20,
        source: 'web',
        variantType: 'Standard',
      });

      expect(openSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'pushup',
            reps: 20,
            sets: undefined,
          }),
        })
      );
    });

    it('strips a single-set array when emitting the pushup update', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const editResult: TrainingEntryDialogResult = {
        kind: 'pushup',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 25,
        sets: [25],
        source: 'web',
        type: 'standard',
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog({
        kind: 'pushup',
        _id: '1',
        timestamp: '2026-02-10T13:45:00',
        reps: 20,
        source: 'web',
        variantType: 'Standard',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sets: undefined })
      );
    });

    it('emits an exercise update with immutable exerciseId and reconciled sets', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const exerciseEntry: UnifiedEntry = {
        kind: 'exercise',
        _id: 'ex-7',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T13:45:00',
        reps: 30,
        source: 'web',
      };

      const editResult: TrainingEntryDialogResult = {
        kind: 'exercise',
        measurement: 'reps',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 35,
        sets: [12, 12, 11],
        intervals: [],
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog(exerciseEntry);

      expect(updateSpy).toHaveBeenCalledWith({
        kind: 'exercise',
        id: 'ex-7',
        exerciseId: 'abs.situps',
        timestamp: editResult.timestamp,
        reps: 35,
        sets: [12, 12, 11],
        source: 'web',
      });
    });

    it('strips a single-set array on exercise updates', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const editResult: TrainingEntryDialogResult = {
        kind: 'exercise',
        measurement: 'reps',
        exerciseId: 'legs.squats',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 20,
        sets: [20],
        intervals: [],
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog({
        kind: 'exercise',
        _id: 'ex-9',
        exerciseId: 'legs.squats',
        timestamp: '2026-02-10T13:45:00',
        reps: 18,
        source: 'web',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sets: undefined })
      );
    });

    it('forwards a non-empty variantId on exercise edit (set variant)', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const editResult: TrainingEntryDialogResult = {
        kind: 'exercise',
        measurement: 'reps',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 30,
        sets: [30],
        intervals: [],
        variantId: 'weighted',
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog({
        kind: 'exercise',
        _id: 'ex-7',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T13:45:00',
        reps: 25,
        source: 'web',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ variantId: 'weighted' })
      );
    });

    it('forwards null variantId on exercise edit (clear variant)', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const editResult: TrainingEntryDialogResult = {
        kind: 'exercise',
        measurement: 'reps',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 30,
        sets: [30],
        intervals: [],
        variantId: null,
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog({
        kind: 'exercise',
        _id: 'ex-7',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T13:45:00',
        reps: 25,
        source: 'web',
        variantId: 'weighted',
      });

      const call = updateSpy.mock.calls[0][0];
      expect(call.variantId).toBeNull();
      expect('variantId' in call).toBe(true);
    });

    it('emits sets: [] as the explicit clear sentinel when collapsing a multi-set entry to one set', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const editResult: TrainingEntryDialogResult = {
        kind: 'exercise',
        measurement: 'reps',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 30,
        sets: [30],
        intervals: [],
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog({
        kind: 'exercise',
        _id: 'ex-7',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T13:45:00',
        reps: 30,
        sets: [10, 10, 10],
        source: 'web',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sets: [] })
      );
    });

    it('emits a plank update with durationSec and no reps/sets', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const editResult: TrainingEntryDialogResult = {
        kind: 'exercise',
        measurement: 'time',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 0,
        sets: [],
        intervals: [],
        durationSec: 90,
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog({
        kind: 'exercise',
        _id: 'pl-1',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T13:45:00',
        reps: 0,
        durationSec: 60,
        source: 'web',
      });

      const call = updateSpy.mock.calls[0][0];
      expect(call).toMatchObject({
        kind: 'exercise',
        id: 'pl-1',
        exerciseId: 'plank.standard',
        durationSec: 90,
      });
      expect('reps' in call).toBe(false);
      expect('sets' in call).toBe(false);
    });

    it('emits a cardio.running update with distanceM + durationSec and no reps/sets', () => {
      const component = fixture.componentInstance;
      const updateSpy = vitest.fn();
      component.update.subscribe(updateSpy);

      const editResult: TrainingEntryDialogResult = {
        kind: 'exercise',
        measurement: 'distance-time',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 0,
        sets: [],
        intervals: [],
        distanceM: 5250,
        durationSec: 1500,
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog({
        kind: 'exercise',
        _id: 'r-1',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T13:45:00',
        reps: 0,
        distanceM: 5000,
        durationSec: 1450,
        source: 'web',
      });

      const call = updateSpy.mock.calls[0][0];
      expect(call).toMatchObject({
        kind: 'exercise',
        id: 'r-1',
        exerciseId: 'cardio.running',
        distanceM: 5250,
        durationSec: 1500,
      });
      expect('reps' in call).toBe(false);
      expect('sets' in call).toBe(false);
    });
  });

  describe('showExerciseColumn distinct-key heuristic', () => {
    it('hides the column when every row is the same exercise', () => {
      const component = fixture.componentInstance;
      fixture.componentRef.setInput('entries', [
        {
          kind: 'exercise',
          _id: '1',
          exerciseId: 'abs.situps',
          timestamp: '2026-02-10T13:45:00',
          reps: 20,
          source: 'web',
        },
        {
          kind: 'exercise',
          _id: '2',
          exerciseId: 'abs.situps',
          timestamp: '2026-02-09T13:45:00',
          reps: 25,
          source: 'web',
        },
      ] satisfies UnifiedEntry[]);

      expect(component.showExerciseColumn()).toBe(false);
    });

    it('shows the column when rows mix two distinct exercises', () => {
      const component = fixture.componentInstance;
      fixture.componentRef.setInput('entries', [
        {
          kind: 'exercise',
          _id: '1',
          exerciseId: 'abs.situps',
          timestamp: '2026-02-10T13:45:00',
          reps: 20,
          source: 'web',
        },
        {
          kind: 'exercise',
          _id: '2',
          exerciseId: 'legs.squats',
          timestamp: '2026-02-09T13:45:00',
          reps: 30,
          source: 'web',
        },
      ] satisfies UnifiedEntry[]);

      expect(component.showExerciseColumn()).toBe(true);
    });

    it('treats every pushup variant as one filter key (column hidden)', () => {
      const component = fixture.componentInstance;
      fixture.componentRef.setInput('entries', [
        {
          kind: 'pushup',
          _id: '1',
          timestamp: '2026-02-10T13:45:00',
          reps: 20,
          source: 'web',
          variantType: 'Standard',
        },
        {
          kind: 'pushup',
          _id: '2',
          timestamp: '2026-02-09T13:45:00',
          reps: 15,
          source: 'web',
          variantType: 'Diamond',
        },
      ] satisfies UnifiedEntry[]);

      expect(component.showExerciseColumn()).toBe(false);
    });

    it('shows the column for a pushup + exercise mix', () => {
      const component = fixture.componentInstance;
      fixture.componentRef.setInput('entries', [
        {
          kind: 'pushup',
          _id: '1',
          timestamp: '2026-02-10T13:45:00',
          reps: 20,
          source: 'web',
          variantType: 'Standard',
        },
        {
          kind: 'exercise',
          _id: '2',
          exerciseId: 'abs.situps',
          timestamp: '2026-02-09T13:45:00',
          reps: 30,
          source: 'web',
        },
      ] satisfies UnifiedEntry[]);

      expect(component.showExerciseColumn()).toBe(true);
    });
  });

  it('exposes busy helper state for update/delete spinner rendering', async () => {
    fixture.componentRef.setInput('busyAction', 'delete');
    fixture.componentRef.setInput('busyId', '1');
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.isBusy('delete', '1')).toBe(true);
    expect(component.isBusy('update', '1')).toBe(false);
  });

  describe('formatSets', () => {
    it('Given uniform sets When formatSets is called Then returns "count×reps"', () => {
      const component = fixture.componentInstance;
      const result = component.formatSets([10, 10, 10]);
      expect(result).toBe('3×10');
    });

    it('Given mixed sets When formatSets is called Then returns "a + b + c"', () => {
      const component = fixture.componentInstance;
      const result = component.formatSets([10, 15, 5]);
      expect(result).toBe('10 + 15 + 5');
    });

    it('Given empty array When formatSets is called Then returns empty string', () => {
      const component = fixture.componentInstance;
      const result = component.formatSets([]);
      expect(result).toBe('');
    });

    it('Given single set When formatSets is called Then returns "1×reps"', () => {
      const component = fixture.componentInstance;
      const result = component.formatSets([20]);
      expect(result).toBe('1×20');
    });
  });

  describe('emitRemove kind dispatch', () => {
    it('emits a pushup remove payload for pushup rows', () => {
      const component = fixture.componentInstance;
      const removeSpy = vitest.fn();
      component.remove.subscribe(removeSpy);

      component.emitRemove({
        kind: 'pushup',
        _id: 'p-1',
        timestamp: '2026-02-10T13:45:00',
        reps: 20,
        source: 'web',
        variantType: 'Standard',
      });

      expect(removeSpy).toHaveBeenCalledWith({ kind: 'pushup', id: 'p-1' });
    });

    it('emits an exercise remove payload for exercise rows', () => {
      const component = fixture.componentInstance;
      const removeSpy = vitest.fn();
      component.remove.subscribe(removeSpy);

      component.emitRemove({
        kind: 'exercise',
        _id: 'ex-9',
        exerciseId: 'legs.squats',
        timestamp: '2026-02-10T13:45:00',
        reps: 25,
        source: 'web',
      });

      expect(removeSpy).toHaveBeenCalledWith({ kind: 'exercise', id: 'ex-9' });
    });
  });

  it('renders non-virtual table fallback on server platform', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [StatsTableComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: UserContextService, useValue: userMock },
        { provide: UserConfigApiService, useValue: userConfigApiMock },
      ],
    }).compileComponents();

    const serverFixture = TestBed.createComponent(StatsTableComponent);
    serverFixture.componentRef.setInput('entries', [
      { _id: 's1', timestamp: '2026-02-11T10:00:00', reps: 12, source: 'web' },
    ]);

    await serverFixture.whenStable();

    expect(serverFixture.componentInstance.isBrowser).toBe(false);
    const host = serverFixture.nativeElement as HTMLElement;
    expect(host.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect(host.querySelector('mat-table')).toBeTruthy();
  });
});
