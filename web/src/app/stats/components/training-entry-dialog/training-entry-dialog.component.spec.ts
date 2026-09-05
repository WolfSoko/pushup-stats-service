import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';

import { TrainingEntryDialogComponent } from './training-entry-dialog.component';
import {
  ExerciseEntryDialogResult,
  TrainingEntryDialogInput,
  TrainingEntryDialogResult,
} from './training-entry-dialog.models';

describe('TrainingEntryDialogComponent', () => {
  function createDialog(
    data: TrainingEntryDialogInput,
    extraProviders: Provider[] = []
  ): {
    component: TrainingEntryDialogComponent;
    fixture: ComponentFixture<TrainingEntryDialogComponent>;
    closeSpy: ReturnType<typeof vitest.fn>;
  } {
    TestBed.resetTestingModule();
    const closeSpy = vitest.fn();
    TestBed.configureTestingModule({
      imports: [TrainingEntryDialogComponent],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: closeSpy } },
        ...extraProviders,
      ],
    });
    const fixture = TestBed.createComponent(TrainingEntryDialogComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture, closeSpy };
  }

  describe('create mode', () => {
    it('should default to pushups without suggestions', () => {
      // given / when
      const { component } = createDialog(null);

      // then
      expect(component.exerciseId()).toBe('pushup');
      expect(component.category()).toBe('pushup');
      expect(component.mode()).toBe('pushup');
      expect(component.isEditMode).toBe(false);
    });

    it('should open on the first planned exercise', () => {
      // given / when
      const { component } = createDialog({
        kind: 'create',
        suggestions: {
          plannedExerciseIds: ['legs.squats'],
          recentExerciseIds: ['abs.situps'],
        },
      });

      // then
      expect(component.exerciseId()).toBe('legs.squats');
      expect(component.category()).toBe('squat');
      expect(component.mode()).toBe('exercise');
    });

    it('should open on a timed exercise with the stopped seconds prefilled and keep them across a switch', () => {
      // given
      const { component, fixture } = createDialog({
        kind: 'create',
        suggestions: {},
        measurements: ['time', 'distance-time'],
        durationSec: 95,
      });
      const durationOf = (): number | null | undefined =>
        (
          fixture.debugElement.query(
            (el) => el.name === 'app-exercise-entry-fields'
          )?.componentInstance as {
            state: { durationSec: () => number | null };
          }
        )?.state.durationSec();

      // then — a timed exercise, not pushups, and the time is in the fields
      expect(component.isEditMode).toBe(false);
      expect(component.mode()).toBe('exercise');
      expect(component.measurements).toEqual(['time', 'distance-time']);
      expect(durationOf()).toBe(95);

      // when
      component.onExerciseChange('core.mountainclimbers.time');
      fixture.detectChanges();

      // then
      expect(component.exerciseId()).toBe('core.mountainclimbers.time');
      expect(durationOf()).toBe(95);
      expect(component.canSubmit()).toBe(true);
    });

    it('should switch to exercise mode when another exercise is picked', () => {
      // given
      const { component, fixture } = createDialog(null);

      // when
      component.onExerciseChange('abs.situps');
      fixture.detectChanges();

      // then
      expect(component.category()).toBe('core');
      expect(component.mode()).toBe('exercise');
    });

    it('should close with a pushup result when reps are entered', () => {
      // given
      const { component, fixture, closeSpy } = createDialog(null);
      component.timestamp.set('2026-02-10T13:45');
      const root: HTMLElement = fixture.nativeElement;
      const repsEl: HTMLInputElement = root.querySelector(
        'app-pushup-entry-fields input[type="number"]'
      ) as HTMLInputElement;
      repsEl.value = '20';
      repsEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // when
      expect(component.canSubmit()).toBe(true);
      component.submit();

      // then
      expect(closeSpy).toHaveBeenCalledTimes(1);
      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      expect(result).toMatchObject({ kind: 'pushup', reps: 20, sets: [20] });
      // Preserves the user-entered local time with the local offset.
      expect(result.timestamp).toMatch(/^2026-02-10T13:45/);
    });

    it('should close with an exercise result when an exercise is filled', () => {
      // given
      const { component, fixture, closeSpy } = createDialog(null);
      component.onExerciseChange('abs.situps');
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const repsEl: HTMLInputElement = root.querySelector(
        'app-exercise-entry-fields input[type="number"]'
      ) as HTMLInputElement;
      repsEl.value = '12';
      repsEl.dispatchEvent(new Event('input'));
      component.timestamp.set('2026-02-10T13:45');
      fixture.detectChanges();

      // when
      expect(component.canSubmit()).toBe(true);
      component.submit();

      // then
      const result = closeSpy.mock.calls[0][0] as ExerciseEntryDialogResult;
      expect(result).toMatchObject({
        kind: 'exercise',
        exerciseId: 'abs.situps',
        reps: 12,
        sets: [12],
        intervals: [],
      });
    });

    it('should drop entered reps when the exercise is switched', () => {
      // given
      const { component, fixture } = createDialog(null);
      component.onExerciseChange('abs.situps');
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const repsEl: HTMLInputElement = root.querySelector(
        'app-exercise-entry-fields input[type="number"]'
      ) as HTMLInputElement;
      repsEl.value = '12';
      repsEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(component.canSubmit()).toBe(true);

      // when
      component.onExerciseChange('legs.squats');
      fixture.detectChanges();

      // then
      expect(component.canSubmit()).toBe(false);
    });
  });

  describe('edit mode', () => {
    it('should lock the exercise picker and stay on the original exercise', () => {
      // given
      const { component, fixture } = createDialog({
        kind: 'pushup',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 30,
        sets: [10, 10, 10],
        source: 'whatsapp',
        type: 'diamond',
      });

      // then
      expect(component.isEditMode).toBe(true);
      expect(component.exerciseId()).toBe('pushup');
      const input: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="training-entry-exercise"]'
      );
      expect(input.disabled).toBe(true);

      // when — the change handler is a no-op in edit mode.
      component.onExerciseChange('abs.situps');

      // then
      expect(component.exerciseId()).toBe('pushup');
    });

    it('should preserve the original ISO timestamp when untouched', () => {
      // given
      const { component, closeSpy } = createDialog({
        kind: 'pushup',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 20,
        sets: [20],
      });

      // when
      component.submit();

      // then — untouched timestamp keeps its full original ISO form.
      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      expect(result.timestamp).toBe('2026-02-10T13:45:00+01:00');
    });

    it('should open in exercise mode for a stale exercise id', () => {
      // given / when
      const { component } = createDialog({
        kind: 'exercise',
        exerciseId: 'abs.removed-variant',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 25,
        sets: [25],
      });

      // then
      expect(component.mode()).toBe('exercise');
      expect(component.category()).toBe('core');
      expect(component.canSubmit()).toBe(true);
    });
  });
});
