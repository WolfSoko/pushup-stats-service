import { TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { Mock } from 'vitest';
import {
  ExerciseEntryDialogComponent,
  ExerciseEntryDialogData,
  ExerciseEntryDialogResult,
} from './exercise-entry-dialog.component';

describe('ExerciseEntryDialogComponent', () => {
  let dialogRef: { close: Mock };

  function createComponent(
    data: ExerciseEntryDialogData = {
      exerciseId: 'abs.situps',
      exerciseName: 'Sit-ups',
    }
  ): ExerciseEntryDialogComponent {
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ExerciseEntryDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ExerciseEntryDialogComponent);
    return fixture.componentInstance;
  }

  describe('Given the dialog opens for sit-ups with default state', () => {
    it('starts with one empty set and totalReps 0', () => {
      const cmp = createComponent();
      expect(cmp.sets()).toEqual([0]);
      expect(cmp.totalReps()).toBe(0);
      expect(cmp.canSubmit()).toBe(false);
    });
  });

  describe('When the user enters reps and submits', () => {
    it('closes the dialog with the entered reps and the dialog data exerciseId', () => {
      const cmp = createComponent({
        exerciseId: 'legs.squats',
        exerciseName: 'Kniebeugen',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.updateSet(0, '25');
      expect(cmp.canSubmit()).toBe(true);

      cmp.submit();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      const result = dialogRef.close.mock
        .calls[0][0] as ExerciseEntryDialogResult;
      expect(result.exerciseId).toBe('legs.squats');
      expect(result.reps).toBe(25);
      expect(result.sets).toEqual([25]);
      expect(result.timestamp.startsWith('2026-04-15T10:00')).toBe(true);
    });
  });

  describe('When the user adds multiple sets', () => {
    it('sums valid sets into totalReps and emits them on submit', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '10');
      cmp.addSet();
      cmp.updateSet(1, '15');
      cmp.addSet();
      cmp.updateSet(2, '20');
      expect(cmp.totalReps()).toBe(45);
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.submit();

      const result = dialogRef.close.mock
        .calls[0][0] as ExerciseEntryDialogResult;
      expect(result.reps).toBe(45);
      expect(result.sets).toEqual([10, 15, 20]);
    });

    it('drops sets equal to zero from the persisted result', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '10');
      cmp.addSet();
      cmp.updateSet(1, '0');
      cmp.addSet();
      cmp.updateSet(2, '20');
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.submit();

      const result = dialogRef.close.mock
        .calls[0][0] as ExerciseEntryDialogResult;
      expect(result.sets).toEqual([10, 20]);
      expect(result.reps).toBe(30);
    });
  });

  describe('Given the input clamps to non-negative integers', () => {
    it('Then a fractional value is floored', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '5.7');
      expect(cmp.sets()[0]).toBe(5);
    });

    it('Then a negative value is clamped to 0', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '-3');
      expect(cmp.sets()[0]).toBe(0);
    });

    it('Then a non-numeric value falls back to 0', () => {
      const cmp = createComponent();
      cmp.updateSet(0, 'abc');
      expect(cmp.sets()[0]).toBe(0);
    });
  });

  describe('When the user removes a set', () => {
    it('keeps a single empty set after removing the last one', () => {
      const cmp = createComponent();
      cmp.addSet();
      expect(cmp.sets().length).toBe(2);
      cmp.removeSet(0);
      expect(cmp.sets().length).toBe(1);
      cmp.removeSet(0);
      expect(cmp.sets()).toEqual([0]);
    });
  });

  describe('Given the user has not entered any reps', () => {
    it('disables submit and does not close the dialog', () => {
      const cmp = createComponent();
      cmp.timestamp.set('2026-04-15T10:00');
      expect(cmp.canSubmit()).toBe(false);
      cmp.submit();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('Edit-mode prefill via initial', () => {
    it('binds timestamp and a multi-set breakdown from initial', () => {
      const cmp = createComponent({
        exerciseId: 'abs.situps',
        exerciseName: 'Sit-ups',
        initial: {
          timestamp: '2026-04-15T10:30:00+02:00',
          reps: 30,
          sets: [10, 10, 10],
        },
      });
      // datetime-local strips seconds + offset (16-char prefix).
      expect(cmp.timestamp()).toBe('2026-04-15T10:30');
      expect(cmp.sets()).toEqual([10, 10, 10]);
      expect(cmp.totalReps()).toBe(30);
      expect(cmp.canSubmit()).toBe(true);
    });

    it('falls back to a single set carrying initial.reps when sets is omitted', () => {
      const cmp = createComponent({
        exerciseId: 'legs.squats',
        exerciseName: 'Kniebeugen',
        initial: {
          timestamp: '2026-04-15T08:00:00+02:00',
          reps: 25,
        },
      });
      expect(cmp.sets()).toEqual([25]);
      expect(cmp.canSubmit()).toBe(true);
    });

    it('preserves the original ISO timestamp when the user did not edit it', () => {
      const cmp = createComponent({
        exerciseId: 'abs.situps',
        exerciseName: 'Sit-ups',
        initial: {
          timestamp: '2026-04-15T10:30:00+02:00',
          reps: 30,
          sets: [10, 10, 10],
        },
      });
      cmp.submit();
      const result = dialogRef.close.mock
        .calls[0][0] as ExerciseEntryDialogResult;
      expect(result.timestamp).toBe('2026-04-15T10:30:00+02:00');
      expect(result.reps).toBe(30);
      expect(result.sets).toEqual([10, 10, 10]);
    });

    it('appends the local offset when the user adjusts the timestamp', () => {
      const cmp = createComponent({
        exerciseId: 'abs.situps',
        exerciseName: 'Sit-ups',
        initial: {
          timestamp: '2026-04-15T10:30:00+02:00',
          reps: 30,
          sets: [10, 10, 10],
        },
      });
      cmp.timestamp.set('2026-04-15T11:00');
      cmp.submit();
      const result = dialogRef.close.mock
        .calls[0][0] as ExerciseEntryDialogResult;
      expect(result.timestamp.startsWith('2026-04-15T11:00')).toBe(true);
      expect(result.timestamp).not.toBe('2026-04-15T10:30:00+02:00');
    });
  });
});
