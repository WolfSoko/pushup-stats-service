import { TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import type { ExerciseDefinition } from '@pu-stats/models';
import { Mock } from 'vitest';
import {
  EntryDialogComponent,
  EntryDialogData,
  EntryDialogResult,
} from './entry-dialog.component';

const situpsDef: ExerciseDefinition = {
  id: 'abs.situps',
  categoryId: 'abs',
  measurement: 'reps',
  min: 1,
  max: 500,
  unit: 'reps',
};

const plankDef: ExerciseDefinition = {
  id: 'plank.standard',
  categoryId: 'plank',
  measurement: 'time',
  min: 1,
  max: 7200,
  unit: 's',
};

const runningDef: ExerciseDefinition = {
  id: 'cardio.running',
  categoryId: 'cardio',
  measurement: 'distance-time',
  min: 100,
  max: 50_000,
  unit: 'm',
};

const pushupWithVariantsDef: ExerciseDefinition = {
  id: 'pushup',
  categoryId: 'pushup',
  measurement: 'reps',
  min: 1,
  max: 500,
  unit: 'reps',
  variants: [
    { id: 'standard', nameKey: '@@v.standard' },
    { id: 'wide', nameKey: '@@v.wide' },
  ],
};

describe('EntryDialogComponent', () => {
  let dialogRef: { close: Mock };

  function createComponent(
    data: EntryDialogData = {
      definition: situpsDef,
      exerciseName: 'Sit-ups',
    }
  ): EntryDialogComponent {
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [EntryDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(EntryDialogComponent);
    return fixture.componentInstance;
  }

  describe('Given a fresh create-mode dialog', () => {
    it('starts with one empty set, totalReps 0, and submit disabled', () => {
      const cmp = createComponent();
      expect(cmp.sets()).toEqual([0]);
      expect(cmp.totalReps()).toBe(0);
      expect(cmp.canSubmit()).toBe(false);
    });

    it('hides the variant picker when the definition has no variants', () => {
      const cmp = createComponent();
      expect(cmp.showVariantPicker()).toBe(false);
    });
  });

  describe('Given a definition with variants', () => {
    it('shows the variant picker', () => {
      const cmp = createComponent({
        definition: pushupWithVariantsDef,
        exerciseName: 'Pushup',
      });
      expect(cmp.showVariantPicker()).toBe(true);
    });

    it('emits the picked variantId on submit', () => {
      const cmp = createComponent({
        definition: pushupWithVariantsDef,
        exerciseName: 'Pushup',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.updateSet(0, '20');
      cmp.variantControl.setValue('wide');
      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect(result.variantId).toBe('wide');
      expect(result.exerciseId).toBe('pushup');
    });

    it('omits variantId when none is picked in create mode', () => {
      const cmp = createComponent({
        definition: pushupWithVariantsDef,
        exerciseName: 'Pushup',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.updateSet(0, '20');
      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect('variantId' in result).toBe(false);
    });

    it('emits variantId: null when the user clears a previously-set variant', () => {
      const cmp = createComponent({
        definition: pushupWithVariantsDef,
        exerciseName: 'Pushup',
        initial: {
          timestamp: '2026-04-15T10:00:00+02:00',
          reps: 20,
          sets: [20],
          variantId: 'wide',
        },
      });
      // User opens the picker and selects the empty placeholder.
      cmp.variantControl.setValue('');
      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      // Tri-state contract: null = clear (deleteField on update),
      // not omitted (which the store would treat as "no change").
      expect(result.variantId).toBeNull();
    });

    it('omits variantId when an entry without a variant stays without one', () => {
      const cmp = createComponent({
        definition: pushupWithVariantsDef,
        exerciseName: 'Pushup',
        initial: {
          timestamp: '2026-04-15T10:00:00+02:00',
          reps: 20,
          sets: [20],
        },
      });
      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect('variantId' in result).toBe(false);
    });

    it('omits variantId when an existing variant is left unchanged in edit mode', () => {
      const cmp = createComponent({
        definition: pushupWithVariantsDef,
        exerciseName: 'Pushup',
        initial: {
          timestamp: '2026-04-15T10:00:00+02:00',
          reps: 20,
          sets: [20],
          variantId: 'wide',
        },
      });
      // No setValue call — the user opened, looked, and saved without
      // touching the variant picker. The patch must not race against
      // a concurrent variant change by re-asserting the same string.
      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect('variantId' in result).toBe(false);
    });
  });

  describe('When the user enters reps and submits', () => {
    it('closes with the entered reps and the definition.id as exerciseId', () => {
      const cmp = createComponent({
        definition: { ...situpsDef, id: 'legs.squats' },
        exerciseName: 'Kniebeugen',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.updateSet(0, '25');
      expect(cmp.canSubmit()).toBe(true);

      cmp.submit();

      expect(dialogRef.close).toHaveBeenCalledTimes(1);
      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect(result.exerciseId).toBe('legs.squats');
      expect(result.reps).toBe(25);
      expect(result.sets).toEqual([25]);
      expect(result.timestamp.startsWith('2026-04-15T10:00')).toBe(true);
    });
  });

  describe('Input clamping', () => {
    it('floors fractional reps to integers', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '5.7');
      expect(cmp.sets()[0]).toBe(5);
    });

    it('clamps negative input to 0', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '-3');
      expect(cmp.sets()[0]).toBe(0);
    });

    it('clamps values above the per-exercise cap', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '9999');
      expect(cmp.sets()[0]).toBe(situpsDef.max);
    });

    it('falls back to 0 for non-numeric input', () => {
      const cmp = createComponent();
      cmp.updateSet(0, 'abc');
      expect(cmp.sets()[0]).toBe(0);
    });
  });

  describe('Cap enforcement', () => {
    it('disables submit when the summed sets exceed the cap', () => {
      const cmp = createComponent({
        definition: { ...situpsDef, max: 50 },
        exerciseName: 'Sit-ups',
      });
      // updateSet clamps each value to max, but multiple sets can still
      // sum past it; canSubmit() must detect that and lock the button.
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.updateSet(0, '40');
      cmp.addSet();
      cmp.updateSet(1, '20');
      expect(cmp.totalReps()).toBe(60);
      expect(cmp.overCap()).toBe(true);
      expect(cmp.canSubmit()).toBe(false);
    });
  });

  describe('Multi-set handling', () => {
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

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect(result.reps).toBe(45);
      expect(result.sets).toEqual([10, 15, 20]);
    });

    it('drops zero-rep sets from the persisted result', () => {
      const cmp = createComponent();
      cmp.updateSet(0, '10');
      cmp.addSet();
      cmp.updateSet(1, '0');
      cmp.addSet();
      cmp.updateSet(2, '20');
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect(result.sets).toEqual([10, 20]);
      expect(result.reps).toBe(30);
    });

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

  describe('Edit mode', () => {
    it('pre-fills sets and timestamp from the initial entry', () => {
      const cmp = createComponent({
        definition: situpsDef,
        exerciseName: 'Sit-ups',
        initial: {
          timestamp: '2026-04-01T08:30:00+02:00',
          reps: 30,
          sets: [10, 10, 10],
        },
      });

      expect(cmp.sets()).toEqual([10, 10, 10]);
      expect(cmp.timestamp()).toBe('2026-04-01T08:30');
    });

    it('preserves the original timestamp when the user did not touch the field', () => {
      const original = '2026-04-01T08:30:00+02:00';
      const cmp = createComponent({
        definition: situpsDef,
        exerciseName: 'Sit-ups',
        initial: { timestamp: original, reps: 10, sets: [10] },
      });
      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect(result.timestamp).toBe(original);
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

  describe('Time measurement (plank)', () => {
    it('marks the form as time-measurement and starts with empty min/sec inputs', () => {
      const cmp = createComponent({
        definition: plankDef,
        exerciseName: 'Plank',
      });
      expect(cmp.isTimeMeasurement()).toBe(true);
      expect(cmp.durationMinutesInput()).toBe('');
      expect(cmp.durationSecondsInput()).toBe('');
      expect(cmp.durationSec()).toBeNull();
      expect(cmp.canSubmit()).toBe(false);
    });

    it('combines the min/sec inputs into seconds and submits durationSec', () => {
      const cmp = createComponent({
        definition: plankDef,
        exerciseName: 'Plank',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.durationMinutesInput.set('1');
      cmp.durationSecondsInput.set('30');
      expect(cmp.durationSec()).toBe(90);
      expect(cmp.canSubmit()).toBe(true);

      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect(result.measurement).toBe('time');
      expect(result.durationSec).toBe(90);
      expect(result.exerciseId).toBe('plank.standard');
      expect(result.reps).toBe(0);
      expect(result.sets).toEqual([]);
    });

    it('treats an empty minutes field as 0 when seconds are filled in', () => {
      const cmp = createComponent({
        definition: plankDef,
        exerciseName: 'Plank',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.durationSecondsInput.set('45');
      expect(cmp.durationSec()).toBe(45);
      expect(cmp.canSubmit()).toBe(true);
    });

    it('treats an empty seconds field as 0 when minutes are filled in', () => {
      const cmp = createComponent({
        definition: plankDef,
        exerciseName: 'Plank',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.durationMinutesInput.set('2');
      expect(cmp.durationSec()).toBe(120);
      expect(cmp.canSubmit()).toBe(true);
    });

    it('rejects seconds outside the 0-59 range', () => {
      const cmp = createComponent({
        definition: plankDef,
        exerciseName: 'Plank',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.durationMinutesInput.set('1');
      cmp.durationSecondsInput.set('60');
      expect(cmp.durationSec()).toBeNull();
      expect(cmp.canSubmit()).toBe(false);
    });

    it('rejects negative numbers in either field', () => {
      const cmp = createComponent({
        definition: plankDef,
        exerciseName: 'Plank',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.durationMinutesInput.set('-1');
      cmp.durationSecondsInput.set('30');
      expect(cmp.durationSec()).toBeNull();
      expect(cmp.canSubmit()).toBe(false);
    });

    it('disables submit when the duration exceeds the per-exercise cap', () => {
      const cmp = createComponent({
        definition: { ...plankDef, max: 60 },
        exerciseName: 'Plank',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.durationMinutesInput.set('5');
      cmp.durationSecondsInput.set('0');
      expect(cmp.overCap()).toBe(true);
      expect(cmp.canSubmit()).toBe(false);
    });

    it('pre-fills min/sec in edit mode from the entry durationSec', () => {
      const cmp = createComponent({
        definition: plankDef,
        exerciseName: 'Plank',
        initial: {
          timestamp: '2026-04-15T10:00:00+02:00',
          reps: 0,
          durationSec: 95,
        },
      });
      // 95 s → 1 min 35 s
      expect(cmp.durationMinutesInput()).toBe('1');
      expect(cmp.durationSecondsInput()).toBe('35');
    });
  });

  describe('Distance-time measurement (cardio.running)', () => {
    it('marks the form as distance-time and starts with both fields empty', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      expect(cmp.isDistanceTimeMeasurement()).toBe(true);
      expect(cmp.distanceInput()).toBe('');
      expect(cmp.durationMinutesInput()).toBe('');
      expect(cmp.durationSecondsInput()).toBe('');
      expect(cmp.canSubmit()).toBe(false);
    });

    it('parses km input into integer meters', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      cmp.distanceInput.set('5.25');
      expect(cmp.distanceM()).toBe(5250);
    });

    it('tolerates a comma decimal separator', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      cmp.distanceInput.set('5,25');
      expect(cmp.distanceM()).toBe(5250);
    });

    it('rejects empty, non-numeric, and non-positive distance', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      cmp.distanceInput.set('');
      expect(cmp.distanceM()).toBeNull();
      cmp.distanceInput.set('garbage');
      expect(cmp.distanceM()).toBeNull();
      cmp.distanceInput.set('0');
      expect(cmp.distanceM()).toBeNull();
      cmp.distanceInput.set('-3');
      expect(cmp.distanceM()).toBeNull();
    });

    it('keeps submit disabled until both distance and duration are valid', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      cmp.timestamp.set('2026-04-15T10:00');

      cmp.distanceInput.set('5.00');
      expect(cmp.canSubmit()).toBe(false);

      cmp.durationMinutesInput.set('25');
      cmp.durationSecondsInput.set('0');
      expect(cmp.canSubmit()).toBe(true);

      // Clearing both duration fields locks submit again.
      cmp.durationMinutesInput.set('');
      cmp.durationSecondsInput.set('');
      expect(cmp.canSubmit()).toBe(false);
    });

    it('disables submit below def.min and above def.max', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.durationMinutesInput.set('25');
      cmp.durationSecondsInput.set('0');

      cmp.distanceInput.set('0.05');
      expect(cmp.canSubmit()).toBe(false);

      cmp.distanceInput.set('60');
      expect(cmp.overCap()).toBe(true);
      expect(cmp.canSubmit()).toBe(false);

      cmp.distanceInput.set('5.00');
      expect(cmp.overCap()).toBe(false);
      expect(cmp.canSubmit()).toBe(true);
    });

    it('flags overCap when the duration exceeds the companion bound', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.distanceInput.set('5.00');
      // 86_400 s is the companion ceiling; 1500 min = 90_000 s clears it.
      cmp.durationMinutesInput.set('1500');
      cmp.durationSecondsInput.set('0');
      expect(cmp.overCap()).toBe(true);
      expect(cmp.canSubmit()).toBe(false);
    });

    it('submits distanceM (rounded) and durationSec, with empty reps/sets', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      cmp.timestamp.set('2026-04-15T10:00');
      cmp.distanceInput.set('5.25');
      cmp.durationMinutesInput.set('25');
      cmp.durationSecondsInput.set('0');
      expect(cmp.canSubmit()).toBe(true);

      cmp.submit();

      const result = dialogRef.close.mock.calls[0][0] as EntryDialogResult;
      expect(result.measurement).toBe('distance-time');
      expect(result.exerciseId).toBe('cardio.running');
      expect(result.distanceM).toBe(5250);
      expect(result.durationSec).toBe(25 * 60);
      expect(result.reps).toBe(0);
      expect(result.sets).toEqual([]);
    });

    it('pre-fills distance + duration in edit mode', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
        initial: {
          timestamp: '2026-04-15T10:00:00+02:00',
          reps: 0,
          distanceM: 5250,
          durationSec: 25 * 60 + 30,
        },
      });
      expect(cmp.distanceInput()).toBe('5.25');
      expect(cmp.durationMinutesInput()).toBe('25');
      expect(cmp.durationSecondsInput()).toBe('30');
    });

    it('exposes minKm/maxKm derived from def.min/def.max', () => {
      const cmp = createComponent({
        definition: runningDef,
        exerciseName: 'Laufen',
      });
      expect(cmp.minKm()).toBeCloseTo(0.1);
      expect(cmp.maxKm()).toBe(50);
    });
  });
});
