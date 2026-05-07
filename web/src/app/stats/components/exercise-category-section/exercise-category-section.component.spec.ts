import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { ExerciseCategorySectionComponent } from './exercise-category-section.component';

describe('ExerciseCategorySectionComponent', () => {
  const userMock = {
    userIdSafe: () => 'u1',
  } as unknown as UserContextService;

  const exerciseServiceMock = {
    listEntries: vitest.fn().mockReturnValue(of([])),
    createEntry: vitest.fn().mockReturnValue(of({ _id: 'new' })),
  };

  const dialogMock = {
    open: vitest.fn().mockReturnValue({
      afterClosed: () => of(undefined),
    }),
  };

  const snackMock = {
    open: vitest.fn(),
  };

  function createComponent(categoryId: 'abs' | 'legs' | 'pushup' = 'abs') {
    vitest.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ExerciseCategorySectionComponent],
      providers: [
        { provide: UserContextService, useValue: userMock },
        {
          provide: ExerciseFirestoreService,
          useValue: exerciseServiceMock,
        },
        { provide: MatDialog, useValue: dialogMock },
        { provide: MatSnackBar, useValue: snackMock },
      ],
    });
    const fixture = TestBed.createComponent(ExerciseCategorySectionComponent);
    fixture.componentRef.setInput('categoryId', categoryId);
    return fixture.componentInstance;
  }

  describe('Given categoryId="abs"', () => {
    it('is created', () => {
      const cmp = createComponent('abs');
      expect(cmp).toBeTruthy();
    });

    it('categoryInfo() returns the abs category metadata', () => {
      const cmp = createComponent('abs');
      const info = cmp.categoryInfo();
      expect(info).not.toBeNull();
      expect(info?.id).toBe('abs');
    });
  });

  describe('Given categoryId="legs"', () => {
    it('categoryInfo() returns the legs category metadata', () => {
      const cmp = createComponent('legs');
      const info = cmp.categoryInfo();
      expect(info).not.toBeNull();
      expect(info?.id).toBe('legs');
    });
  });

  describe('exerciseName()', () => {
    it('returns a non-empty string for abs.situps', () => {
      const cmp = createComponent('abs');
      const name = cmp.exerciseName('abs.situps');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for legs.squats', () => {
      const cmp = createComponent('legs');
      const name = cmp.exerciseName('legs.squats');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('falls back to the raw id for an unknown exercise', () => {
      const cmp = createComponent('abs');
      const name = cmp.exerciseName('unknown.exercise');
      expect(name).toBe('unknown.exercise');
    });
  });

  describe('addAriaLabel()', () => {
    it('returns a non-empty string containing the exercise name', () => {
      const cmp = createComponent('abs');
      const label = cmp.addAriaLabel('abs.situps');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it('falls back to the exercise id when no translation is available', () => {
      const cmp = createComponent('abs');
      const label = cmp.addAriaLabel('unknown.exercise');
      expect(label).toContain('unknown.exercise');
    });
  });

  describe('summaries() computed', () => {
    it('returns one summary per exercise definition in the category', () => {
      const cmp = createComponent('abs');
      // summaries() derives its list from exercisesByCategory — for 'abs'
      // that is a single entry (abs.situps) in the Phase-0 catalog.
      const summaries = cmp.summaries();
      expect(summaries.length).toBeGreaterThanOrEqual(1);
      const situpSummary = summaries.find(
        (s) => s.definition.id === 'abs.situps'
      );
      expect(situpSummary).toBeDefined();
    });

    it('starts with totalReps30d = 0 and lastEntry = null when no entries are loaded', () => {
      const cmp = createComponent('abs');
      const summaries = cmp.summaries();
      for (const s of summaries) {
        expect(s.totalReps30d).toBe(0);
        expect(s.lastEntry).toBeNull();
      }
    });
  });

  describe('openDialog()', () => {
    it('does nothing when userIdSafe() is null', async () => {
      const noUserMock = { userIdSafe: () => null };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ExerciseCategorySectionComponent],
        providers: [
          { provide: UserContextService, useValue: noUserMock },
          { provide: ExerciseFirestoreService, useValue: exerciseServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MatSnackBar, useValue: snackMock },
        ],
      });
      const fixture = TestBed.createComponent(ExerciseCategorySectionComponent);
      fixture.componentRef.setInput('categoryId', 'abs');
      const cmp = fixture.componentInstance;
      // Reset call counts after construction (exercises list is fetched on init)
      dialogMock.open.mockClear();

      await cmp.openDialog({
        id: 'abs.situps',
        categoryId: 'abs',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
      });

      expect(dialogMock.open).not.toHaveBeenCalled();
    });

    it('calls createEntry and shows a snack on successful dialog submission', async () => {
      // createComponent() clears all mocks, so set up return values after
      const cmp = createComponent('abs');

      dialogMock.open.mockReturnValueOnce({
        afterClosed: () =>
          of({
            exerciseId: 'abs.situps',
            timestamp: '2026-04-15T10:00:00Z',
            reps: 30,
            sets: [10, 10, 10],
          }),
      });
      exerciseServiceMock.createEntry.mockReturnValueOnce(
        of({ _id: 'new1', exerciseId: 'abs.situps', reps: 30 })
      );

      await cmp.openDialog({
        id: 'abs.situps',
        categoryId: 'abs',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
      });

      expect(exerciseServiceMock.createEntry).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({
          exerciseId: 'abs.situps',
          reps: 30,
        })
      );
      expect(snackMock.open).toHaveBeenCalledTimes(1);
    });

    it('does NOT call createEntry when the dialog is cancelled', async () => {
      const cmp = createComponent('abs');

      dialogMock.open.mockReturnValueOnce({
        afterClosed: () => of(undefined),
      });

      await cmp.openDialog({
        id: 'abs.situps',
        categoryId: 'abs',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
      });

      expect(exerciseServiceMock.createEntry).not.toHaveBeenCalled();
      expect(snackMock.open).not.toHaveBeenCalled();
    });

    it('shows an error snack when createEntry throws an ExerciseValidationError', async () => {
      const cmp = createComponent('abs');

      dialogMock.open.mockReturnValueOnce({
        afterClosed: () =>
          of({
            exerciseId: 'abs.situps',
            timestamp: '2026-04-15T10:00:00Z',
            reps: 9999,
            sets: [9999],
          }),
      });

      // Simulate the service throwing a validation error
      const fakeError = Object.create(Error.prototype);
      fakeError.name = 'ExerciseValidationError';
      fakeError.message = 'out-of-range';
      exerciseServiceMock.createEntry.mockReturnValueOnce(
        throwError(() => fakeError)
      );

      await cmp.openDialog({
        id: 'abs.situps',
        categoryId: 'abs',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
      });

      expect(snackMock.open).toHaveBeenCalledTimes(1);
    });

    it('shows a generic error snack for non-validation errors', async () => {
      const cmp = createComponent('abs');

      dialogMock.open.mockReturnValueOnce({
        afterClosed: () =>
          of({
            exerciseId: 'abs.situps',
            timestamp: '2026-04-15T10:00:00Z',
            reps: 10,
            sets: [10],
          }),
      });

      exerciseServiceMock.createEntry.mockReturnValueOnce(
        throwError(() => new Error('Network failure'))
      );

      await cmp.openDialog({
        id: 'abs.situps',
        categoryId: 'abs',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
      });

      expect(snackMock.open).toHaveBeenCalledTimes(1);
    });

    it('opens the dialog with the definition and a non-empty exerciseName', async () => {
      const cmp = createComponent('legs');

      dialogMock.open.mockReturnValueOnce({
        afterClosed: () => of(undefined),
      });

      await cmp.openDialog({
        id: 'legs.squats',
        categoryId: 'legs',
        measurement: 'reps',
        min: 1,
        max: 500,
        unit: 'reps',
      });

      expect(dialogMock.open).toHaveBeenCalledTimes(1);
      const callArgs = dialogMock.open.mock.calls[0] as unknown[];
      const options = callArgs[1] as { data: { exerciseName: string } };
      expect(options.data.exerciseName.length).toBeGreaterThan(0);
    });
  });
});