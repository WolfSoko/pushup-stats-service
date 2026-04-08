import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { FeedbackDialogComponent } from './feedback-dialog.component';
import { FeedbackDialogData } from './feedback.models';

describe('FeedbackDialogComponent', () => {
  let fixture: ComponentFixture<FeedbackDialogComponent>;
  let component: FeedbackDialogComponent;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  function setup(data: FeedbackDialogData | null = null) {
    dialogRefSpy = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [FeedbackDialogComponent, MatDialogModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });

    fixture = TestBed.createComponent(FeedbackDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('starts in anonymous mode when no data is provided', () => {
    setup();
    expect(component.anonymous()).toBe(true);
  });

  it('starts with name/email filled when data is provided', () => {
    setup({ name: 'Max', email: 'max@test.de' });
    expect(component.anonymous()).toBe(false);
    expect(component.name()).toBe('Max');
    expect(component.email()).toBe('max@test.de');
  });

  it('clears name/email when toggling to anonymous', () => {
    setup({ name: 'Max', email: 'max@test.de' });
    component.onAnonymousChange(true);
    expect(component.name()).toBe('');
    expect(component.email()).toBe('');
  });

  it('restores prefilled data when toggling back from anonymous', () => {
    setup({ name: 'Max', email: 'max@test.de' });
    component.onAnonymousChange(true);
    component.onAnonymousChange(false);
    expect(component.name()).toBe('Max');
    expect(component.email()).toBe('max@test.de');
  });

  it('does not submit when message is empty', () => {
    setup();
    component.message.set('   ');
    component.submit();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('submits feedback with empty name/email when anonymous', () => {
    setup();
    component.message.set('Great app!');
    component.submit();
    expect(dialogRefSpy.close).toHaveBeenCalledWith({
      name: '',
      email: '',
      message: 'Great app!',
    });
  });

  it('submits feedback with name and email when not anonymous', () => {
    setup({ name: 'Max', email: 'max@test.de' });
    component.message.set('Nice feature');
    component.submit();
    expect(dialogRefSpy.close).toHaveBeenCalledWith({
      name: 'Max',
      email: 'max@test.de',
      message: 'Nice feature',
    });
  });

  it('disables submit button when message is empty', () => {
    setup();
    fixture.detectChanges();
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[mat-flat-button]'
    );
    expect(submitBtn.disabled).toBe(true);
  });

  it('hides name/email fields in anonymous mode', () => {
    setup();
    fixture.detectChanges();
    const formFields = fixture.nativeElement.querySelectorAll('mat-form-field');
    // Only the message field should be visible
    expect(formFields.length).toBe(1);
  });

  it('shows name/email fields when not anonymous', () => {
    setup({ name: 'Max', email: 'max@test.de' });
    fixture.detectChanges();
    const formFields = fixture.nativeElement.querySelectorAll('mat-form-field');
    // Name + email + message = 3
    expect(formFields.length).toBe(3);
  });
});
