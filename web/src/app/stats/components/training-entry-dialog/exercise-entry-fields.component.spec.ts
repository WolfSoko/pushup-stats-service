import {
  Component,
  LOCALE_ID,
  Provider,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatFormField } from '@angular/material/form-field';
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
    '<app-exercise-entry-fields [exerciseId]="exerciseId()" [category]="category()" [data]="data" [isEditMode]="isEditMode" [durationPrefillSec]="durationPrefillSec" />',
})
class HostComponent {
  readonly exerciseId = signal<string>('abs.situps');
  readonly category = signal<ExerciseCategoryId>('core');
  data: TrainingEntryDialogData | null = null;
  isEditMode = false;
  durationPrefillSec: number | undefined = undefined;
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

    it('should prefill the duration from a stopped stopwatch and re-apply it after an exercise switch', () => {
      // given
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [provideRouter([])],
      });
      const fixture = TestBed.createComponent(HostComponent);
      const host = fixture.componentInstance;
      host.exerciseId.set('plank.standard');
      host.category.set('core');
      host.durationPrefillSec = 95;
      fixture.detectChanges();
      const component = fixture.debugElement.children[0]
        .componentInstance as ExerciseEntryFieldsComponent;

      // then
      expect(component.state.durationSec()).toBe(95);

      // when
      host.exerciseId.set('cardio.running');
      host.category.set('cardio');
      fixture.detectChanges();

      // then
      expect(component.state.durationSec()).toBe(95);
    });

    it('should reveal the stopwatch behind the duration row and mirror it into the fields', () => {
      // given
      vi.useFakeTimers({ now: 1_000 });
      try {
        const { component, fixture } = render(
          'core.mountainclimbers.time',
          null
        );
        const toggle = fixture.nativeElement.querySelector(
          '[data-testid="training-entry-stopwatch-toggle"]'
        ) as HTMLButtonElement;
        expect(fixture.nativeElement.querySelector('app-stopwatch')).toBeNull();

        // when
        toggle.click();
        fixture.detectChanges();
        component.stopwatch.start();
        vi.advanceTimersByTime(95_000);
        component.stopwatch.pause();
        fixture.detectChanges();

        // then
        expect(
          fixture.nativeElement.querySelector('app-stopwatch')
        ).toBeTruthy();
        expect(component.state.durationMinutesInput()).toBe('1');
        expect(component.state.durationSecondsInput()).toBe('35');
        expect(component.state.durationSec()).toBe(95);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should offer the stopwatch for a tracked run as well and drop it on an exercise switch', () => {
      // given
      const { component, fixture, switchExercise } = render(
        'cardio.running',
        null
      );
      const toggle = fixture.nativeElement.querySelector(
        '[data-testid="training-entry-stopwatch-toggle"]'
      ) as HTMLButtonElement;
      toggle.click();
      fixture.detectChanges();
      expect(component.stopwatchOpen()).toBe(true);

      // when
      switchExercise('legs.squats');

      // then
      expect(component.stopwatchOpen()).toBe(false);
      expect(component.stopwatch.elapsedSec()).toBe(0);
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="training-entry-stopwatch-toggle"]'
        )
      ).toBeNull();
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

    it('should label endurance rows as "Intervall N" with two intervals, using the same Minuten/Sekunden fields as the main entry', () => {
      // given
      const { component, fixture } = render('plank.standard', null);

      // when
      component.state.addInterval();
      fixture.detectChanges();

      // then
      const root: HTMLElement = fixture.nativeElement;
      const headings = Array.from(root.querySelectorAll('.interval-index')).map(
        (el) => (el.textContent ?? '').trim()
      );
      expect(headings).toEqual(['Intervall 1', 'Intervall 2']);

      // one Minuten/Sekunden pair for the main duration entry plus one per interval
      const labels = breakdownLabels(fixture);
      expect(labels.filter((l) => l === 'Minuten')).toHaveLength(3);
      expect(labels.filter((l) => l === 'Sekunden')).toHaveLength(3);
      expect(labels.every((l) => !l.startsWith('Set '))).toBe(true);
    });

    it('should submit intervals on an endurance payload', () => {
      // given
      const { component } = render('plank.standard', null);
      component.state.durationMinutesInput.set('1');
      component.state.durationSecondsInput.set('30');
      component.state.updateIntervalSeconds(0, '30');
      component.state.addInterval();
      component.state.updateIntervalSeconds(1, '30');
      component.state.addInterval();
      component.state.updateIntervalSeconds(2, '30');

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

    it('should submit distance intervals in km for a distance-time exercise, matching the main "Distanz (km)" field', () => {
      // given
      const { component, fixture } = render('cardio.running', null);
      component.state.distanceInput.set('5.25');
      component.state.durationMinutesInput.set('25');
      component.state.durationSecondsInput.set('0');
      component.state.updateIntervalDistance(0, '1');
      component.state.addInterval();
      component.state.updateIntervalDistance(1, '1');
      fixture.detectChanges();

      // when
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then — no bare unlabeled number field, the interval uses the same
      // decimal-km input as the main distance field.
      const intervalDistanceInputs = fixture.nativeElement.querySelectorAll(
        '.interval-fields input[inputmode="decimal"]'
      );
      expect(intervalDistanceInputs.length).toBe(2);
      expect(result).toMatchObject({
        measurement: 'distance-time',
        distanceM: 5250,
        intervals: [1000, 1000],
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
      component.state.updateIntervalSeconds(0, '45');
      component.state.addInterval();
      component.state.updateIntervalSeconds(1, '45');

      // when
      switchExercise('abs.situps');

      // then
      expect(component.state.intervals()).toEqual([0]);
      expect(component.state.sets()).toEqual([0]);
    });
  });

  describe('interval split times (distance-time only)', () => {
    it('should show a Minuten/Sekunden split-time pair alongside each running interval', () => {
      // given
      const { component, fixture } = render('cardio.running', null);

      // when
      component.state.addInterval();
      fixture.detectChanges();

      // then — one Minuten/Sekunden pair per interval, matching the main
      // duration entry's field shape.
      const root: HTMLElement = fixture.nativeElement;
      const labels = Array.from(root.querySelectorAll('mat-label')).map((el) =>
        (el.textContent ?? '').trim()
      );
      expect(labels.filter((l) => l === 'Minuten')).toHaveLength(3);
      expect(labels.filter((l) => l === 'Sekunden')).toHaveLength(3);
    });

    it('should not show a split-time pair for a plain time exercise (plank)', () => {
      // given / when
      const { fixture } = render('plank.standard', null);

      // then — only the main entry's own Minuten/Sekunden pair, none extra
      // per interval (a plank interval has no distance to pair a split with).
      const root: HTMLElement = fixture.nativeElement;
      const labels = Array.from(root.querySelectorAll('mat-label')).map((el) =>
        (el.textContent ?? '').trim()
      );
      expect(labels.filter((l) => l === 'Minuten')).toHaveLength(2);
    });

    it('should submit index-aligned split times alongside running intervals', () => {
      // given
      const { component } = render('cardio.running', null);
      component.state.distanceInput.set('3');
      component.state.durationMinutesInput.set('13');
      component.state.durationSecondsInput.set('35');
      component.state.updateIntervalDistance(0, '1');
      component.state.updateIntervalCompanionMinutes(0, '4');
      component.state.updateIntervalCompanionSeconds(0, '30');
      component.state.addInterval();
      component.state.updateIntervalDistance(1, '1');
      component.state.updateIntervalCompanionMinutes(1, '4');
      component.state.updateIntervalCompanionSeconds(1, '25');

      // when
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then
      expect(result).toMatchObject({
        intervals: [1000, 1000],
        intervalDurationsSec: [270, 265],
      });
    });

    it('should drop a split time whose interval distance was left empty', () => {
      // given — first interval has only a split time, no distance
      const { component } = render('cardio.running', null);
      component.state.distanceInput.set('1');
      component.state.durationMinutesInput.set('4');
      component.state.durationSecondsInput.set('30');
      component.state.updateIntervalCompanionMinutes(0, '4');
      component.state.updateIntervalCompanionSeconds(0, '30');

      // when
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then — no distance entered for the only interval row, so both
      // arrays come back empty.
      expect(result).toMatchObject({
        intervals: [],
        intervalDurationsSec: [],
      });
    });

    it('should emit an empty intervalDurationsSec when no split times were entered', () => {
      // given
      const { component } = render('cardio.running', null);
      component.state.distanceInput.set('2');
      component.state.durationMinutesInput.set('9');
      component.state.durationSecondsInput.set('0');
      component.state.updateIntervalDistance(0, '1');
      component.state.addInterval();
      component.state.updateIntervalDistance(1, '1');

      // when
      const result = component.buildResult('t') as ExerciseEntryDialogResult;

      // then
      expect(result.intervals).toEqual([1000, 1000]);
      expect(result.intervalDurationsSec).toEqual([]);
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

    it('should pre-fill distance intervals in km from a running edit payload', () => {
      // given / when
      const { component } = render(
        'cardio.running',
        {
          kind: 'exercise',
          exerciseId: 'cardio.running',
          timestamp: '2026-02-10T13:45:00+01:00',
          distanceM: 5000,
          durationSec: 1500,
          intervals: [1000, 1000],
        },
        [{ provide: LOCALE_ID, useValue: 'de-DE' }]
      );

      // then — the interval inputs round-trip through the same km
      // formatting as the main "Distanz (km)" field.
      expect(component.state.intervalDistanceInputs()).toEqual([
        '1,00',
        '1,00',
      ]);
      expect(component.state.intervals()).toEqual([1000, 1000]);
    });

    it('should pre-fill per-interval split times from a running edit payload', () => {
      // given / when
      const { component } = render('cardio.running', {
        kind: 'exercise',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T13:45:00+01:00',
        distanceM: 2000,
        durationSec: 535,
        intervals: [1000, 1000],
        intervalDurationsSec: [270, 265],
      });

      // then — the split-time inputs round-trip through the same mm:ss
      // parts as the main duration entry.
      expect(component.state.intervalCompanionMinutesInputs()).toEqual([
        '4',
        '4',
      ]);
      expect(component.state.intervalCompanionSecondsInputs()).toEqual([
        '30',
        '25',
      ]);
      expect(component.state.intervalDurationsSec()).toEqual([270, 265]);
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
  describe('layout on a phone-sized dialog', () => {
    it('should keep every field the same height by dropping the reserved subscript row', () => {
      // given / when
      const { fixture } = render('cardio.running', null);

      // then — a static subscript adds ~20px under some fields only, which
      // reads as boxes of different heights stacked on top of each other.
      const fields = fixture.debugElement.queryAll(By.directive(MatFormField));
      expect(fields.length).toBeGreaterThan(0);
      expect(
        fields.every(
          (f) =>
            (f.componentInstance as MatFormField).subscriptSizing === 'dynamic'
        )
      ).toBe(true);
    });

    it("should keep an interval row's add/remove buttons out of the field row", () => {
      // given
      const { component, fixture } = render('cardio.running', null);

      // when
      component.state.addInterval();
      fixture.detectChanges();

      // then — sharing one line with the buttons squeezed each field to
      // ~80px and cut the labels down to "Distan…" / "Sekun…".
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelectorAll('.interval-fields button')).toHaveLength(0);
      expect(
        root.querySelectorAll('.interval-header .interval-actions button')
      ).toHaveLength(3);
    });

    it('should span an interval distance field across the full row', () => {
      // given / when — distance shares the row with a split-time pair, which
      // only fits when the distance takes a row of its own.
      const { fixture } = render('cardio.running', null);

      // then
      const root: HTMLElement = fixture.nativeElement;
      const distance = root.querySelector(
        '.interval-fields input[inputmode="decimal"]'
      );
      expect(distance?.closest('mat-form-field')?.classList).toContain(
        'field-full'
      );
    });

    it('should head every interval row, including a lone first one', () => {
      // given / when
      const { fixture } = render('cardio.running', null);

      // then — without the heading the interval fields read as a second,
      // unexplained copy of the main entry fields.
      const root: HTMLElement = fixture.nativeElement;
      const heading = root.querySelector('.interval-index');
      expect((heading?.textContent ?? '').trim()).toBe('Intervall 1');
      expect(
        root.querySelector('.interval-fields')?.getAttribute('aria-labelledby')
      ).toBe(heading?.id);
    });

    it('should render set actions in their own cell so the input keeps its width', () => {
      // given
      const { component, fixture } = render('abs.situps', null);

      // when
      component.state.addSet();
      fixture.detectChanges();

      // then — buttons inline with the input resized it on every add/remove.
      const root: HTMLElement = fixture.nativeElement;
      const rows = Array.from(root.querySelectorAll('.set-row'));
      expect(rows).toHaveLength(2);
      expect(
        rows.every(
          (row) =>
            row.querySelector(':scope > .set-actions') !== null &&
            row.querySelectorAll(':scope > button').length === 0
        )
      ).toBe(true);
    });
  });
});
