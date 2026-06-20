import { Component, LOCALE_ID, Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter } from '@angular/router';
import { ExerciseCategoryId } from '@pu-stats/models';

// test-setup.ts also registers `fr`, but the Angular vitest builder
// doesn't reliably pick that up for the `fr-FR` region key in this spec.
registerLocaleData(localeFr, 'fr-FR');

import { ExerciseEntryFieldsComponent } from './exercise-entry-fields.component';
import {
  ExerciseEntryDialogResult,
  TrainingEntryDialogData,
} from './training-entry-dialog.models';

@Component({
  selector: 'app-host',
  imports: [ExerciseEntryFieldsComponent],
  template:
    '<app-exercise-entry-fields [category]="category()" [data]="data" [isEditMode]="isEditMode" />',
})
class HostComponent {
  readonly category = signal<ExerciseCategoryId>('core');
  data: TrainingEntryDialogData | null = null;
  isEditMode = false;
}

describe('ExerciseEntryFieldsComponent', () => {
  function render(
    category: ExerciseCategoryId,
    data: TrainingEntryDialogData | null,
    extraProviders: Provider[] = []
  ): {
    component: ExerciseEntryFieldsComponent;
    host: HostComponent;
    fixture: ComponentFixture<HostComponent>;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([]), ...extraProviders],
    });
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;
    host.category.set(category);
    host.data = data;
    host.isEditMode = !!data;
    fixture.detectChanges();
    const component = fixture.debugElement.children[0]
      .componentInstance as ExerciseEntryFieldsComponent;
    return { component, host, fixture };
  }

  describe('create mode', () => {
    it('should default to the first catalog exercise of the category', () => {
      // given / when
      const { component } = render('core', null);

      // then — first core entry is the picker default.
      expect(component.state.exerciseId()).toBe('abs.situps');
      expect(component.state.sets()).toEqual([0]);
    });

    it('should reset selection + value fields when the category changes', () => {
      // given
      const { component, host, fixture } = render('core', null);
      component.state.updateSet(0, '20');

      // when
      host.category.set('squat');
      fixture.detectChanges();

      // then
      expect(component.state.exerciseId()).toBe('legs.squats');
      expect(component.state.sets()).toEqual([0]);
    });

    it('should emit a time result with durationSec for plank', () => {
      // given
      const { component } = render('core', null);
      component.state.onExerciseChange('plank.standard');
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
      const { component } = render('cardio', null);
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
      const { component, fixture } = render('cardio', null, [
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
      ['fr-FR', '1 234,56', 1234560],
      ['fr-FR', '1 234,56', 1234560],
    ])(
      'should parse km input with thousand separators (%s "%s")',
      (locale, input, expectedM) => {
        // given
        const { component } = render('cardio', null, [
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
        const { component } = render('cardio', null);

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
      const { fixture: deFixture } = render('cardio', null, [
        { provide: LOCALE_ID, useValue: 'de-DE' },
      ]);
      const deInput: HTMLInputElement = deFixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );

      const { fixture: enFixture } = render('cardio', null, [
        { provide: LOCALE_ID, useValue: 'en-US' },
      ]);
      const enInput: HTMLInputElement = enFixture.nativeElement.querySelector(
        'input[data-testid="training-entry-distance"]'
      );

      // then
      expect(deInput.placeholder).toBe('5,00');
      expect(enInput.placeholder).toBe('5.00');
    });

    it('should clear variant + value fields when the exercise picker changes', () => {
      // given
      const { component } = render('core', null);
      component.state.variantControl.setValue('weighted');
      component.state.updateSet(0, '12');

      // when
      component.state.onExerciseChange('plank.standard');

      // then
      expect(component.state.variantControl.value).toBe('');
      expect(component.state.sets()).toEqual([0]);
    });

    it('should cap reps at the catalog max for the chosen exercise', () => {
      // given
      const { component } = render('core', null);

      // when
      component.state.updateSet(0, '9999');

      // then — abs.situps caps at 500.
      expect(component.state.sets()[0]).toBe(500);
      expect(component.state.overCap()).toBe(false);
    });

    it('should compute a /wiki/uebungen detail link for the selection', () => {
      // given / when
      const { component } = render('core', null);

      // then — abs.situps maps to slug 'sit-ups'.
      expect(component.state.exerciseId()).toBe('abs.situps');
      expect(component.state.exerciseWikiLink()).toEqual([
        '/wiki/uebungen',
        'sit-ups',
      ]);
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
      // given
      const { component, fixture } = render('core', null);

      // when
      component.state.onExerciseChange('abs.situps');
      fixture.detectChanges();

      // then
      const labels = breakdownLabels(fixture);
      expect(labels).toContain('Reps');
      expect(labels.every((l) => !l.startsWith('Intervall'))).toBe(true);
    });

    it('should label endurance rows as "Intervall N" with two intervals', () => {
      // given
      const { component, fixture } = render('core', null);
      component.state.onExerciseChange('plank.standard');

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
      const { component } = render('core', null);
      component.state.onExerciseChange('plank.standard');
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
      const { component } = render('core', null);
      component.state.onExerciseChange('plank.standard');
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
      const { component } = render('core', null);
      component.state.onExerciseChange('abs.situps');
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
      const { component } = render('core', null);
      component.state.onExerciseChange('plank.standard');
      component.state.updateInterval(0, '45');
      component.state.addInterval();
      component.state.updateInterval(1, '45');

      // when
      component.state.onExerciseChange('abs.situps');

      // then
      expect(component.state.intervals()).toEqual([0]);
      expect(component.state.sets()).toEqual([0]);
    });
  });

  describe('edit mode', () => {
    it('should populate the form from a plank edit payload', () => {
      // given / when
      const { component } = render('core', {
        kind: 'exercise',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T13:45:00+01:00',
        durationSec: 90,
      });

      // then
      expect(component.state.exerciseId()).toBe('plank.standard');
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
          'cardio',
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
        'cardio',
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
      const { component } = render('core', {
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
      const { component } = render('core', {
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
        const category: ExerciseCategoryId = exerciseId.startsWith('legs')
          ? 'squat'
          : 'core';
        const { component } = render(category, {
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

    it('should not change the exercise when the category input changes in edit mode', () => {
      // given
      const { component, host, fixture } = render('core', {
        kind: 'exercise',
        exerciseId: 'plank.standard',
        timestamp: '2026-02-10T13:45:00+01:00',
        durationSec: 90,
      });

      // when — edit mode locks the picker; a category input change is a no-op.
      host.category.set('squat');
      fixture.detectChanges();

      // then
      expect(component.state.exerciseId()).toBe('plank.standard');
    });
  });
});
