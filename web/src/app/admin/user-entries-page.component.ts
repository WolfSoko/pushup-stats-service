import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type ExerciseEntry, TRAINING_PLANS } from '@pu-stats/models';
import { TrainingEntryDialogComponent } from '../stats/components/training-entry-dialog/training-entry-dialog.component';
import { type TrainingEntryDialogResult } from '../stats/components/training-entry-dialog/training-entry-dialog.models';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { CallableFunctionsService } from './callable-functions.service';
import { errorMessage } from './admin-page.helpers';
import { AdminUserDetails } from './admin-page.models';
import { UserEntriesTableComponent } from './user-entries-table.component';
import { dialogResultToPatch, entryToDialogData } from './user-entries.helpers';

/**
 * Admin drill-down into one user's exercise entries, as a routed page
 * (`/admin/users/:uid/entries`). Reads through the `adminListUserEntries`
 * callable (client Firestore rules scope reads to the owner), loads richer
 * user detail via `adminGetUserDetails` for the header, renders a sortable
 * table, and opens the shared {@link TrainingEntryDialogComponent} per row —
 * the same editor the history page uses — persisting via `adminUpdateUserEntry`.
 */
@Component({
  selector: 'app-user-entries-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PageHeaderComponent,
    UserEntriesTableComponent,
  ],
  templateUrl: './user-entries-page.component.html',
  styleUrl: './user-entries-page.component.scss',
})
export class UserEntriesPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly callables = inject(CallableFunctionsService);
  private readonly dialog = inject(MatDialog);

  readonly uid = this.route.snapshot.paramMap.get('uid') ?? '';
  // The admin list passes a friendly label via navigation state for an instant
  // header before `adminGetUserDetails` resolves; a deep-link/reload loses it,
  // so fall back to the uid.
  private readonly initialLabel =
    (typeof history !== 'undefined' &&
      (history.state as { label?: string } | null)?.label) ||
    this.uid;

  readonly refreshTooltip = $localize`:@@admin.entries.refresh:Neu laden`;
  readonly copyUidTooltip = $localize`:@@admin.entries.copyUid:UID kopieren`;
  readonly adminBadge = $localize`:@@admin.entries.roleAdmin:Admin`;
  readonly anonBadge = $localize`:@@admin.entries.anonymous:Anonym`;
  readonly publicBadge = $localize`:@@admin.entries.publicProfile:Öffentliches Profil`;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly entries = signal<ExerciseEntry[]>([]);
  readonly details = signal<AdminUserDetails | null>(null);

  readonly userLabel = computed(() => {
    const d = this.details();
    return d ? (d.displayName ?? d.email ?? d.uid) : this.initialLabel;
  });

  // Entries load newest-first, so the last row is the oldest loaded entry.
  // With the default 1000-entry page this is the true first entry for all but
  // the most prolific users.
  readonly firstEntry = computed(() => {
    const list = this.entries();
    return list.length > 0 ? list[list.length - 1].timestamp : null;
  });

  readonly activePlanTitle = computed(() => {
    const plan = this.details()?.activePlan;
    if (!plan) return null;
    return (
      TRAINING_PLANS.find((p) => p.id === plan.planId)?.title ?? plan.planId
    );
  });

  constructor() {
    void this.loadEntries();
    void this.loadDetails();
  }

  async loadEntries(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const fn = this.callables.call<{ uid: string }, ExerciseEntry[]>(
        'adminListUserEntries'
      );
      const result = await fn({ uid: this.uid });
      this.entries.set(result.data);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async loadDetails(): Promise<void> {
    // Header detail is supplementary — a failure here must not blank the
    // entries table, so it's swallowed (the uid header still renders).
    try {
      const fn = this.callables.call<{ uid: string }, AdminUserDetails>(
        'adminGetUserDetails'
      );
      const result = await fn({ uid: this.uid });
      this.details.set(result.data);
    } catch {
      this.details.set(null);
    }
  }

  async openEditDialog(entry: ExerciseEntry): Promise<void> {
    const ref = this.dialog.open(TrainingEntryDialogComponent, {
      data: entryToDialogData(entry),
      width: 'min(96vw, 560px)',
      maxWidth: '96vw',
    });
    const result = await firstValueFrom<TrainingEntryDialogResult | undefined>(
      ref.afterClosed()
    );
    if (!result) return;

    const patch = dialogResultToPatch(entry, result);
    // Nothing actually changed — skip the write so we don't bump `updatedAt`
    // or re-trigger aggregates for a no-op save.
    if (Object.keys(patch).length === 0) return;

    try {
      const fn = this.callables.call('adminUpdateUserEntry');
      await fn({ uid: this.uid, entryId: entry._id, patch });
      // Reload rather than optimistic-merge: the shared dialog can clear
      // breakdowns / variants, so a naive spread would misrepresent the row.
      await this.loadEntries();
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  async copyUid(): Promise<void> {
    try {
      await navigator.clipboard?.writeText(this.uid);
    } catch {
      // Clipboard may be unavailable (insecure context / denied) — no-op.
    }
  }
}
