import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import {
  TrainingEntryDialogComponent,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from './training-entry-dialog.component';

describe('TrainingEntryDialogComponent', () => {
  function createDialog(data: TrainingEntryDialogData | null): {
    component: TrainingEntryDialogComponent;
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
      ],
    });
    const fixture = TestBed.createComponent(TrainingEntryDialogComponent);
    return { component: fixture.componentInstance, closeSpy };
  }

  describe('create mode (no edit data)', () => {
    it('defaults to the pushup category and synthetic exercise id', () => {
      const { component } = createDialog(null);

      expect(component.category()).toBe('pushup');
      expect(component.mode()).toBe('pushup');
      expect(component.isEditMode).toBe(false);
    });

    it('switching the category resets the exercise picker and the value fields', () => {
      const { component } = createDialog(null);

      component.sets.set([20]);
      component.onCategoryChange('plank');

      expect(component.category()).toBe('plank');
      expect(component.mode()).toBe('exercise');
      expect(component.exerciseId()).toBe('plank.standard');
      // Reps/sets must reset so a stale 20-rep value can't bleed into
      // the new measurement-specific form.
      expect(component.sets()).toEqual([0]);
    });

    it('emits a pushup result when category=pushup and reps are entered', () => {
      const { component, closeSpy } = createDialog(null);

      component.timestamp.set('2026-02-10T13:45');
      component.updateSet(0, '20');
      component.pushupTypeControl.setValue('diamond');
      component.sourceControl.setValue('web');

      expect(component.canSubmit()).toBe(true);
      component.submit();

      expect(closeSpy).toHaveBeenCalledTimes(1);
      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      expect(result).toMatchObject({
        kind: 'pushup',
        reps: 20,
        sets: [20],
        type: 'diamond',
        source: 'web',
      });
      // Result preserves the user-entered local time with the local
      // offset appended so the Firestore doc matches the user's tz.
      expect(result.timestamp).toMatch(/^2026-02-10T13:45/);
    });

    it('emits an exercise result with durationSec for the plank category', () => {
      const { component, closeSpy } = createDialog(null);

      component.onCategoryChange('plank');
      component.timestamp.set('2026-02-10T13:45');
      component.durationMinutesInput.set('1');
      component.durationSecondsInput.set('30');

      expect(component.canSubmit()).toBe(true);
      component.submit();

      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      expect(result).toMatchObject({
        kind: 'exercise',
        exerciseId: 'plank.standard',
        measurement: 'time',
        durationSec: 90,
        reps: 0,
        sets: [],
      });
    });

    it('emits an exercise result with distance + duration for cardio.running', () => {
      const { component, closeSpy } = createDialog(null);

      component.onCategoryChange('cardio');
      component.timestamp.set('2026-02-10T13:45');
      component.distanceInput.set('5.25');
      component.durationMinutesInput.set('25');
      component.durationSecondsInput.set('0');

      expect(component.canSubmit()).toBe(true);
      component.submit();

      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      expect(result).toMatchObject({
        kind: 'exercise',
        exerciseId: 'cardio.running',
        measurement: 'distance-time',
        // 5.25 km → 5250 m (rounded to integer meters because the
        // catalog stores distanceM as integer).
        distanceM: 5250,
        durationSec: 1500,
      });
    });

    it('clears the variant control and value fields when the exercise picker changes', () => {
      const { component } = createDialog(null);

      component.onCategoryChange('abs');
      component.variantControl.setValue('weighted');
      component.updateSet(0, '12');

      // Simulate the picker switching to a different exercise within
      // the same category. The variant id from the previous exercise
      // would otherwise survive and be rejected as `invalid-variant`
      // by the data-access validator on submit.
      component.onExerciseChange('legs.squats');

      expect(component.variantControl.value).toBe('');
      expect(component.sets()).toEqual([0]);
    });

    it('caps reps at the catalog max for the chosen exercise', () => {
      const { component } = createDialog(null);

      component.onCategoryChange('abs');
      component.updateSet(0, '9999');

      // abs.situps caps at 500 — typing a higher value clamps so
      // canSubmit() never reports green for an out-of-range entry.
      expect(component.sets()[0]).toBe(500);
      expect(component.overCap()).toBe(false);
    });
  });

  describe('edit mode', () => {
    it('populates the form from a pushup edit payload and locks the category picker', () => {
      const { component } = createDialog({
        kind: 'pushup',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 30,
        sets: [10, 10, 10],
        source: 'whatsapp',
        type: 'diamond',
      });

      expect(component.isEditMode).toBe(true);
      expect(component.category()).toBe('pushup');
      expect(component.sets()).toEqual([10, 10, 10]);
      expect(component.pushupTypeControl.value).toBe('diamond');
      expect(component.sourceControl.value).toBe('whatsapp');
      // Edit mode must not allow moving an entry between collections,
      // so the category-change handler is a no-op.
      component.onCategoryChange('plank');
      expect(component.category()).toBe('pushup');
    });

    it('preserves the original ISO timestamp when the user does not touch the field', () => {
      const { component, closeSpy } = createDialog({
        kind: 'pushup',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 20,
        sets: [20],
      });

      component.submit();

      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      // Untouched timestamp keeps its full original ISO form (with
      // seconds + offset). Re-serializing would silently drop the
      // seconds and could shift the offset in another tz.
      expect(result.timestamp).toBe('2026-02-10T13:45:00+01:00');
    });

    it('populates the form from an exercise edit payload (plank)', () => {
      const { component } = createDialog({
        kind: 'exercise',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T13:45:00+01:00',
        durationSec: 90,
      });

      expect(component.category()).toBe('plank');
      expect(component.exerciseId()).toBe('plank.standard');
      expect(component.mode()).toBe('exercise');
      expect(component.isTimeMeasurement()).toBe(true);
      expect(component.durationMinutesInput()).toBe('1');
      expect(component.durationSecondsInput()).toBe('30');
    });

    it('emits a null variantId when the user clears a previously-set variant', () => {
      const { component, closeSpy } = createDialog({
        kind: 'exercise',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 30,
        sets: [30],
        variantId: 'weighted',
      });

      component.variantControl.setValue('');
      component.submit();

      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      // Tri-state: explicit null is the patch sentinel that tells the
      // store to issue a Firestore deleteField() instead of leaving
      // the stale variant on the doc.
      expect(result.variantId).toBeNull();
    });

    it('keeps an exercise-kind entry in exercise mode when the catalog id is stale', () => {
      // Regression: a renamed/removed catalog id used to flip the
      // dialog into pushup mode and corrupt the emitted payload shape
      // on submit.
      const { component, closeSpy } = createDialog({
        kind: 'exercise',
        exerciseId: 'abs.removed-variant',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 25,
        sets: [25],
      });

      expect(component.mode()).toBe('exercise');
      // Category prefix `'abs.…'` recovers the right dashboard
      // category even though the specific exercise no longer exists.
      expect(component.category()).toBe('abs');
      // The synthetic fallback definition lets the user fix and resubmit
      // the entry without staring at a frozen dialog.
      expect(component.canSubmit()).toBe(true);

      component.submit();
      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      expect(result.kind).toBe('exercise');
      expect(result.exerciseId).toBe('abs.removed-variant');
    });
  });
});
