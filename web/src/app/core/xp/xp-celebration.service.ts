import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { DEMO_USER_ID } from '@pu-stats/data-access';
import { XpStore } from '@pu-stats/data-access-state';
import { xpForLevel, type XpEntryInput } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';

import { XpGainedDialogComponent } from './xp-gained-dialog.component';
import { buildXpGainedData, type XpGainedDialogData } from './xp-gained.models';

let nextTitleId = 0;

export interface XpHold {
  /** Hands over (and clears) what was collected so far. */
  take(): Array<XpEntryInput | null | undefined>;
  release(): void;
}

/**
 * Opens the "+XP" celebration right after an entry is saved.
 *
 * The number is a client-side preview at today's rates: the server books
 * the entry a moment later and may freeze a different rate only if an
 * admin changed it in between. Other celebrations (goal reached) wait for
 * {@link whenIdle} so two modals never stack.
 */
@Injectable({ providedIn: 'root' })
export class XpCelebrationService {
  private readonly dialog = inject(MatDialog);
  private readonly xp = inject(XpStore);
  // Read at call time rather than through `UserContextService`: this
  // service sits under many save paths, and that chain drags the whole
  // auth adapter into every harness that reaches one of them.
  private readonly auth = inject(Auth, { optional: true });
  private readonly demoUserId = inject(DEMO_USER_ID);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private ref: MatDialogRef<XpGainedDialogComponent> | null = null;
  private idle: Promise<void> = Promise.resolve();
  private pending = 0;
  private holds = 0;
  private held: Array<XpEntryInput | null | undefined> = [];

  /** Resolves once no XP dialog is open. */
  whenIdle(): Promise<void> {
    return this.idle;
  }

  isShowing(): boolean {
    return this.ref !== null;
  }

  /** Runs `fn` right away when no XP dialog is open or queued, else after it. */
  afterIdle(fn: () => void): void {
    if (this.pending === 0) fn();
    else void this.idle.then(fn);
  }

  /**
   * Collects every `celebrate` call until released, instead of opening a
   * dialog per call — a session gathers its entries for the done screen.
   */
  hold(): XpHold {
    this.holds++;
    let released = false;
    return {
      take: () => {
        const entries = this.held;
        this.held = [];
        return entries;
      },
      release: () => {
        if (released) return;
        released = true;
        this.holds--;
      },
    };
  }

  /** One dialog for everything `work` saves. */
  async batch<T>(work: () => Promise<T>): Promise<T> {
    const hold = this.hold();
    try {
      return await work();
    } finally {
      const entries = hold.take();
      hold.release();
      if (entries.length > 0) this.celebrate(entries);
    }
  }

  /** Returns whether a dialog opened; callers fall back to a snackbar otherwise. */
  celebrate(entries: ReadonlyArray<XpEntryInput | null | undefined>): boolean {
    if (this.holds > 0) {
      this.held.push(...entries);
      return true;
    }
    const user = this.auth?.currentUser;
    if (!this.isBrowser || !user || user.isAnonymous) return false;
    if (user.uid === this.demoUserId) return false;

    const data = buildXpGainedData(
      entries,
      (entry) => this.xp.previewXp(entry),
      this.xp.totalXp(),
      `xp-gained-title-${nextTitleId++}`
    );
    if (!data) return false;

    this.ref?.close();
    this.idle = this.open(data);
    return true;
  }

  /** Admin preview with sample entries, bypassing the guest/demo gates. */
  showPreview(levelUp: boolean): void {
    const sample: XpEntryInput[] = [
      { exerciseId: 'pushup', reps: 40 },
      { exerciseId: 'pull.pullups', reps: 10 },
    ];
    const gain = sample.reduce((sum, e) => sum + this.xp.previewXp(e), 0);
    const data = buildXpGainedData(
      sample,
      (entry) => this.xp.previewXp(entry),
      levelUp ? xpForLevel(5) - Math.ceil(gain / 2) : xpForLevel(5) + 10,
      `xp-gained-title-${nextTitleId++}`
    );
    if (data) this.idle = this.open(data);
  }

  /**
   * A goal dialog may already be up: the live listener sees the local
   * write before the save resolves. The XP dialog then queues behind it.
   */
  private async open(data: XpGainedDialogData): Promise<void> {
    this.pending++;
    try {
      await this.show(data);
    } finally {
      this.pending--;
    }
  }

  private async show(data: XpGainedDialogData): Promise<void> {
    if (this.dialog.openDialogs.length > 0) {
      await firstValueFrom(this.dialog.afterAllClosed);
    }
    const ref = this.dialog.open(XpGainedDialogComponent, {
      data,
      panelClass: 'xp-gained-dialog-panel',
      autoFocus: 'dialog',
      restoreFocus: true,
      ariaLabelledBy: data.titleId,
      width: 'min(92vw, 400px)',
      maxWidth: '92vw',
    });
    this.ref = ref;
    await firstValueFrom(ref.afterClosed());
    if (this.ref === ref) this.ref = null;
  }
}
