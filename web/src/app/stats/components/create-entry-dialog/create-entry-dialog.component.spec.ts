import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
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

    it('Then type defaults to Standard', () => {
      expect(component.typeControl.value).toBe('Standard');
    });

    it('Then source defaults to web', () => {
      expect(component.sourceControl.value).toBe('web');
    });
  });

  describe('Given the dialog opens with sets', () => {
    it('Then it starts with one empty set', () => {
      expect(component.sets()).toEqual([0]);
      expect(component.totalReps()).toBe(0);
    });

    it('Then addSet adds a new set', () => {
      component.addSet();
      expect(component.sets()).toEqual([0, 0]);
    });

    it('Then removeSet removes a set by index', () => {
      component.sets.set([10, 15, 20]);
      component.removeSet(1);
      expect(component.sets()).toEqual([10, 20]);
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
    it('Then dialogRef.close is called with sets and computed reps', () => {
      // Given
      component.timestamp.set('2025-01-15T10:30');
      component.sets.set([10, 15]);
      component.typeControl.setValue('Diamond');
      component.sourceControl.setValue('web');

      // When
      component.submit();

      // Then — timestamp now includes local timezone offset (e.g. '+01:00')
      expect(closeSpy).toHaveBeenCalledWith<[CreateEntryResult]>({
        timestamp: expect.stringMatching(/^2025-01-15T10:30[+-]\d{2}:\d{2}$/),
        reps: 25,
        sets: [10, 15],
        source: 'web',
        type: 'Diamond',
      });
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
