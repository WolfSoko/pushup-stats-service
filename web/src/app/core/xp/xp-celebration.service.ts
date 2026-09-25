import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DEMO_USER_ID, ExerciseFirestoreService } from '@pu-stats/data-access';
import { XpStore } from '@pu-stats/data-access-state';
import {
  xpForLevel,
  type ExerciseEntry,
  type XpEntryInput,
} from '@pu-stats/models';

import { CelebrationQueueService } from '../celebration-queue.service';
import { notifyEntrySaved } from '../quick-add-notify';
import { XpGainedDialogComponent } from './xp-gained-dialog.component';
import { buildXpGainedData, type XpGainedDialogData } from './xp-gained.models';

/** Saves this close together (a plan day, a goal check-off) share one dialog. */
export const XP_COALESCE_MS = 800;

let nextTitleId = 0;

interface XpBatch {
  readonly entries: XpEntryInput[];
  /** Total XP before these entries, or null when it was not loaded yet. */
  readonly baseline: number | null;
}

export interface XpHold {
  release(): void;
}

/**
 * Celebrates every saved entry with the "+XP" dialog — hooked once onto
 * `ExerciseFirestoreService.entryCreated$`, so no save path has to know
 * about it. It also owns the saved confirmation: when no dialog is due
 * (demo account, an entry worth nothing) it falls back to the plain
 * "Eintrag gespeichert" snackbar.
 *
 * The level bar starts from the total captured when the first entry of a
 * batch arrived: by the time a batch is shown the server may already have
 * booked it, and reading the live total then would count it twice.
 */
@Injectable({ providedIn: 'root' })
export class XpCelebrationService {
  private readonly injector = inject(Injector);
  private readonly dialog = inject(MatDialog);
  private readonly queue = inject(CelebrationQueueService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly demoUserId = inject(DEMO_USER_ID);
  private readonly holds: Array<{ sources: Set<string>; batch: XpBatch }> = [];
  private pending: XpBatch | null = null;
  private flushPending: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    inject(ExerciseFirestoreService, { optional: true })
      ?.entryCreated$?.pipe(takeUntilDestroyed())
      .subscribe((entry) => this.onCreated(entry));
  }

  /**
   * Collects entries of the given sources until released, then shows one
   * dialog — a session celebrates on its done screen, not after each set.
   * Saves from other sources keep celebrating as usual.
   */
  hold(sources: ReadonlyArray<string>): XpHold {
    const hold = { sources: new Set(sources), batch: this.newBatch() };
    this.holds.push(hold);
    return {
      release: () => {
        const index = this.holds.indexOf(hold);
        if (index < 0) return;
        this.holds.splice(index, 1);
        const data = this.dialogData(hold.batch, true);
        if (data) this.show(data);
      },
    };
  }

  /** Admin preview with sample entries. */
  showPreview(levelUp: boolean): void {
    const sample: XpEntryInput[] = [
      { exerciseId: 'pushup', reps: 40 },
      { exerciseId: 'pull.pullups', reps: 10 },
    ];
    const store = this.store();
    const gain = sample.reduce((sum, e) => sum + store.previewXp(e), 0);
    const data = buildXpGainedData(
      sample,
      (entry) => store.previewXp(entry),
      levelUp ? xpForLevel(5) - Math.ceil(gain / 2) : xpForLevel(5) + 10,
      `xp-gained-title-${nextTitleId++}`
    );
    if (data) this.show(data);
  }

  private onCreated(entry: ExerciseEntry): void {
    if (entry.userId === this.demoUserId) {
      notifyEntrySaved(this.snackBar);
      return;
    }
    const hold = this.holds.find((h) => h.sources.has(entry.source));
    if (hold) {
      hold.batch.entries.push(entry);
      return;
    }
    if (!this.pending) this.startPending();
    this.pending?.entries.push(entry);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), XP_COALESCE_MS);
  }

  /**
   * Takes the queue slot right away, so the queue reads as busy while the
   * batch is still collecting — nothing else jumps in between.
   */
  private startPending(): void {
    let ready!: () => void;
    const collected = new Promise<void>((resolve) => (ready = resolve));
    const batch = this.newBatch();
    this.pending = batch;
    this.flushPending = ready;
    void this.queue.enqueue(async () => {
      await collected;
      const data = this.dialogData(batch, false);
      if (!data) {
        if (batch.entries.length > 0) notifyEntrySaved(this.snackBar);
        return null;
      }
      return this.open(data);
    });
  }

  private flush(): void {
    this.pending = null;
    this.flushPending?.();
    this.flushPending = null;
  }

  /**
   * `settled`: the batch was collected long enough (a session) that the
   * server has booked it — without a captured baseline the live total
   * already contains it. A quick save is shown before the booking lands.
   */
  private dialogData(
    batch: XpBatch,
    settled: boolean
  ): XpGainedDialogData | null {
    if (batch.entries.length === 0) return null;
    const store = this.store();
    const preview = (entry: XpEntryInput) => store.previewXp(entry);
    const gained = batch.entries.reduce((sum, e) => sum + preview(e), 0);
    const baseline =
      batch.baseline ??
      (settled ? Math.max(0, store.totalXp() - gained) : store.totalXp());
    return buildXpGainedData(
      batch.entries,
      preview,
      baseline,
      `xp-gained-title-${nextTitleId++}`
    );
  }

  private show(data: XpGainedDialogData): void {
    void this.queue.enqueue(() => this.open(data));
  }

  private open(data: XpGainedDialogData) {
    return this.dialog.open(XpGainedDialogComponent, {
      data,
      panelClass: 'xp-gained-dialog-panel',
      autoFocus: 'dialog',
      restoreFocus: true,
      ariaLabelledBy: data.titleId,
      width: 'min(92vw, 400px)',
      maxWidth: '92vw',
    });
  }

  private newBatch(): XpBatch {
    const store = this.store();
    return { entries: [], baseline: store.loaded() ? store.totalXp() : null };
  }

  /** Resolved on first use, so app start does not open the XP listeners. */
  private store() {
    return this.injector.get(XpStore);
  }
}
