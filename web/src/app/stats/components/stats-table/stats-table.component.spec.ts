import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsTableComponent } from './stats-table.component';
import { UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import type { UnifiedEntry } from '@pu-stats/models';
import { CreateEntryResult } from '../create-entry-dialog/create-entry-dialog.component';

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

    describe('Given an exercise-kind entry', () => {
      it('opens the EntryDialog (not the legacy CreateEntryDialog) with the catalog definition pre-filled', () => {
        const component = fixture.componentInstance;
        const openSpy = vitest.spyOn(component.dialog, 'open').mockReturnValue({
          afterClosed: () => of(undefined),
        } as never);

        component.openEditDialog({
          kind: 'exercise',
          _id: 'e1',
          timestamp: '2026-04-15T10:00:00Z',
          reps: 30,
          sets: [10, 10, 10],
          source: 'web',
          exerciseId: 'abs.situps',
        });

        expect(openSpy).toHaveBeenCalledTimes(1);
        const callData = openSpy.mock.calls[0][1] as Record<string, unknown>;
        expect(callData).toHaveProperty('data');
        const dialogData = callData['data'] as Record<string, unknown>;
        expect(dialogData).toHaveProperty('definition');
        const def = dialogData['definition'] as Record<string, unknown>;
        expect(def['id']).toBe('abs.situps');
      });

      it('emits an exercise-kind update with exerciseId when dialog closes with a result', () => {
        const component = fixture.componentInstance;
        const updateSpy = vitest.fn();
        component.update.subscribe(updateSpy);

        vitest.spyOn(component.dialog, 'open').mockReturnValue({
          afterClosed: () =>
            of({
              exerciseId: 'abs.situps',
              timestamp: '2026-04-15T10:00:00Z',
              reps: 35,
              sets: [15, 10, 10],
            }),
        } as never);

        component.openEditDialog({
          kind: 'exercise',
          _id: 'e1',
          timestamp: '2026-04-15T10:00:00Z',
          reps: 30,
          sets: [10, 10, 10],
          source: 'web',
          exerciseId: 'abs.situps',
        });

        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 'exercise',
            id: 'e1',
            exerciseId: 'abs.situps',
            reps: 35,
          })
        );
      });

      it('does not include sets on the update payload when the result has only one set', () => {
        const component = fixture.componentInstance;
        const updateSpy = vitest.fn();
        component.update.subscribe(updateSpy);

        vitest.spyOn(component.dialog, 'open').mockReturnValue({
          afterClosed: () =>
            of({
              exerciseId: 'legs.squats',
              timestamp: '2026-04-15T10:00:00Z',
              reps: 20,
              sets: [20],
            }),
        } as never);

        component.openEditDialog({
          kind: 'exercise',
          _id: 'e2',
          timestamp: '2026-04-15T10:00:00Z',
          reps: 20,
          source: 'web',
          exerciseId: 'legs.squats',
        });

        const emitted = updateSpy.mock.calls[0][0] as Record<string, unknown>;
        expect(emitted['sets']).toBeUndefined();
      });

      it('does not emit update when exercise edit dialog is cancelled', () => {
        const component = fixture.componentInstance;
        const updateSpy = vitest.fn();
        component.update.subscribe(updateSpy);

        vitest.spyOn(component.dialog, 'open').mockReturnValue({
          afterClosed: () => of(undefined),
        } as never);

        component.openEditDialog({
          kind: 'exercise',
          _id: 'e1',
          timestamp: '2026-04-15T10:00:00Z',
          reps: 30,
          source: 'web',
          exerciseId: 'abs.situps',
        });

        expect(updateSpy).not.toHaveBeenCalled();
      });
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
  });

  describe('showExerciseColumn', () => {
    it('is false when all entries are pushup-kind', async () => {
      fixture.componentRef.setInput('entries', [
        { _id: '1', timestamp: '2026-04-15T10:00:00', reps: 10, source: 'web' },
        { _id: '2', timestamp: '2026-04-16T10:00:00', reps: 20, source: 'web' },
      ]);
      await fixture.whenStable();
      expect(fixture.componentInstance.showExerciseColumn()).toBe(false);
    });

    it('is true when at least one entry is exercise-kind', async () => {
      fixture.componentRef.setInput('entries', [
        {
          kind: 'exercise' as const,
          _id: 'e1',
          timestamp: '2026-04-15T10:00:00Z',
          reps: 30,
          source: 'web',
          exerciseId: 'abs.situps',
        },
      ]);
      await fixture.whenStable();
      expect(fixture.componentInstance.showExerciseColumn()).toBe(true);
    });

    it('is false when entries array is empty', async () => {
      fixture.componentRef.setInput('entries', []);
      await fixture.whenStable();
      expect(fixture.componentInstance.showExerciseColumn()).toBe(false);
    });
  });

  describe('exerciseLabel', () => {
    it('returns "Liegestütze" label for pushup entries', () => {
      const component = fixture.componentInstance;
      const label = component.exerciseLabel({
        kind: 'pushup',
        _id: 'p1',
        timestamp: '2026-04-15T10:00:00',
        reps: 10,
        source: 'web',
        variantType: 'Standard',
      });
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it('returns the exercise id when the catalog has no matching entry', () => {
      const component = fixture.componentInstance;
      const label = component.exerciseLabel({
        kind: 'exercise',
        _id: 'e99',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 5,
        source: 'web',
        exerciseId: 'unknown.exercise.id',
      });
      expect(label).toBe('unknown.exercise.id');
    });

    it('returns a non-empty string for a known catalog exercise', () => {
      const component = fixture.componentInstance;
      const label = component.exerciseLabel({
        kind: 'exercise',
        _id: 'e1',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 30,
        source: 'web',
        exerciseId: 'abs.situps',
      });
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
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
