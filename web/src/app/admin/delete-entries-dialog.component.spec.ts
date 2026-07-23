import { TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  DeleteEntriesDialogComponent,
  DeleteEntriesDialogData,
} from './delete-entries-dialog.component';

describe('DeleteEntriesDialogComponent', () => {
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  function setup(data: DeleteEntriesDialogData) {
    dialogRefSpy = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DeleteEntriesDialogComponent, MatDialogModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    const fixture = TestBed.createComponent(DeleteEntriesDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('should use the singular confirmation text for a single entry', () => {
    const { component } = setup({ count: 1 });
    expect(component.confirmText).toBe(
      'Möchtest du diesen Eintrag wirklich endgültig löschen?'
    );
  });

  it('should use the plural confirmation text and interpolate the count for multiple entries', () => {
    const { component } = setup({ count: 3 });
    expect(component.confirmText).toContain('3');
    expect(component.confirmText).not.toBe(
      'Möchtest du diesen Eintrag wirklich endgültig löschen?'
    );
  });

  it('should close with true when confirm() is called', () => {
    const { component } = setup({ count: 1 });
    component.confirm();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });
});
