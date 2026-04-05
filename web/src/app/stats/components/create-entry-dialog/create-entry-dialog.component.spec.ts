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

  describe('Given submit is called with valid data', () => {
    it('Then dialogRef.close is called with the entry result', () => {
      // Given
      component.timestamp.set('2025-01-15T10:30');
      component.reps.set('25');
      component.typeControl.setValue('Diamond');
      component.sourceControl.setValue('web');

      // When
      component.submit();

      // Then
      expect(closeSpy).toHaveBeenCalledWith<[CreateEntryResult]>({
        timestamp: '2025-01-15T10:30',
        reps: 25,
        source: 'web',
        type: 'Diamond',
      });
    });

    it('Then legacy source "wa" is normalized to "whatsapp"', () => {
      component.timestamp.set('2025-01-15T10:30');
      component.reps.set('10');
      component.sourceControl.setValue('wa');

      component.submit();

      expect(closeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'whatsapp' })
      );
    });
  });

  describe('Given submit is called with invalid data', () => {
    it('Then dialogRef.close is NOT called when reps is empty', () => {
      component.timestamp.set('2025-01-15T10:30');
      component.reps.set('');

      component.submit();

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('Then dialogRef.close is NOT called when reps is zero', () => {
      component.timestamp.set('2025-01-15T10:30');
      component.reps.set('0');

      component.submit();

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('Then dialogRef.close is NOT called when timestamp is empty', () => {
      component.timestamp.set('');
      component.reps.set('10');

      component.submit();

      expect(closeSpy).not.toHaveBeenCalled();
    });
  });
});
