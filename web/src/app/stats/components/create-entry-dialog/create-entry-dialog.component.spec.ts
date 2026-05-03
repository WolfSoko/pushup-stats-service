import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { PUSHUP_TYPES } from '@pu-stats/models';
import {
  CreateEntryDialogComponent,
  CreateEntryResult,
} from './create-entry-dialog.component';

describe('CreateEntryDialogComponent', () => {
  let fixture: ComponentFixture<CreateEntryDialogComponent>;
  let component: CreateEntryDialogComponent;
  const closeSpy = vitest.fn();

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 15, 12, 0)); // Jan 15 12:00
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CreateEntryDialogComponent],
      providers: [
        provideRouter([]),
        {
          provide: MatDialogRef,
          useValue: { close: closeSpy },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateEntryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  describe('Given the dialog opens', () => {
    it('Then timestamp is pre-filled with current date/time', () => {
      expect(component.timestamp()).toBe('2025-01-15T12:00');
    });

    it('Then type defaults to the canonical "standard" id', () => {
      expect(component.typeControl.value).toBe('standard');
    });

    it('Then source defaults to web', () => {
      expect(component.sourceControl.value).toBe('web');
    });

    it('Then the wiki deep-link points to the matching push-up type slug', () => {
      // Default value is "Standard", which is in the catalog → slug "standard".
      expect(component.wikiQueryParams()).toEqual({ type: 'standard' });
    });

    it('Then the wiki deep-link drops the slug for unknown custom types', () => {
      component.typeControl.setValue('My-Custom-Move');
      expect(component.wikiQueryParams()).toEqual({});
    });

    it('Then `tooltipFor` returns a non-empty summary for known types', () => {
      // TestBed defaults to the source locale (`de`); the localization
      // logic itself is exhaustively tested in pushup-type.models.spec.ts.
      expect(component.tooltipFor('Standard').length).toBeGreaterThan(0);
      expect(component.tooltipFor('Unknown')).toBe('');
    });

    it('Then `displayType` maps both the canonical id and the legacy entryLabel to the localized name', () => {
      // TestBed default locale is `de` (the app's source locale).
      // New canonical id form:
      expect(component.displayType('standard')).toBe('Standard-Liegestütze');
      expect(component.displayType('diamond')).toBe('Diamant-Liegestütze');
      // Legacy entryLabel form (still on older Firestore docs):
      expect(component.displayType('Standard')).toBe('Standard-Liegestütze');
      expect(component.displayType('Diamond')).toBe('Diamant-Liegestütze');
    });

    it('Then `displayType` echoes custom typed values unchanged', () => {
      expect(component.displayType('My-Custom-Move')).toBe('My-Custom-Move');
      expect(component.displayType('')).toBe('');
    });

    it('Then the wiki deep-link resolves a localized name typed by the user', () => {
      component.typeControl.setValue('Diamant-Liegestütze');
      expect(component.wikiQueryParams()).toEqual({ type: 'diamant' });
    });

    it('Then the wiki deep-link also resolves an English name pasted into a translated UI', () => {
      component.typeControl.setValue('Diamond push-up');
      expect(component.wikiQueryParams()).toEqual({ type: 'diamant' });
    });

    it('Then every catalog variant is offered in the autocomplete with localized labels', async () => {
      // Regression: the filter must return the FULL catalog on the
      // initial form-control value (default "standard") so the user
      // sees every variant, not just the one matching the default.
      const initial = await firstValueFrom(
        component.filteredTypeOptions$.pipe(take(1))
      );
      expect(initial.map((o) => o.value).sort()).toEqual(
        PUSHUP_TYPES.map((t) => t.id).sort()
      );
      // TestBed default locale is `de`; labels must be the German
      // catalog names, not the English entryLabel fallback.
      const standard = initial.find((o) => o.value === 'standard');
      expect(standard?.label).toBe('Standard-Liegestütze');
      const diamond = initial.find((o) => o.value === 'diamond');
      expect(diamond?.label).toBe('Diamant-Liegestütze');
      const oneArm = initial.find((o) => o.value === 'one-arm');
      expect(oneArm?.label).toBe('Einarmige Liegestütze');
    });
  });

  describe('Given the dialog opens with sets', () => {
    it('Then it starts with one empty set and no multi-set header', () => {
      expect(component.sets()).toEqual([0]);
      expect(component.hasMultipleSets()).toBe(false);
      expect(component.totalReps()).toBe(0);
    });

    it('Then addSet prefills new set with the last set value', () => {
      component.sets.set([15]);
      component.addSet();
      expect(component.sets()).toEqual([15, 15]);
      expect(component.hasMultipleSets()).toBe(true);
    });

    it('Then addSet prefills with 0 when last set is empty', () => {
      component.addSet();
      expect(component.sets()).toEqual([0, 0]);
    });

    it('Then removeSet removes a set by index', () => {
      component.sets.set([10, 15, 20]);
      component.removeSet(1);
      expect(component.sets()).toEqual([10, 20]);
    });

    it('Then removeSet keeps at least one set', () => {
      component.sets.set([10]);
      component.removeSet(0);
      expect(component.sets()).toEqual([0]);
    });

    it('Then updateSet updates a specific set value', () => {
      component.sets.set([10, 0]);
      component.updateSet(1, '15');
      expect(component.sets()).toEqual([10, 15]);
    });

    it('Then totalReps computes the sum of all sets', () => {
      component.sets.set([10, 15, 20]);
      expect(component.totalReps()).toBe(45);
    });
  });

  describe('Given submit is called with valid data', () => {
    it('Then dialogRef.close is called with sets and the canonical id', () => {
      // Given
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([10, 15]);
      component.typeControl.setValue('diamond');
      component.sourceControl.setValue('web');

      // When
      component.submit();

      // Then — Firestore receives the canonical kebab-case id
      // (language-agnostic), and timestamp picks up the local offset.
      expect(closeSpy).toHaveBeenCalledWith<[CreateEntryResult]>({
        timestamp: expect.stringMatching(/^2025-01-15T10:30[+-]\d{2}:\d{2}$/),
        reps: 25,
        sets: [10, 15],
        source: 'web',
        type: 'diamond',
      });
    });

    it('Then a localized type name is persisted as the canonical id', () => {
      // The dialog shows localized labels but persists the kebab-case id
      // so aggregations stay locale-agnostic.
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([10]);
      component.typeControl.setValue('Diamant-Liegestütze');

      component.submit();

      expect(closeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'diamond' })
      );
    });

    it('Then a legacy English entryLabel is rewritten to the canonical id', () => {
      // Useful when re-saving an old entry without otherwise touching it:
      // the dialog still resolves "Diamond" → "diamond" so the doc moves
      // forward to the new format.
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([10]);
      component.typeControl.setValue('Diamond');

      component.submit();

      expect(closeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'diamond' })
      );
    });

    it('Then a custom typed type is persisted verbatim', () => {
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([10]);
      component.typeControl.setValue('My-Custom-Move');

      component.submit();

      expect(closeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'My-Custom-Move' })
      );
    });

    it('Then legacy source "wa" is normalized to "whatsapp"', () => {
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([10]);
      component.sourceControl.setValue('wa');

      component.submit();

      expect(closeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'whatsapp' })
      );
    });

    it('Then zero-value sets are filtered out', () => {
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([10, 0, 15, 0]);

      component.submit();

      expect(closeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ reps: 25, sets: [10, 15] })
      );
    });
  });

  describe('Given submit is called with invalid data', () => {
    it('Then dialogRef.close is NOT called when all sets are zero', () => {
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([0]);

      component.submit();

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('Then dialogRef.close is NOT called when timestamp is empty', () => {
      component.timestamp.set('');
      component.sets.set([10]);

      component.submit();

      expect(closeSpy).not.toHaveBeenCalled();
    });
  });
});
