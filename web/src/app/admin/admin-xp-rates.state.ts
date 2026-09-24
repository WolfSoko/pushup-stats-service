import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserContextService } from '@pu-auth/auth';
import { XpApiService } from '@pu-stats/data-access';
import { DEFAULT_XP_RATES, type XpConfig } from '@pu-stats/models';
import { createBusyState } from '@pu-stats/ui';
import { errorMessage } from './admin-page.helpers';
import {
  effectiveRates,
  overridesFrom,
  parseXpRateInput,
  sameRates,
} from './admin-xp-rates.helpers';

/**
 * Stored rates plus the admin's unsaved edits. Provided per section, so
 * leaving the admin page drops drafts instead of carrying them around.
 */
@Injectable()
export class AdminXpRatesState {
  private readonly api = inject(XpApiService);
  private readonly user = inject(UserContextService);

  /** `undefined` until the first snapshot — drives the skeleton. */
  private readonly config = toSignal<XpConfig | null | undefined>(
    this.api.watchConfig(),
    { initialValue: undefined }
  );

  readonly loaded = computed(() => this.config() !== undefined);
  readonly stored = computed(() => effectiveRates(this.config() ?? null));

  private readonly edits = signal<Readonly<Record<string, number>>>({});
  readonly invalid = signal<ReadonlySet<string>>(new Set());

  readonly rates = computed(() => ({ ...this.stored(), ...this.edits() }));
  readonly dirty = computed(() => !sameRates(this.rates(), this.stored()));

  readonly saving = createBusyState();
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

  rateOf(id: string): number {
    return this.rates()[id] ?? 0;
  }

  isDefault(id: string): boolean {
    return this.rateOf(id) === DEFAULT_XP_RATES[id];
  }

  setRate(id: string, raw: string): void {
    const value = parseXpRateInput(raw);
    this.saved.set(false);
    this.invalid.update((set) => {
      const next = new Set(set);
      if (value === null) next.add(id);
      else next.delete(id);
      return next;
    });
    if (value === null) return;
    this.edits.update((edits) => ({ ...edits, [id]: value }));
  }

  resetToDefault(id: string): void {
    this.setRate(id, String(DEFAULT_XP_RATES[id] ?? 0));
  }

  discard(): void {
    this.edits.set({});
    this.invalid.set(new Set());
    this.error.set(null);
  }

  async save(): Promise<void> {
    if (this.invalid().size > 0) return;
    this.error.set(null);
    try {
      await this.saving.run(() =>
        this.api.saveConfig(overridesFrom(this.rates()), this.user.userIdSafe())
      );
      this.edits.set({});
      this.saved.set(true);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }
}
