import { computed, inject, Injectable, signal } from '@angular/core';
import {
  type AngleProfileOverride,
  type HoldProfileOverride,
  type ProfileOverrideSource,
} from '@pu-stats/auto-count';
import { UserContextService } from '@pu-auth/auth';

import {
  asAngleOverride,
  asHoldOverride,
  sanitizeTuningValues,
  type TuningKind,
  type TuningProfileDoc,
} from './auto-count-tuning.models';
import { AutoCountTuningService } from './auto-count-tuning.service';

const emptyValues = (): Readonly<Record<string, number>> => ({});

/**
 * Holds the tuned detector profiles and answers the detector's
 * {@link ProfileOverrideSource} port from them.
 *
 * Two layers: what is stored in Firestore, and the unsaved edits the
 * admin is currently dragging sliders through. The draft wins while it
 * exists, so a slider takes effect on the very next detector restart
 * without a round trip — that immediacy is the whole point of tuning
 * against a live camera.
 */
@Injectable({ providedIn: 'root' })
export class AutoCountTuningStore implements ProfileOverrideSource {
  private readonly api = inject(AutoCountTuningService);
  private readonly user = inject(UserContextService);

  private readonly stored = signal<ReadonlyMap<string, TuningProfileDoc>>(
    new Map()
  );
  private readonly drafts = signal<
    ReadonlyMap<string, Readonly<Record<string, number>>>
  >(new Map());
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAdmin = computed(() => this.user.isAdmin());

  private loadPromise: Promise<void> | null = null;

  /** Loads once per session; concurrent callers share the same request. */
  ensureLoaded(): Promise<void> {
    this.loadPromise ??= this.load();
    return this.loadPromise;
  }

  /** Effective values for the panel: stored profile with draft edits on top. */
  valuesFor(exerciseId: string): Readonly<Record<string, number>> {
    const draft = this.drafts().get(exerciseId);
    if (draft) return draft;
    return this.stored().get(exerciseId)?.values ?? emptyValues();
  }

  publishedFor(exerciseId: string): boolean {
    return this.stored().get(exerciseId)?.published === true;
  }

  hasDraft(exerciseId: string): boolean {
    return this.drafts().has(exerciseId);
  }

  isTuned(exerciseId: string): boolean {
    return Object.keys(this.valuesFor(exerciseId)).length > 0;
  }

  setValue(
    exerciseId: string,
    kind: TuningKind,
    key: string,
    value: number
  ): void {
    const next = sanitizeTuningValues(kind, {
      ...this.valuesFor(exerciseId),
      [key]: value,
    });
    this.putDraft(exerciseId, next);
  }

  clearValue(exerciseId: string, kind: TuningKind, key: string): void {
    const next = { ...this.valuesFor(exerciseId) };
    delete next[key];
    this.putDraft(exerciseId, sanitizeTuningValues(kind, next));
  }

  /** Drops every override for the exercise, back to the catalog defaults. */
  resetToDefaults(exerciseId: string): void {
    this.putDraft(exerciseId, emptyValues());
  }

  /** Forgets unsaved edits and falls back to what is stored. */
  discardDraft(exerciseId: string): void {
    const next = new Map(this.drafts());
    next.delete(exerciseId);
    this.drafts.set(next);
  }

  async save(
    exerciseId: string,
    kind: TuningKind,
    published: boolean
  ): Promise<void> {
    const profile: TuningProfileDoc = {
      exerciseId,
      kind,
      values: this.valuesFor(exerciseId),
      published,
    };
    this._error.set(null);
    try {
      await this.api.save(profile, this.user.userIdSafe());
      const stored = new Map(this.stored());
      stored.set(exerciseId, profile);
      this.stored.set(stored);
      this.discardDraft(exerciseId);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  angleOverrideFor(exerciseId: string): AngleProfileOverride | null {
    const values = this.applicableValues(exerciseId);
    return values ? asAngleOverride(values) : null;
  }

  holdOverrideFor(exerciseId: string): HoldProfileOverride | null {
    const values = this.applicableValues(exerciseId);
    return values ? asHoldOverride(values) : null;
  }

  /**
   * An unpublished profile only steers the admin's own detector; for
   * everyone else it stays invisible until it is published.
   */
  private applicableValues(
    exerciseId: string
  ): Readonly<Record<string, number>> | null {
    const applies = this.isAdmin() || this.publishedFor(exerciseId);
    if (!applies) return null;
    const values = this.valuesFor(exerciseId);
    return Object.keys(values).length > 0 ? values : null;
  }

  private putDraft(
    exerciseId: string,
    values: Readonly<Record<string, number>>
  ): void {
    const next = new Map(this.drafts());
    next.set(exerciseId, values);
    this.drafts.set(next);
  }

  private async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const profiles = await this.api.load();
      this.stored.set(new Map(profiles.map((p) => [p.exerciseId, p])));
    } catch (err) {
      // A failed load is not fatal: the detector falls back to the
      // catalog defaults, which is exactly what shipped before tuning.
      this._error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this._loading.set(false);
    }
  }
}
