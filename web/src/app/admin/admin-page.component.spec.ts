import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { of } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';
import { AdminUser } from './admin-page.models';
import { CallableFunctionsService } from './callable-functions.service';
import {
  CallableRecord,
  createCallablesMock,
} from './callable-functions.testing';
import { DeleteUserDialogComponent } from './delete-user-dialog.component';
import { UserDetailsDialogComponent } from './user-details-dialog.component';

const { callablesMock, setupCallables } = createCallablesMock();

describe('AdminPageComponent', () => {
  let fixture: ComponentFixture<AdminPageComponent>;
  let component: AdminPageComponent;
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;

  function stubDialogRef<T>(result: T): MatDialogRef<unknown, T> {
    return { afterClosed: () => of(result) } as MatDialogRef<unknown, T>;
  }

  const sampleUser: AdminUser = {
    uid: 'user-1',
    displayName: 'Alice',
    email: 'alice@example.com',
    anonymous: false,
    pushupCount: 12,
    lastEntry: '2026-04-09T10:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    role: null,
  };

  // The embedded <app-admin-feedback-section> loads feedback on init, so every
  // render needs the adminListFeedback callable stubbed alongside the users one.
  async function createComponent(
    users: AdminUser[] = [],
    extraCallables: CallableRecord[] = []
  ): Promise<void> {
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: users }) },
      { name: 'adminListFeedback', impl: async () => ({ data: [] }) },
      ...extraCallables,
    ]);

    await TestBed.configureTestingModule({
      imports: [AdminPageComponent, MatDialogModule],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    // Spy on the SAME MatDialog instance the component uses (see CLAUDE.md).
    dialogOpenSpy = vi.spyOn(
      fixture.debugElement.injector.get(MatDialog),
      'open'
    );
    fixture.detectChanges();
    // Let the httpsCallable promises resolve.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('user list initialization', () => {
    it('should load users on init via the adminListUsers callable', async () => {
      // given / when
      await createComponent([sampleUser]);

      // then
      expect(component.users().length).toBe(1);
      expect(callablesMock.call).toHaveBeenCalledWith('adminListUsers');
    });
  });

  describe('openDetailsDialog', () => {
    it('should open UserDetailsDialogComponent with the clicked user as data', async () => {
      // given
      await createComponent();
      dialogOpenSpy.mockReturnValue(stubDialogRef(undefined));

      // when
      component.openDetailsDialog(sampleUser);

      // then
      expect(dialogOpenSpy).toHaveBeenCalledWith(
        UserDetailsDialogComponent,
        expect.objectContaining({ data: sampleUser })
      );
    });

    it('should open the details dialog when a non-actions cell of a rendered row is clicked', async () => {
      // given — render a row so the template (click) wiring is exercised
      await createComponent([sampleUser]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(undefined));

      // when — pick a non-actions cell so we don't hit the stopPropagation handler
      const nameCell = fixture.nativeElement.querySelector(
        'mat-row.clickable-row mat-cell.mat-column-displayName'
      ) as HTMLElement | null;
      expect(nameCell).toBeTruthy();
      if (!nameCell) return;
      nameCell.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );

      // then
      expect(dialogOpenSpy).toHaveBeenCalledWith(
        UserDetailsDialogComponent,
        expect.objectContaining({ data: sampleUser })
      );
    });

    it('should open only the delete dialog (not the details dialog) when the row delete button is clicked', async () => {
      // given — render a single user so a row + delete button exist
      await createComponent([sampleUser]);
      // Stub the delete-confirmation dialog so the (await) delete flow does not
      // call the (mocked-missing) adminDeleteUser callable.
      dialogOpenSpy.mockReturnValue(stubDialogRef(undefined));

      // when
      const deleteButton = fixture.nativeElement.querySelector(
        'mat-cell.mat-column-actions button'
      ) as HTMLButtonElement | null;
      expect(deleteButton).toBeTruthy();
      if (!deleteButton) return;
      deleteButton.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
      await fixture.whenStable();

      // then — the delete dialog opens ...
      expect(dialogOpenSpy).toHaveBeenCalledWith(
        DeleteUserDialogComponent,
        expect.objectContaining({ data: sampleUser })
      );
      // ... but the row click handler must NOT fire (stopPropagation works)
      expect(dialogOpenSpy).not.toHaveBeenCalledWith(
        UserDetailsDialogComponent,
        expect.anything()
      );
    });
  });
});
