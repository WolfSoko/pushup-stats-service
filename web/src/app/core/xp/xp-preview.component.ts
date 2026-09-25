import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { XpStore } from '@pu-stats/data-access-state';
import { xpPreviewLabel, xpRateLabelFor } from './xp-rate-label';

/**
 * Live "≈ N XP" hint under the value fields of the entry dialog, so the
 * user sees what the entry is worth before saving it. Hidden until the
 * entered values are worth anything.
 */
@Component({
  selector: 'app-xp-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (xp() > 0) {
      <p class="xp-preview" data-testid="xp-preview">
        <mat-icon aria-hidden="true">bolt</mat-icon>
        <span i18n="@@xp.preview.entryWorth"
          >Diese Einheit bringt <strong>{{ previewLabel() }}</strong></span
        >
        @if (rateLabel(); as rate) {
          <span class="xp-preview-rate">({{ rate }})</span>
        }
      </p>
    }
  `,
  styles: `
    .xp-preview {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin: 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .xp-preview mat-icon {
      color: var(--mat-sys-tertiary);
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }
    .xp-preview strong {
      color: var(--mat-sys-on-surface);
    }
    .xp-preview-rate {
      font: var(--mat-sys-body-small);
    }
  `,
})
export class XpPreviewComponent {
  private readonly store = inject(XpStore);
  private readonly locale = inject(LOCALE_ID) as string;

  readonly exerciseId = input.required<string>();
  readonly reps = input<number | null | undefined>(undefined);
  readonly durationSec = input<number | null | undefined>(undefined);
  readonly distanceM = input<number | null | undefined>(undefined);

  readonly xp = computed(() =>
    this.store.previewXp({
      exerciseId: this.exerciseId(),
      reps: this.reps(),
      durationSec: this.durationSec(),
      distanceM: this.distanceM(),
    })
  );

  readonly previewLabel = computed(() =>
    xpPreviewLabel(this.xp(), this.locale)
  );

  readonly rateLabel = computed(() =>
    xpRateLabelFor(this.exerciseId(), this.store.config(), this.locale)
  );
}
