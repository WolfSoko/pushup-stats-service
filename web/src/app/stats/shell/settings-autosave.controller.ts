import { signal } from '@angular/core';
import type { DisplayNameViolation, UserConfigUpdate } from '@pu-stats/models';
import {
  AUTO_SAVE_DEBOUNCE_MS,
  SAVED_INDICATOR_MS,
  type DraftSnapshot,
  type ResolvedConfig,
  type SaveStatus,
} from './settings-page.models';
import {
  buildSaveUpdate,
  snapshotFromConfig,
  snapshotsEqual,
} from './settings-page.helpers';

export interface AutoSaveDeps {
  readDraft: () => DraftSnapshot;
  readConfig: () => ResolvedConfig;
  applyConfig: (cfg: ResolvedConfig) => void;
  save: (update: UserConfigUpdate) => Promise<unknown>;
  onSaved: (draft: DraftSnapshot) => void;
  isBrowser: boolean;
}

/**
 * Owns the debounced auto-save state machine for the settings page: dirty
 * detection against the last persisted snapshot, the debounce + saved-indicator
 * timers, and coalescing of overlapping save round trips. The component drives
 * it from its hydration and draft-change effects and binds `saveStatus` in the
 * template; all timer and in-flight bookkeeping lives here.
 */
export class SettingsAutoSaveController {
  readonly saveStatus = signal<SaveStatus>('idle');

  /**
   * Last successfully persisted snapshot. Drafts are compared against this to
   * decide whether a save is needed. `null` until the first hydration, which is
   * why save is suppressed before the baseline exists.
   */
  private readonly lastPersisted = signal<DraftSnapshot | null>(null);
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightSave: Promise<void> | null = null;

  constructor(private readonly deps: AutoSaveDeps) {}

  /**
   * Hydrate drafts from server config, unless the user has dirty edits or a
   * save is mid-flight — otherwise the realtime listener clobbers input the
   * user is mid-typing. Dirty is measured against the OLD baseline, never the
   * incoming config (else every server update would look dirty).
   */
  hydrate(cfg: ResolvedConfig): void {
    const status = this.saveStatus();
    const baseline = this.lastPersisted();
    const dirty =
      baseline !== null && !snapshotsEqual(this.deps.readDraft(), baseline);
    if (
      baseline !== null &&
      (status === 'pending' || status === 'saving' || dirty)
    ) {
      return;
    }
    this.deps.applyConfig(cfg);
    this.lastPersisted.set(snapshotFromConfig(cfg));
    if (this.saveStatus() === 'pending') this.saveStatus.set('idle');
  }

  onDraftChange(
    draft: DraftSnapshot,
    displayNameViolation: DisplayNameViolation | null
  ): void {
    const baseline = this.lastPersisted();
    if (baseline === null) return;
    if (snapshotsEqual(draft, baseline)) {
      this.cancelTimer();
      if (this.saveStatus() === 'pending') this.saveStatus.set('idle');
      return;
    }
    // Block save only when the user actively edited displayName to an invalid
    // value. If displayName came from storage already invalid (legacy/migrated
    // data), editing OTHER fields should still succeed — Firestore's rule
    // rejects if the persisted name is actually invalid. Surface the inline
    // error and keep the pill "pending" so the missing round trip is obvious.
    const displayNameDirty = draft.displayName !== baseline.displayName;
    if (displayNameViolation !== null && displayNameDirty) {
      this.cancelTimer();
      this.saveStatus.set('pending');
      return;
    }
    this.schedule();
  }

  retry(): void {
    void this.flush();
  }

  destroy(): void {
    this.cancelTimer();
    if (this.savedTimer !== null) {
      clearTimeout(this.savedTimer);
      this.savedTimer = null;
    }
  }

  reportError(): void {
    this.saveStatus.set('error');
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
      if (baseline && snapshotsEqual(this.deps.readDraft(), baseline)) return;
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
      await this.deps.save(buildSaveUpdate(draft, this.deps.readConfig()));
      this.lastPersisted.set(draft);
      this.saveStatus.set('saved');
      this.deps.onSaved(draft);
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
