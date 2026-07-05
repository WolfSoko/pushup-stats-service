import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { of } from 'rxjs';
import { AdminFeedbackSectionComponent } from './admin-feedback-section.component';
import { CallableFunctionsService } from './callable-functions.service';
import { DeleteFeedbackDialogComponent } from './delete-feedback-dialog.component';

interface CallableRecord {
  name: string;
  impl: (data: unknown) => Promise<{ data: unknown }>;
}

// Faked via DI instead of vi.mock('@angular/fire/functions'): module
// mocks of the fire package break whenever the spec bundler moves it
// into a shared chunk (the mocked `Functions` token and the component's
// bundled one are then different classes -> NG0201), and which admin
// spec breaks shifts with the workspace's overall spec-file set.
const callablesMock = { call: vi.fn() };

function setupCallables(records: CallableRecord[]): void {
  callablesMock.call.mockImplementation((name: string) => {
    const match = records.find((r) => r.name === name);
    if (!match) {
      return async () => {
        throw new Error(`Unexpected callable: ${name}`);
      };
    }
    return match.impl;
  });
}

describe('AdminFeedbackSectionComponent', () => {
  let fixture: ComponentFixture<AdminFeedbackSectionComponent>;
  let component: AdminFeedbackSectionComponent;
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
      { name: 'adminListFeedback', impl: async () => ({ data: feedback }) },
      ...extraCallables,
    ]);

    await TestBed.configureTestingModule({
      imports: [AdminFeedbackSectionComponent, MatDialogModule],
      providers: [
        { provide: CallableFunctionsService, useValue: callablesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFeedbackSectionComponent);
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
    it('should load feedback on init via the adminListFeedback callable', async () => {
      // given / when
      await createComponent();

      // then
      expect(component.feedbackList().length).toBe(2);
      expect(component.feedbackList()[0].id).toBe('fb-1');
      expect(callablesMock.call).toHaveBeenCalledWith('adminListFeedback');
    });

    it('should keep the list empty when the Cloud Function returns empty data', async () => {
      // given / when
      await createComponent([]);

      // then
      expect(component.feedbackList()).toEqual([]);
    });
  });

  describe('deleteFeedback', () => {
    it('should open the confirmation dialog before deleting', async () => {
      // given
      await createComponent();
      dialogOpenSpy.mockReturnValue(stubDialogRef(false));

      // when
      await component.deleteFeedback(baseFeedback[0]);

      // then
      expect(dialogOpenSpy).toHaveBeenCalledWith(
        DeleteFeedbackDialogComponent,
        expect.objectContaining({
          data: { name: 'Alice', message: 'Nice app!' },
        })
      );
    });

    it('should NOT call adminDeleteFeedback when the user cancels', async () => {
      // given
      const deleteCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(false));

      // when
      await component.deleteFeedback(baseFeedback[0]);

      // then
      expect(deleteCallable).not.toHaveBeenCalled();
      expect(component.feedbackList().length).toBe(2);
    });

    it('should call adminDeleteFeedback and remove the row when the user confirms', async () => {
      // given
      const deleteCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      // when
      await component.deleteFeedback(baseFeedback[0]);

      // then
      expect(deleteCallable).toHaveBeenCalledWith({ feedbackId: 'fb-1' });
      expect(component.feedbackList().map((f) => f.id)).toEqual(['fb-2']);
      expect(component.feedbackActionError()).toBeNull();
    });

    it('should show an error and keep the row when the Cloud Function fails', async () => {
      // given
      const deleteCallable = vi.fn(async () => {
        throw new Error('permission-denied');
      });
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      // when
      await component.deleteFeedback(baseFeedback[0]);

      // then
      expect(component.feedbackActionError()).toBe('permission-denied');
      expect(component.feedbackList().length).toBe(2);
      expect(component.isFeedbackActionLoading('fb-1')).toBe(false);
    });

    it('should reset the per-row loading state after a successful delete', async () => {
      // given
      const deleteCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminDeleteFeedback', impl: deleteCallable },
      ]);
      dialogOpenSpy.mockReturnValue(stubDialogRef(true));

      // when
      await component.deleteFeedback(baseFeedback[0]);

      // then
      expect(component.isFeedbackActionLoading('fb-1')).toBe(false);
    });
  });

  describe('markFeedbackRead', () => {
    it('should flip the read flag for the matching row on success', async () => {
      // given
      const markCallable = vi.fn(async () => ({ data: { ok: true } }));
      await createComponent(baseFeedback, [
        { name: 'adminMarkFeedbackRead', impl: markCallable },
      ]);

      // when
      await component.markFeedbackRead(baseFeedback[0], true);

      // then
      expect(markCallable).toHaveBeenCalledWith({
        feedbackId: 'fb-1',
        read: true,
      });
      expect(component.feedbackList()[0].read).toBe(true);
    });
  });

  describe('createGithubIssue', () => {
    it('should store the returned issue URL on the matching row on success', async () => {
      // given
      const createCallable = vi.fn(async () => ({
        data: { ok: true, issueUrl: 'https://github.com/x/y/issues/1' },
      }));
      await createComponent(baseFeedback, [
        { name: 'adminCreateGithubIssue', impl: createCallable },
      ]);

      // when
      await component.createGithubIssue(baseFeedback[1]);

      // then
      expect(createCallable).toHaveBeenCalledWith({ feedbackId: 'fb-2' });
      const updated = component.feedbackList().find((f) => f.id === 'fb-2');
      expect(updated?.githubIssueUrl).toBe('https://github.com/x/y/issues/1');
    });
  });
});
