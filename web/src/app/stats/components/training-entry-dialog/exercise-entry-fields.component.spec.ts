import {
  Component,
  LOCALE_ID,
  Provider,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter } from '@angular/router';
import { ExerciseCategoryId, findExerciseDefinition } from '@pu-stats/models';

// test-setup.ts also registers `fr`, but the Angular vitest builder
// doesn't reliably pick that up for the `fr-FR` region key in this spec.
registerLocaleData(localeFr, 'fr-FR');

import { ExerciseEntryFieldsComponent } from './exercise-entry-fields.component';
import { inferExerciseCategory } from './training-entry-dialog.helpers';
import {
  ExerciseEntryDialogResult,
  TrainingEntryDialogData,
} from './training-entry-dialog.models';

@Component({
  selector: 'app-host',
  imports: [ExerciseEntryFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<app-exercise-entry-fields [exerciseId]="exerciseId()" [category]="category()" [data]="data" [isEditMode]="isEditMode" />',
})
class HostComponent {
  readonly exerciseId = signal<string>('abs.situps');
  readonly category = signal<ExerciseCategoryId>('core');
  data: TrainingEntryDialogData | null = null;
  isEditMode = false;
}

// Mirrors how the dialog derives the category from the picked exercise.
function categoryFor(exerciseId: string): ExerciseCategoryId {
  return (
    findExerciseDefinition(exerciseId)?.categoryId ??
    inferExerciseCategory(exerciseId)
  );
}

describe('ExerciseEntryFieldsComponent', () => {
  function render(
    exerciseId: string,
    data: TrainingEntryDialogData | null,
    extraProviders: Provider[] = []
  ): {
    component: ExerciseEntryFieldsComponent;
    host: HostComponent;
    fixture: ComponentFixture<HostComponent>;
    switchExercise: (id: string) => void;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([]), ...extraProviders],
    });
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.exerciseId.set(exerciseId);
    host.category.set(categoryFor(exerciseId));
    host.data = data;
    host.isEditMode = !!data;
    fixture.detectChanges();
    const component = fixture.debugElement.children[0]
      .componentInstance as ExerciseEntryFieldsComponent;
    const switchExercise = (id: string): void => {
      host.exerciseId.set(id);
      host.category.set(categoryFor(id));
      fixture.detectChanges();
    };
    return { component, host, fixture, switchExercise };
  }

  describe('create mode', () => {
    it('should start empty for the exercise the parent selected', () => {
      // given / when
      const { component } = render('abs.situps', null);

      // then
      expect(component.state.currentDefinition()?.id).toBe('abs.situps');
      expect(component.state.sets()).toEqual([0]);
    });

    it('should reset the value fields when the parent switches exercise', () => {
      // given
      const { component, switchExercise } = render('abs.situps', null);
      component.state.updateSet(0, '20');

      // when
      switchExercise('legs.squats');

      // then
      expect(component.state.currentDefinition()?.id).toBe('legs.squats');
      expect(component.state.sets()).toEqual([0]);
    });

    it('should emit a time result with durationSec for plank', () => {
      // given
      const { component } = render('plank.standard', null);
      component.state.durationMinutesInput.set('1');
      component.state.durationSecondsInput.set('30');

      // when
      expect(component.canSubmit()).toBe(true);
      const result = component.buildResult(
        '2026-02-10T13:45'
      ) as ExerciseEntryDialogResult;

      // then
      expect(result).toMatchObject({
        kind: 'exercise',
        exerciseId: 'plank.standard',
        measurement: 'time',
        durationSec: 90,
        reps: 0,
        sets: [],
      });
    });

    it('should emit a distance-time result for cardio.running', () => {
      // given
      const { component } = render('cardio.running', null);
      component.state.distanceInput.set('5.25');
      component.state.durationMinutesInput.set('25');
      component.state.durationSecondsInput.set('0');

      // when
      expect(component.canSubmit()).toBe(true);
      const result = component.buildResult(
        '2026-02-10T13:45'
      ) as ExerciseEntryDialogResult;

      // then
      expect(result).toMatchObject({
        kind: 'exercise',
        exerciseId: 'cardio.running',
        measurement: 'distance-time',
        distanceM: 5250,
        durationSec: 1500,
      });
    });

    it('should accept a German decimal comma in the km input', () => {
      // given
      const { component, fixture } = render('cardio.running', null, [
        { provide: LOCALE_ID, useValue: 'de-DE' },
      ]);

      // when — the km input is type="text" + inputmode="decimal".
      const distanceEl: HTMLInputElement = fixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );
      expect(distanceEl.type).toBe('text');
      expect(distanceEl.inputMode).toBe('decimal');
      distanceEl.value = '5,25';
      distanceEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      component.state.durationMinutesInput.set('25');
      component.state.durationSecondsInput.set('0');

      // then
      expect(component.state.distanceM()).toBe(5250);
      expect(component.canSubmit()).toBe(true);
    });

    it.each([
      ['de-DE', '1.234,56', 1234560],
      ['en-US', '1,234.56', 1234560],
      ['fr-FR', '1 234,56', 1234560],
      ['fr-FR', '1 234,56', 1234560],
    ])(
      'should parse km input with thousand separators (%s "%s")',
      (locale, input, expectedM) => {
        // given
        const { component } = render('cardio.running', null, [
          { provide: LOCALE_ID, useValue: locale },
        ]);

        // when
        component.state.distanceInput.set(input);

        // then
        expect(component.state.distanceM()).toBe(expectedM);
      }
    );

    it.each(['1.2.3', '1,2,3', '5..25', 'abc'])(
      'should reject malformed km input %j',
      (input) => {
        // given
        const { component } = render('cardio.running', null);

        // when
        component.state.distanceInput.set(input);
        component.state.durationMinutesInput.set('25');
        component.state.durationSecondsInput.set('0');

        // then
        expect(component.state.distanceM()).toBeNull();
        expect(component.canSubmit()).toBe(false);
      }
    );

    it('should render a locale-aware km placeholder', () => {
      // given / when
      const { fixture: deFixture } = render('cardio.running', null, [
        { provide: LOCALE_ID, useValue: 'de-DE' },
      ]);
      const deInput: HTMLInputElement = deFixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );

      const { fixture: enFixture } = render('cardio.running', null, [
        { provide: LOCALE_ID, useValue: 'en-US' },
      ]);
      const enInput: HTMLInputElement = enFixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );

      // then
      expect(deInput.placeholder).toBe('5,00');
      expect(enInput.placeholder).toBe('5.00');
    });

    it('should reset the variant to the new default when the parent switches exercise', () => {
      // given
      const { component, switchExercise } = render('abs.situps', null);
      component.state.variantControl.setValue('weighted');
      component.state.updateSet(0, '12');

      // when a different exercise is picked
      switchExercise('legs.squats');

      // then the stale variant is gone and the new exercise's default
      // ('bodyweight' for squats) is preselected rather than an empty
      // picker — a squat variant id could never be 'weighted' anyway.
      expect(component.state.variantControl.value).toBe('bodyweight');
      expect(component.state.sets()).toEqual([0]);
    });

    it('should preselect the default variant for a fresh entry', () => {
      // given / when a create-mode dialog opens with no seed data
      const { component } = render('legs.squats', null);

      // then the catalog's first variant is already selected, so a plain
      // squat is logged with a variant instead of none.
      expect(component.state.variantControl.value).toBe('bodyweight');
    });

    it('should cap reps at the catalog max for the chosen exercise', () => {
      // given
      const { component } = render('abs.situps', null);

      // when
      component.state.updateSet(0, '9999');

      // then — abs.situps caps at 500.
      expect(component.state.sets()[0]).toBe(500);
      expect(component.state.overCap()).toBe(false);
    });
  });

  describe('intervals (endurance breakdown)', () => {
    function breakdownLabels(
      fixture: ComponentFixture<HostComponent>
    ): string[] {
      const root: HTMLElement = fixture.nativeElement;
      return Array.from(root.querySelectorAll('mat-label')).map((el) =>
        (el.textContent ?? '').trim()
      );
    }

    it('should label a single-set strength row as "Reps"', () => {
      // given / when
      const { fixture } = render('abs.situps', null);

      // then
      const labels = breakdownLabels(fixture);
      expect(labels).toContain('Reps');
      expect(labels.every((l) => !l.startsWith('Intervall'))).toBe(true);
    });

    it('should label endurance rows as "Intervall N" with two intervals', () => {
      // given
      const { component, fixture } = render('plank.standard', null);

      // when
      component.state.addInterval();
      fixture.detectChanges();

      // then
      const labels = breakdownLabels(fixture);
      expect(labels).toContain('Intervall 1');
      expect(labels).toContain('Intervall 2');
      expect(labels.every((l) => !l.startsWith('Set '))).toBe(true);
    });

    it('should submit intervals on an endurance payload', () => {
      // given
      const { component } = render('plank.standard', null);
      component.state.durationMinutesInput.set('1');
      component.state.durationSecondsInput.set('30');
      component.state.updateInterval(0, '30');
      component.state.addInterval();
      component.state.updateInterval(1, '30');
      component.state.addInterval();
      component.state.updateInterval(2, '30');

      // when
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then
      expect(result).toMatchObject({
        measurement: 'time',
        durationSec: 90,
        intervals: [30, 30, 30],
        sets: [],
        reps: 0,
      });
    });

    it('should emit empty intervals when none were entered', () => {
      // given
      const { component } = render('plank.standard', null);
      component.state.durationMinutesInput.set('1');
      component.state.durationSecondsInput.set('30');

      // when
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then
      expect(result.intervals).toEqual([]);
      expect(result.sets).toEqual([]);
    });

    it('should write sets only and keep intervals empty for strength', () => {
      // given
      const { component } = render('abs.situps', null);
      component.state.updateSet(0, '12');

      // when
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then
      expect(result).toMatchObject({
        measurement: 'reps',
        reps: 12,
        sets: [12],
        intervals: [],
      });
    });

    it('should clear stale intervals when switching to a strength exercise', () => {
      // given
      const { component, switchExercise } = render('plank.standard', null);
      component.state.updateInterval(0, '45');
      component.state.addInterval();
      component.state.updateInterval(1, '45');

      // when
      switchExercise('abs.situps');

      // then
      expect(component.state.intervals()).toEqual([0]);
      expect(component.state.sets()).toEqual([0]);
    });
  });

  describe('edit mode', () => {
    it('should leave the variant empty for an entry stored without one', () => {
      // given / when an existing entry that predates the variant picker
      // is opened for editing
      const { component } = render('legs.squats', {
        kind: 'exercise',
        exerciseId: 'legs.squats',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 20,
      });

      // then no default is filled in: buildVariantPatch diffs against the
      // seeded value, so preselecting one here would silently write a
      // variant onto the entry the next time the user saves it.
      expect(component.state.variantControl.value).toBe('');
    });

    it('should populate the form from a plank edit payload', () => {
      // given / when
      const { component } = render('plank.standard', {
        kind: 'exercise',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T13:45:00+01:00',
        durationSec: 90,
      });

      // then
      expect(component.state.currentDefinition()?.id).toBe('plank.standard');
      expect(component.state.isTimeMeasurement()).toBe(true);
      expect(component.state.durationMinutesInput()).toBe('1');
      expect(component.state.durationSecondsInput()).toBe('30');
    });

    it.each([
      ['de-DE', '5,25'],
      ['en-US', '5.25'],
    ])(
      'should format the edit-mode km initial value for %s',
      (locale, expected) => {
        // given / when
        const { component } = render(
          'cardio.running',
          {
            kind: 'exercise',
            exerciseId: 'cardio.running',
            timestamp: '2026-02-10T13:45:00+01:00',
            distanceM: 5250,
            durationSec: 1500,
          },
          [{ provide: LOCALE_ID, useValue: locale }]
        );

        // then
        expect(component.state.distanceInput()).toBe(expected);
        expect(component.state.distanceM()).toBe(5250);
        expect(component.canSubmit()).toBe(true);
      }
    );

    it('should round-trip a fr-FR formatted km value back to metres', () => {
      // given / when
      const { component } = render(
        'cardio.running',
        {
          kind: 'exercise',
          exerciseId: 'cardio.running',
          timestamp: '2026-02-10T13:45:00+01:00',
          distanceM: 12500,
          durationSec: 3600,
        },
        [{ provide: LOCALE_ID, useValue: 'fr-FR' }]
      );

      // then
      expect(component.state.distanceM()).toBe(12500);
      expect(component.canSubmit()).toBe(true);
    });

    it('should emit a null variantId when a set variant is cleared', () => {
      // given
      const { component } = render('abs.situps', {
        kind: 'exercise',
        exerciseId: 'abs.situps',
        timestamp: '2026-02-10T13:45:00+01:00',
        reps: 30,
        sets: [30],
        variantId: 'weighted',
      });

      // when
      component.state.variantControl.setValue('');
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then
      expect(result.variantId).toBeNull();
    });

    it('should pre-fill intervals from an endurance edit payload', () => {
      // given / when
      const { component } = render('plank.standard', {
        kind: 'exercise',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T13:45:00+01:00',
        durationSec: 90,
        intervals: [30, 30, 30],
      });

      // then
      expect(component.state.intervals()).toEqual([30, 30, 30]);
    });

    it.each([
      ['abs.removed-variant'],
      ['plank.removed-variant'],
      ['legs.removed-variant'],
    ])(
      'should keep a stale exercise id submittable via the synthetic def (%s)',
      (exerciseId) => {
        // given
        const { component } = render(exerciseId, {
          kind: 'exercise',
          exerciseId,
          timestamp: '2026-02-10T13:45:00+01:00',
          reps: 25,
          sets: [25],
        });

        // when / then
        expect(component.canSubmit()).toBe(true);
        const result = component.buildResult('t') as ExerciseEntryDialogResult;
        expect(result.exerciseId).toBe(exerciseId);
      }
    );
  });
});
