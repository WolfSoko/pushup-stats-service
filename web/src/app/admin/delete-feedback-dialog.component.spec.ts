import { TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  DeleteFeedbackDialogComponent,
  DeleteFeedbackDialogData,
} from './delete-feedback-dialog.component';

describe('DeleteFeedbackDialogComponent', () => {
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  function setup(data: DeleteFeedbackDialogData) {
    dialogRefSpy = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DeleteFeedbackDialogComponent, MatDialogModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    const fixture = TestBed.createComponent(DeleteFeedbackDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('truncates long messages in the preview', () => {
    const longMessage = 'A'.repeat(250);
    const { component } = setup({ name: 'Alice', message: longMessage });
    expect(component.preview.length).toBeLessThanOrEqual(201);
    expect(component.preview.endsWith('…')).toBe(true);
  });

  it('keeps short messages unchanged in the preview', () => {
    const { component } = setup({ name: 'Alice', message: 'Short note' });
    expect(component.preview).toBe('Short note');
  });

  it('trims whitespace around the message before previewing', () => {
    const { component } = setup({
      name: null,
      message: '   padded   ',
    });
    expect(component.preview).toBe('padded');
  });

  it('closes with true when confirm() is called', () => {
    const { component } = setup({ name: 'Alice', message: 'Hi' });
    component.confirm();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });
});
