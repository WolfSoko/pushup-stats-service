import { LOCALE_ID, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import {
  ExerciseEntryDialogResult,
  TrainingEntryDialogComponent,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from './training-entry-dialog.component';

describe('TrainingEntryDialogComponent', () => {
  function createDialog(
    data: TrainingEntryDialogData | null,
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
    return { component: fixture.componentInstance, fixture, closeSpy };
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
      component.onCategoryChange('core');

      expect(component.category()).toBe('core');
      expect(component.mode()).toBe('exercise');
      // First catalog entry in the core category becomes the picker default.
      expect(component.exerciseId()).toBe('abs.situps');
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

    it('emits an exercise result with durationSec when plank is picked under core', () => {
      const { component, closeSpy } = createDialog(null);

      component.onCategoryChange('core');
      // Plank lives in the core category now — switch the picker to it
      // explicitly because the category default is the first reps-based
      // entry (`abs.situps`), not the time-measurement plank row.
      component.onExerciseChange('plank.standard');
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

    it('accepts a German decimal comma in the km input (5,25 → 5250 m)', () => {
      const { component, fixture, closeSpy } = createDialog(null, [
        { provide: LOCALE_ID, useValue: 'de-DE' },
      ]);

      component.onCategoryChange('cardio');
      fixture.detectChanges();

      // The km input must use type="text" + inputmode="decimal" — a
      // native type="number" input rejects "," in most browsers
      // regardless of locale, so a German user who types the local
      // decimal separator would see their input silently dropped.
      const distanceEl: HTMLInputElement = fixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );
      expect(distanceEl).toBeTruthy();
      expect(distanceEl.type).toBe('text');
      expect(distanceEl.inputMode).toBe('decimal');

      distanceEl.value = '5,25';
      distanceEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      component.timestamp.set('2026-02-10T13:45');
      component.durationMinutesInput.set('25');
      component.durationSecondsInput.set('0');

      expect(component.distanceM()).toBe(5250);
      expect(component.canSubmit()).toBe(true);
      component.submit();

      const result = closeSpy.mock.calls[0][0] as TrainingEntryDialogResult;
      expect(result).toMatchObject({
        distanceM: 5250,
        durationSec: 1500,
      });
    });

    it('renders a locale-aware placeholder for the km input', () => {
      const { fixture: deFixture } = createDialog(null, [
        { provide: LOCALE_ID, useValue: 'de-DE' },
      ]);
      deFixture.componentInstance.onCategoryChange('cardio');
      deFixture.detectChanges();
      const deInput: HTMLInputElement = deFixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );
      expect(deInput.placeholder).toBe('5,00');

      const { fixture: enFixture } = createDialog(null, [
        { provide: LOCALE_ID, useValue: 'en-US' },
      ]);
      enFixture.componentInstance.onCategoryChange('cardio');
      enFixture.detectChanges();
      const enInput: HTMLInputElement = enFixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );
      expect(enInput.placeholder).toBe('5.00');
    });

    it('clears the variant control and value fields when the exercise picker changes', () => {
      const { component } = createDialog(null);

      component.onCategoryChange('core');
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

      component.onCategoryChange('core');
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
      component.onCategoryChange('core');
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

      expect(component.category()).toBe('core');
      expect(component.exerciseId()).toBe('plank.standard');
      expect(component.mode()).toBe('exercise');
      expect(component.isTimeMeasurement()).toBe(true);
      expect(component.durationMinutesInput()).toBe('1');
      expect(component.durationSecondsInput()).toBe('30');
    });

    it.each([
      // Edit-mode km initial value must match the active locale so the
      // create + edit paths show the same separator. Without this, a
      // de-DE user opening an existing run would see a dot-formatted
      // value while typing fresh entries gets a comma placeholder.
      ['de-DE', '5,25'],
      ['en-US', '5.25'],
    ])(
      'formats the edit-mode km initial value with the active locale (%s)',
      (locale, expected) => {
        const { component } = createDialog(
          {
            kind: 'exercise',
            exerciseId: 'cardio.running',
            timestamp: '2026-02-10T13:45:00+01:00',
            distanceM: 5250,
            durationSec: 1500,
          },
          [{ provide: LOCALE_ID, useValue: locale }]
        );

        expect(component.distanceInput()).toBe(expected);
        // Round-trip: the locale-formatted string must still parse back
        // to the original metres so the edit dialog opens at green.
        expect(component.distanceM()).toBe(5250);
        expect(component.canSubmit()).toBe(true);
      }
    );

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

      const result = closeSpy.mock.calls[0][0] as ExerciseEntryDialogResult;
      // Tri-state: explicit null is the patch sentinel that tells the
      // store to issue a Firestore deleteField() instead of leaving
      // the stale variant on the doc.
      expect(result.variantId).toBeNull();
    });

    it.each([
      // Legacy id prefix → recovered movement-pattern category. The
      // dialog must stay in exercise mode and surface the right
      // dashboard category for stale ids whose catalog entry was
      // renamed or removed.
      ['abs.removed-variant', 'core' as const],
      ['plank.removed-variant', 'core' as const],
      ['legs.removed-variant', 'squat' as const],
    ])(
      'keeps an exercise-kind entry in exercise mode for stale id %s',
      (exerciseId, expectedCategory) => {
        const { component, closeSpy } = createDialog({
          kind: 'exercise',
          exerciseId,
          timestamp: '2026-02-10T13:45:00+01:00',
          reps: 25,
          sets: [25],
        });

        expect(component.mode()).toBe('exercise');
        expect(component.category()).toBe(expectedCategory);
        // The synthetic fallback definition lets the user fix and
        // resubmit the entry without staring at a frozen dialog.
        expect(component.canSubmit()).toBe(true);

        component.submit();
        const result = closeSpy.mock.calls[0][0] as ExerciseEntryDialogResult;
        expect(result.kind).toBe('exercise');
        expect(result.exerciseId).toBe(exerciseId);
      }
    );
  });
});
