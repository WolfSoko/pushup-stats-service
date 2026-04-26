import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Functions, httpsCallable } from '@angular/fire/functions';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { of } from 'rxjs';
import { AdminPageComponent, AdminUser } from './admin-page.component';
import { DeleteFeedbackDialogComponent } from './delete-feedback-dialog.component';
import { UserDetailsDialogComponent } from './user-details-dialog.component';

vi.mock('@angular/fire/functions', () => ({
  Functions: class {},
  httpsCallable: vi.fn(),
}));

interface CallableRecord {
  name: string;
  impl: (data: unknown) => Promise<{ data: unknown }>;
}

function setupCallables(records: CallableRecord[]): void {
  vi.mocked(httpsCallable).mockImplementation(
    (_functions: Functions, name: string) => {
      const match = records.find((r) => r.name === name);
      if (!match) {
        return (async () => {
          throw new Error(`Unexpected callable: ${name}`);
        }) as unknown as ReturnType<typeof httpsCallable>;
      }
      return match.impl as unknown as ReturnType<typeof httpsCallable>;
    }
  );
}

describe('AdminPageComponent', () => {
  let fixture: ComponentFixture<AdminPageComponent>;
  let component: AdminPageComponent;
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;

  function stubDialogRef<T>(result: T): MatDialogRef<unknown, T> {
    return { afterClosed: () => of(result) } as MatDialogRef<unknown, T>;
  }

  const baseFeedback = [
    {
      id: 'fb-1',
      name: 'Alice',
      email: 'alice@example.com',
      message: 'Nice app!',
      userId: 'user-1',
      createdAt: '2026-04-09T10:00:00.000Z',
      userAgent: null,
      read: false,
      githubIssueUrl: null,
    },
    {
      id: 'fb-2',
      name: null,
      email: null,
      message: 'Bug report: button does nothing',
      userId: null,
      createdAt: '2026-04-08T09:00:00.000Z',
      userAgent: null,
      read: false,
      githubIssueUrl: null,
    },
  ];

  async function createComponent(
    feedback = baseFeedback,
    extraCallables: CallableRecord[] = []
  ): Promise<void> {
    setupCallables([
      { name: 'adminListUsers', impl: async () => ({ data: [] }) },
      { name: 'adminListFeedback', impl: async () => ({ data: feedback }) },
      ...extraCallables,
    ]);

    await TestBed.configureTestingModule({
      imports: [AdminPageComponent, MatDialogModule],
      providers: [{ provide: Functions, useValue: {} }],
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

  describe('feedback list initialization', () => {
    it('loads feedback on init via adminListFeedback callable', async () => {
      await createComponent();
      expect(component.feedbackList().length).toBe(2);
      expect(component.feedbackList()[0].id).toBe('fb-1');
      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        'adminListFeedback'
      );
    });

    it('keeps the list empty when the Cloud Function returns empty data', async () => {
      await createComponent([]);
      expect(component.feedbackList()).toEqual([]);
    });
  });

  describe('deleteFeedback', () => {
    it('opens the confirmation dialog before deleting', async () => {
      await createComponent();
      dialogOpenSpy.mockReturnValue(stubDialogRef(false));

      await component.deleteFeedback(baseFeedback[0]);

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        DeleteFeedbackDialogComponent,
        expect.objectContaining({
          data: { name: 'Alice', message: 'Nice app!' },
        })
      );
    });

    it('does NOT call adminDeleteFeedback when the user cancels', async () => {
      const deleteCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(false));

      await component.deleteFeedback(baseFeedback[0]);

      expect(deleteCallable).not.toHaveBeenCalled();
      expect(component.feedbackList().length).toBe(2);
    });

    it('calls adminDeleteFeedback and removes the row when the user confirms', async () => {
      const deleteCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      await component.deleteFeedback(baseFeedback[0]);

      expect(deleteCallable).toHaveBeenCalledWith({ feedbackId: 'fb-1' });
      expect(component.feedbackList().map((f) => f.id)).toEqual(['fb-2']);
      expect(component.feedbackActionError()).toBeNull();
    });

    it('shows an error message and keeps the row when the Cloud Function fails', async () => {
      const deleteCallable = vi.fn(async () => {
        throw new Error('permission-denied');
      });
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      await component.deleteFeedback(baseFeedback[0]);

      expect(component.feedbackActionError()).toBe('permission-denied');
      expect(component.feedbackList().length).toBe(2);
      expect(component.isFeedbackActionLoading('fb-1')).toBe(false);
    });

    it('resets the per-row loading state after a successful delete', async () => {
      const deleteCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      await component.deleteFeedback(baseFeedback[0]);

      expect(component.isFeedbackActionLoading('fb-1')).toBe(false);
    });
  });

  describe('markFeedbackRead', () => {
    it('flips the read flag for the matching row on success', async () => {
      const markCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminMarkFeedbackRead', impl: markCallable },
      ]);

      await component.markFeedbackRead(baseFeedback[0], true);

      expect(markCallable).toHaveBeenCalledWith({
        feedbackId: 'fb-1',
        read: true,
      });
      expect(component.feedbackList()[0].read).toBe(true);
    });
  });

  describe('openDetailsDialog', () => {
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

    it('opens UserDetailsDialogComponent with the clicked user as data', async () => {
      await createComponent();
      dialogOpenSpy.mockReturnValue(stubDialogRef(undefined));

      component.openDetailsDialog(sampleUser);

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        UserDetailsDialogComponent,
        expect.objectContaining({ data: sampleUser })
      );
    });

    it('does NOT open the details dialog when a row action button is clicked', async () => {
      // Render a single user so a row exists in the table.
      setupCallables([
        { name: 'adminListUsers', impl: async () => ({ data: [sampleUser] }) },
        { name: 'adminListFeedback', impl: async () => ({ data: [] }) },
      ]);
      await TestBed.configureTestingModule({
        imports: [AdminPageComponent, MatDialogModule],
        providers: [{ provide: Functions, useValue: {} }],
      }).compileComponents();
      fixture = TestBed.createComponent(AdminPageComponent);
      component = fixture.componentInstance;
      dialogOpenSpy = vi.spyOn(
        fixture.debugElement.injector.get(MatDialog),
        'open'
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const actionsCell = fixture.nativeElement.querySelector(
        'mat-cell.mat-column-actions'
      ) as HTMLElement | null;
      expect(actionsCell).toBeTruthy();

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      actionsCell!.dispatchEvent(event);

      // The actions cell stops propagation, so the row handler must not fire.
      expect(dialogOpenSpy).not.toHaveBeenCalledWith(
        UserDetailsDialogComponent,
        expect.anything()
      );
    });
  });
});
