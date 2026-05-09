import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsTableComponent } from './stats-table.component';
import { UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import type { UnifiedEntry } from '@pu-stats/models';
import { CreateEntryResult } from '../create-entry-dialog/create-entry-dialog.component';
import { ExerciseEntryDialogResult } from '../exercise-entry-dialog/exercise-entry-dialog.component';

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

    // Legacy PushupRecord input is mapped to UnifiedEntry on the way
    // into the dataSource so the row template can read `kind`-aware
    // helpers without each caller having to map first.
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
    it('opens CreateEntryDialogComponent and emits create when dialog closes with result', () => {
      const component = fixture.componentInstance;
      const createSpy = vitest.fn();
      component.create.subscribe(createSpy);

      const result: CreateEntryResult = {
        timestamp: '2026-02-11T07:00',
        reps: 12,
        sets: [12],
        source: 'web',
        type: 'Standard',
      };
      vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(result),
      } as never);

      component.openCreateDialog();

      expect(createSpy).toHaveBeenCalledWith(result);
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
    it('opens dialog with entry data and emits update on close', () => {
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

      const editResult: CreateEntryResult = {
        timestamp: '2026-02-10T14:00+01:00',
        reps: 35,
        sets: [10, 15, 10],
        source: 'web',
        type: 'Diamond',
      };

      const openSpy = vitest.spyOn(component.dialog, 'open').mockReturnValue({
        afterClosed: () => of(editResult),
      } as never);

      component.openEditDialog(entry);

      // Verify dialog was opened with entry data
      expect(openSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            timestamp: entry.timestamp,
            reps: entry.reps,
            sets: entry.sets,
            source: entry.source,
            type: entry.variantType,
          },
        })
      );

      // Verify update was emitted with dialog result and the kind
      // discriminator the parent store needs to dispatch.
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

    it('passes entry without sets to edit dialog correctly', () => {
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

      const editResult: CreateEntryResult = {
        timestamp: '2026-02-10T14:00+01:00',
        reps: 25,
        sets: [25],
        source: 'web',
        type: 'Standard',
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

      const editResult: ExerciseEntryDialogResult = {
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 35,
        sets: [12, 12, 11],
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

      const editResult: ExerciseEntryDialogResult = {
        exerciseId: 'legs.squats',
        timestamp: '2026-02-10T14:00+01:00',
        reps: 20,
        sets: [20],
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
