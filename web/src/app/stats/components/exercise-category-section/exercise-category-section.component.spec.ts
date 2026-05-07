import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { ExerciseCategorySectionComponent } from './exercise-category-section.component';
import {
  ExerciseFirestoreService,
  ExerciseValidationError,
} from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import type { ExerciseEntry } from '@pu-stats/models';

const sitEntry: ExerciseEntry = {
  _id: 'e1',
  userId: 'u1',
  exerciseId: 'abs.situps',
  timestamp: '2026-04-15T10:00:00Z',
  reps: 30,
  source: 'web',
};

const squatEntry: ExerciseEntry = {
  _id: 'e2',
  userId: 'u1',
  exerciseId: 'legs.squats',
  timestamp: '2026-04-20T09:00:00Z',
  reps: 50,
  source: 'web',
};

describe('ExerciseCategorySectionComponent', () => {
  let fixture: ComponentFixture<ExerciseCategorySectionComponent>;
  let component: ExerciseCategorySectionComponent;

  const exerciseServiceMock = {
    listEntries: vitest.fn().mockReturnValue(of([])),
    createEntry: vitest.fn().mockReturnValue(of({ _id: 'new-entry' })),
  };

  const userContextMock = {
    userIdSafe: vitest.fn().mockReturnValue('u1'),
  };

  const dialogMock = {
    open: vitest.fn(),
  };

  const snackMock = {
    open: vitest.fn(),
  };

  async function setup(
    categoryId: 'abs' | 'legs' = 'abs',
    entries: ExerciseEntry[] = []
  ): Promise<void> {
    vitest.clearAllMocks();
    exerciseServiceMock.listEntries.mockReturnValue(of(entries));
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [ExerciseCategorySectionComponent],
      providers: [
        { provide: ExerciseFirestoreService, useValue: exerciseServiceMock },
        { provide: UserContextService, useValue: userContextMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: MatSnackBar, useValue: snackMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExerciseCategorySectionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('categoryId', categoryId);
    await fixture.whenStable();
  }

  describe('Given the abs category with sit-up entries', () => {
    it('renders a mat-card when the category is known', async () => {
      await setup('abs', [sitEntry]);
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('mat-card');
      expect(card).toBeTruthy();
    });

    it('summaries() returns one entry per catalog exercise in the category', async () => {
      await setup('abs', [sitEntry]);

      const s = component.summaries();
      // abs has abs.situps in the Phase-0 catalog
      expect(s.some((item) => item.definition.id === 'abs.situps')).toBe(true);
    });

    it('summaries() sums all matching reps into totalReps30d', async () => {
      const entries: ExerciseEntry[] = [
        { ...sitEntry, _id: 'e1', reps: 20 },
        { ...sitEntry, _id: 'e2', reps: 15, timestamp: '2026-04-16T10:00:00Z' },
      ];
      await setup('abs', entries);

      const summary = component
        .summaries()
        .find((s) => s.definition.id === 'abs.situps');
      expect(summary?.totalReps30d).toBe(35);
    });

    it('summaries() picks the latest entry as lastEntry', async () => {
      const older: ExerciseEntry = {
        ...sitEntry,
        _id: 'e-older',
        timestamp: '2026-04-10T08:00:00Z',
        reps: 10,
      };
      const newer: ExerciseEntry = {
        ...sitEntry,
        _id: 'e-newer',
        timestamp: '2026-04-20T12:00:00Z',
        reps: 30,
      };
      await setup('abs', [older, newer]);

      const summary = component
        .summaries()
        .find((s) => s.definition.id === 'abs.situps');
      expect(summary?.lastEntry?._id).toBe('e-newer');
    });

    it('summaries() returns zero totalReps30d when no entries exist', async () => {
      await setup('abs', []);

      const summary = component
        .summaries()
        .find((s) => s.definition.id === 'abs.situps');
      expect(summary?.totalReps30d).toBe(0);
      expect(summary?.lastEntry).toBeNull();
    });

    it('does not include squats data in the abs summaries', async () => {
      await setup('abs', [squatEntry]);

      const summary = component
        .summaries()
        .find((s) => s.definition.id === 'abs.situps');
      expect(summary?.totalReps30d).toBe(0);
    });
  });

  describe('Given the legs category', () => {
    it('summaries() includes legs.squats', async () => {
      await setup('legs', [squatEntry]);

      const summary = component
        .summaries()
        .find((s) => s.definition.id === 'legs.squats');
      expect(summary?.totalReps30d).toBe(50);
      expect(summary?.lastEntry?._id).toBe('e2');
    });
  });

  describe('exerciseName()', () => {
    it('returns localized name for known exercise ids', async () => {
      await setup('abs');

      // The component uses $localize — in tests the identity compile
      // returns the default message. We just verify it returns a
      // non-empty string so unknown-id fallback is distinguishable.
      expect(component.exerciseName('abs.situps')).toBeTruthy();
      expect(component.exerciseName('abs.situps')).not.toBe('abs.situps');
    });

    it('falls back to the raw id for unknown exercise ids', async () => {
      await setup('abs');
      expect(component.exerciseName('unknown.exercise')).toBe(
        'unknown.exercise'
      );
    });
  });

  describe('addAriaLabel()', () => {
    it('returns a non-empty string that includes the exercise name', async () => {
      await setup('abs');
      const label = component.addAriaLabel('abs.situps');
      // Must be a non-trivial string
      expect(label.length).toBeGreaterThan(0);
      // The human-readable name should appear somewhere in the label
      expect(label).toContain(component.exerciseName('abs.situps'));
    });
  });

  describe('openDialog()', () => {
    it('does nothing when no userId is available', async () => {
      await setup('abs');
      userContextMock.userIdSafe.mockReturnValueOnce(null);

      await component.openDialog(
        component.summaries()[0].definition
      );

      expect(dialogMock.open).not.toHaveBeenCalled();
    });

    it('opens EntryDialogComponent for the given exercise', async () => {
      await setup('abs', [sitEntry]);
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(undefined),
      });

      await component.openDialog(
        component.summaries()[0].definition
      );

      expect(dialogMock.open).toHaveBeenCalledTimes(1);
    });

    it('calls createEntry and shows success snack when dialog returns a result', async () => {
      await setup('abs', []);
      const dialogResult = {
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 25,
        sets: [25],
      };
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(dialogResult),
      });

      const absDef = component.summaries().find(
        (s) => s.definition.id === 'abs.situps'
      )!.definition;
      await component.openDialog(absDef);

      expect(exerciseServiceMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          exerciseId: 'abs.situps',
          timestamp: '2026-04-15T10:00:00Z',
          reps: 25,
        })
      );
      expect(snackMock.open).toHaveBeenCalledTimes(1);
    });

    it('does not call createEntry when the dialog is dismissed', async () => {
      await setup('abs');
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(undefined),
      });

      await component.openDialog(
        component.summaries()[0].definition
      );

      expect(exerciseServiceMock.createEntry).not.toHaveBeenCalled();
    });

    it('shows error snack when createEntry rejects with ExerciseValidationError', async () => {
      await setup('abs');
      const dialogResult = {
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 9999,
        sets: [9999],
      };
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(dialogResult),
      });
      exerciseServiceMock.createEntry.mockReturnValueOnce(
        throwError(
          () =>
            new ExerciseValidationError(
              'abs.situps',
              'measurement-value-out-of-range'
            )
        )
      );

      const absDef = component.summaries().find(
        (s) => s.definition.id === 'abs.situps'
      )!.definition;
      await component.openDialog(absDef);

      expect(snackMock.open).toHaveBeenCalledTimes(1);
    });

    it('shows generic error snack when createEntry rejects with an unknown error', async () => {
      await setup('abs');
      const dialogResult = {
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 10,
        sets: [10],
      };
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(dialogResult),
      });
      exerciseServiceMock.createEntry.mockReturnValueOnce(
        throwError(() => new Error('network error'))
      );

      const absDef = component.summaries().find(
        (s) => s.definition.id === 'abs.situps'
      )!.definition;
      await component.openDialog(absDef);

      // A snack must still be shown, even for non-validation errors
      expect(snackMock.open).toHaveBeenCalledTimes(1);
    });

    it('omits sets from the payload when there is only one set', async () => {
      await setup('abs');
      const dialogResult = {
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 25,
        sets: [25], // single set → not persisted
      };
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(dialogResult),
      });

      const absDef = component.summaries().find(
        (s) => s.definition.id === 'abs.situps'
      )!.definition;
      await component.openDialog(absDef);

      const call = exerciseServiceMock.createEntry.mock.calls[0]?.[1];
      expect(call?.sets).toBeUndefined();
    });

    it('includes sets in the payload when there are multiple sets', async () => {
      await setup('abs');
      const dialogResult = {
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 30,
        sets: [10, 10, 10],
      };
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(dialogResult),
      });

      const absDef = component.summaries().find(
        (s) => s.definition.id === 'abs.situps'
      )!.definition;
      await component.openDialog(absDef);

      const call = exerciseServiceMock.createEntry.mock.calls[0]?.[1];
      expect(call?.sets).toEqual([10, 10, 10]);
    });
  });

  describe('Given an unknown category id is supplied', () => {
    it('renders nothing when categoryInfo() is null', async () => {
      // 'plank' is in ExerciseCategoryId type but not in Phase-0 catalog
      // so categoryInfo() returns null → the @if block is falsy
      vitest.clearAllMocks();
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ExerciseCategorySectionComponent],
        providers: [
          { provide: ExerciseFirestoreService, useValue: exerciseServiceMock },
          { provide: UserContextService, useValue: userContextMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MatSnackBar, useValue: snackMock },
        ],
      }).compileComponents();

      // Use a category that exists in the type union but not in Phase-0 categories
      const f = TestBed.createComponent(ExerciseCategorySectionComponent);
      f.componentRef.setInput('categoryId', 'plank');
      await f.whenStable();
      f.detectChanges();

      const card = f.nativeElement.querySelector('mat-card');
      // `plank` is not in Phase-0 EXERCISE_CATEGORIES so categoryInfo() returns null
      expect(card).toBeNull();
    });
  });
});
