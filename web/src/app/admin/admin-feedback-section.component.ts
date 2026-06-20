import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DeleteFeedbackDialogComponent } from './delete-feedback-dialog.component';
import { AdminFeedback } from './admin-page.models';
import {
  adminFeedbackSortValue,
  errorMessage,
  toggleSetMember,
} from './admin-page.helpers';

@Component({
  selector: 'app-admin-feedback-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-feedback-section.component.html',
  styleUrl: './admin-feedback-section.component.scss',
})
export class AdminFeedbackSectionComponent {
  private readonly functions = inject(Functions);
  private readonly dialog = inject(MatDialog);

  readonly refreshTooltip = $localize`:@@admin.refresh:Neu laden`;
  readonly anonymTooltip = $localize`:@@admin.feedback.anon:Anonym`;
  readonly markReadTooltip = $localize`:@@admin.feedback.markRead:Als gelesen markieren`;
  readonly markUnreadTooltip = $localize`:@@admin.feedback.markUnread:Als ungelesen markieren`;
  readonly createIssueTooltip = $localize`:@@admin.feedback.createIssue:GitHub-Issue erstellen`;
  readonly openIssueTooltip = $localize`:@@admin.feedback.openIssue:GitHub-Issue öffnen`;
  readonly deleteFeedbackTooltip = $localize`:@@admin.feedback.delete:Feedback löschen`;

  readonly feedbackColumns = [
    'createdAt',
    'name',
    'email',
    'message',
    'userId',
    'feedbackActions',
  ];
  readonly feedbackLoading = signal(false);
  readonly feedbackError = signal<string | null>(null);
  readonly feedbackList = signal<AdminFeedback[]>([]);
  readonly feedbackActionLoading = signal<Set<string>>(new Set());
  readonly feedbackActionError = signal<string | null>(null);

  readonly feedbackDataSource = new MatTableDataSource<AdminFeedback>([]);
  private readonly feedbackSort = viewChild<MatSort>('feedbackSort');

  constructor() {
    this.feedbackDataSource.sortingDataAccessor = adminFeedbackSortValue;
    effect(() => {
      this.feedbackDataSource.data = this.feedbackList();
    });
    effect(() => {
      const s = this.feedbackSort();
      if (s) this.feedbackDataSource.sort = s;
    });
    this.loadFeedback();
  }

  async loadFeedback(): Promise<void> {
    this.feedbackLoading.set(true);
    this.feedbackError.set(null);
    try {
      const fn = httpsCallable<void, AdminFeedback[]>(
        this.functions,
        'adminListFeedback'
      );
      const result = await fn();
      this.feedbackList.set(result.data);
    } catch (err) {
      this.feedbackError.set(errorMessage(err));
    } finally {
      this.feedbackLoading.set(false);
    }
  }

  isFeedbackActionLoading(id: string): boolean {
    return this.feedbackActionLoading().has(id);
  }

  private setFeedbackLoading(id: string, loading: boolean): void {
    this.feedbackActionLoading.update((s) => toggleSetMember(s, id, loading));
  }

  async markFeedbackRead(
    feedback: AdminFeedback,
    read: boolean
  ): Promise<void> {
    this.setFeedbackLoading(feedback.id, true);
    this.feedbackActionError.set(null);
    try {
      const fn = httpsCallable(this.functions, 'adminMarkFeedbackRead');
      await fn({ feedbackId: feedback.id, read });
      this.feedbackList.update((list) =>
        list.map((f) => (f.id === feedback.id ? { ...f, read } : f))
      );
    } catch (err) {
      this.feedbackActionError.set(errorMessage(err));
    } finally {
      this.setFeedbackLoading(feedback.id, false);
    }
  }

  async deleteFeedback(feedback: AdminFeedback): Promise<void> {
    const ref = this.dialog.open<
      DeleteFeedbackDialogComponent,
      { name: string | null; message: string },
      boolean
    >(DeleteFeedbackDialogComponent, {
      data: { name: feedback.name, message: feedback.message },
      width: '480px',
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.setFeedbackLoading(feedback.id, true);
    this.feedbackActionError.set(null);
    try {
      const fn = httpsCallable(this.functions, 'adminDeleteFeedback');
      await fn({ feedbackId: feedback.id });
      this.feedbackList.update((list) =>
        list.filter((f) => f.id !== feedback.id)
      );
    } catch (err) {
      this.feedbackActionError.set(errorMessage(err));
    } finally {
      this.setFeedbackLoading(feedback.id, false);
    }
  }

  async createGithubIssue(feedback: AdminFeedback): Promise<void> {
    this.setFeedbackLoading(feedback.id, true);
    this.feedbackActionError.set(null);
    try {
      const fn = httpsCallable<unknown, { ok: boolean; issueUrl: string }>(
        this.functions,
        'adminCreateGithubIssue'
      );
      const result = await fn({ feedbackId: feedback.id });
      this.feedbackList.update((list) =>
        list.map((f) =>
          f.id === feedback.id
            ? { ...f, githubIssueUrl: result.data.issueUrl }
            : f
        )
      );
    } catch (err) {
      this.feedbackActionError.set(errorMessage(err));
    } finally {
      this.setFeedbackLoading(feedback.id, false);
    }
  }
}
