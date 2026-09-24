import { TestBed } from '@angular/core/testing';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

import { AdminUser } from './admin-page.models';
import { DeleteUserDialogComponent } from './delete-user-dialog.component';

describe('DeleteUserDialogComponent', () => {
  const user = {
    uid: 'u1',
    displayName: 'Alice',
    email: 'alice@example.com',
    anonymous: false,
  } as AdminUser;

  function setup() {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DeleteUserDialogComponent, MatDialogModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: user },
      ],
    });
    const fixture = TestBed.createComponent(DeleteUserDialogComponent);
    fixture.detectChanges();
    return { fixture, dialogRef };
  }

  it('should say that the account is deleted together with all its data', () => {
    // given / when
    const { fixture } = setup();

    // then
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Alice');
    expect(text).toContain('alle zugehörigen Daten');
    expect(fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
  });

  it('should close with true when confirmed', () => {
    // given
    const { fixture, dialogRef } = setup();

    // when
    fixture.componentInstance.confirm();

    // then
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
