import { signal } from '@angular/core';
import type { ComplexGoals } from '@pu-stats/models';
import {
  AUTO_SAVE_DEBOUNCE_MS,
  SAVED_INDICATOR_MS,
  type SaveStatus,
} from './goals-page.models';
import { cloneGoals, scopesEqual } from './goals-page.helpers';

export interface GoalsAutoSaveDeps {
  readDraft: () => ComplexGoals;
  applyDraft: (goals: ComplexGoals) => void;
  save: (goals: ComplexGoals) => Promise<unknown>;
  isBrowser: boolean;
}

/**
 * Owns the debounced auto-save state machine for the goals page: dirty
 * detection against the last persisted snapshot, the debounce + saved-indicator
 * timers, and coalescing of overlapping save round trips. The component drives
 * it from its hydration and draft-change effects and binds `saveStatus` in the
 * template; all timer and in-flight bookkeeping lives here.
 */
export class GoalsAutoSaveController {
  readonly saveStatus = signal<SaveStatus>('idle');

  /**
   * Last successfully persisted snapshot. Drafts are compared against this to
   * decide whether a save is needed. `null` until the first hydration, which is
   * why save is suppressed before the baseline exists.
   */
  private readonly lastPersisted = signal<ComplexGoals | null>(null);
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightSave: Promise<void> | null = null;

  constructor(private readonly deps: GoalsAutoSaveDeps) {}

  /**
   * Hydrate drafts from the store, unless the user has dirty edits or a save is
   * mid-flight — otherwise the realtime listener clobbers input the user is
   * mid-editing. Dirty is measured against the OLD baseline, never the incoming
   * goals (else every store emission would look dirty).
   */
  hydrate(goals: ComplexGoals): void {
    const status = this.saveStatus();
    const baseline = this.lastPersisted();
    const dirty =
      baseline !== null && !scopesEqual(this.deps.readDraft(), baseline);
    if (
      baseline !== null &&
      (status === 'pending' || status === 'saving' || dirty)
    ) {
      return;
    }
    this.deps.applyDraft(cloneGoals(goals));
    this.lastPersisted.set(cloneGoals(goals));
    if (this.saveStatus() === 'pending') this.saveStatus.set('idle');
  }

  onDraftChange(draft: ComplexGoals): void {
    const baseline = this.lastPersisted();
    if (baseline === null) return;
    if (scopesEqual(draft, baseline)) {
      this.cancelTimer();
      // Clean draft: clear any leftover 'pending' or stale 'error' pill. Never
      // stomp a 'saving' status mid-round-trip.
      if (this.saveStatus() !== 'saving') this.saveStatus.set('idle');
      return;
    }
    this.schedule();
  }

  retry(): void {
    void this.flush();
  }

  destroy(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
      // Flush the pending dirty draft before teardown — cancelling the timer
      // would otherwise silently drop edits made within the debounce window.
      void this.flush();
    }
    if (this.savedTimer !== null) {
      clearTimeout(this.savedTimer);
      this.savedTimer = null;
    }
  }

  private schedule(): void {
    this.saveStatus.set('pending');
    this.cancelTimer();
    if (!this.deps.isBrowser) {
      // SSR: never schedule timers; the user can't interact anyway.
      return;
    }
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.flush();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  cancelTimer(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private async flush(): Promise<void> {
    if (this.inFlightSave) {
      // Coalesce: wait for the running save, then re-check for newer drafts.
      await this.inFlightSave;
      const baseline = this.lastPersisted();
      if (baseline && scopesEqual(this.deps.readDraft(), baseline)) return;
    }
    const run = this.performSave();
    this.inFlightSave = run;
    try {
      await run;
    } finally {
      if (this.inFlightSave === run) this.inFlightSave = null;
    }
  }

  private async performSave(): Promise<void> {
    this.cancelTimer();
    const draft = this.deps.readDraft();
    this.saveStatus.set('saving');
    try {
      await this.deps.save(draft);
      this.lastPersisted.set(cloneGoals(draft));
      this.saveStatus.set('saved');
      if (this.savedTimer !== null) clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => {
        this.savedTimer = null;
        if (this.saveStatus() === 'saved') this.saveStatus.set('idle');
      }, SAVED_INDICATOR_MS);
    } catch {
      this.saveStatus.set('error');
    }
  }
}
