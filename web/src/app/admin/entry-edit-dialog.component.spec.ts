import { TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { type ExerciseEntry } from '@pu-stats/models';
import { AdminEntryEditDialogComponent } from './entry-edit-dialog.component';

describe('AdminEntryEditDialogComponent', () => {
  const closeSpy = vi.fn();

  function setup(entry: ExerciseEntry) {
    TestBed.configureTestingModule({
      imports: [AdminEntryEditDialogComponent, MatDialogModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: entry },
        { provide: MatDialogRef, useValue: { close: closeSpy } },
      ],
    });
    const fixture = TestBed.createComponent(AdminEntryEditDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  const repsEntry: ExerciseEntry = {
    _id: 'e1',
    userId: 'u1',
    exerciseId: 'legs.squats',
    timestamp: '2026-04-01T10:00:00.000Z',
    reps: 30,
    source: 'web',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the localized exercise name', () => {
    // given / when
    const { fixture } = setup(repsEntry);

    // then
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Kniebeugen');
  });

  it('should seed the primary value from the stored entry', () => {
    // given / when
    const { component } = setup(repsEntry);

    // then
    expect(component.value()).toBe(30);
  });

  it('should not allow saving when nothing changed', () => {
    // given
    const { component } = setup(repsEntry);

    // when / then
    expect(component.canSave()).toBe(false);
  });

  it('should close with a patch of the changed value', () => {
    // given
    const { component } = setup(repsEntry);

    // when
    component.value.set(45);

    // then
    expect(component.canSave()).toBe(true);
    component.save();
    expect(closeSpy).toHaveBeenCalledWith({ reps: 45 });
  });

  it('should reject an out-of-range value (no save)', () => {
    // given — squats cap is 500
    const { component } = setup(repsEntry);

    // when
    component.value.set(9999);

    // then
    expect(component.canSave()).toBe(false);
    component.save();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('should only expose the timestamp field for a stale exercise id', () => {
    // given / when
    const { component, fixture } = setup({
      ...repsEntry,
      exerciseId: 'gone.forever',
    });

    // then
    expect(component.def).toBeNull();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Unbekannte Übung');
  });
});
