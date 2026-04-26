import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { AdminUser } from './admin-page.component';
import { UserDetailsDialogComponent } from './user-details-dialog.component';

describe('UserDetailsDialogComponent', () => {
  function setup(user: AdminUser) {
    TestBed.configureTestingModule({
      imports: [UserDetailsDialogComponent, MatDialogModule],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: user }],
    });
    const fixture = TestBed.createComponent(UserDetailsDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  const baseUser: AdminUser = {
    uid: 'user-uid-1234567890',
    displayName: 'Alice',
    email: 'alice@example.com',
    anonymous: false,
    pushupCount: 42,
    lastEntry: '2026-04-20T10:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    role: 'admin',
  };

  it('renders the full UID (not truncated like in the table)', () => {
    const { fixture } = setup(baseUser);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('user-uid-1234567890');
  });

  it('shows the display name and email', () => {
    const { fixture } = setup(baseUser);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Alice');
    expect(text).toContain('alice@example.com');
  });

  it('falls back to the empty label when name and email are missing', () => {
    const { fixture, component } = setup({
      ...baseUser,
      displayName: null,
      email: null,
    });
    const dds = Array.from(
      fixture.nativeElement.querySelectorAll('dd') as NodeListOf<HTMLElement>
    ).map((el) => el.textContent?.trim());
    // Name + email cells should render the placeholder
    expect(dds).toContain(component.emptyLabel);
  });

  it('renders the role and pushup count', () => {
    const { fixture } = setup(baseUser);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('admin');
    expect(text).toContain('42');
  });

  it('shows an icon and "Ja" for anonymous users', () => {
    const { fixture } = setup({ ...baseUser, anonymous: true });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ja');
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon).toBeTruthy();
  });

  it('shows "Nein" for non-anonymous users', () => {
    const { fixture } = setup({ ...baseUser, anonymous: false });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nein');
  });

  it('includes a close button in the dialog actions', () => {
    const { fixture } = setup(baseUser);
    const closeButton = fixture.nativeElement.querySelector(
      'mat-dialog-actions button[mat-dialog-close]'
    );
    expect(closeButton).toBeTruthy();
  });
});
