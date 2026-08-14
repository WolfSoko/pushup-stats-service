import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BuildInfoService } from './build-info.service';

/**
 * Shows which release the deployment currently being served was built from.
 * Answers "is my change live yet?" without a trip to GitHub Actions.
 */
@Component({
  selector: 'app-release-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <!-- Focusable so the commit/build time in the tooltip is reachable
         without a pointer; the badge itself has no action. -->
    <span class="release-badge" tabindex="0" [matTooltip]="tooltip()">
      <mat-icon aria-hidden="true">rocket_launch</mat-icon>
      <span class="release-badge-label" i18n="@@admin.release.label"
        >Release</span
      >
      <code class="release-badge-version">{{ version() }}</code>
    </span>
  `,
  styles: `
    .release-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: 1px solid rgba(123, 159, 255, 0.35);
      border-radius: 999px;
      background: rgba(13, 18, 32, 0.5);
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.8rem;
      line-height: 1.4;
      white-space: nowrap;
      cursor: default;
    }

    .release-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .release-badge-version {
      font-family: monospace;
      color: var(--mat-sys-on-surface);
    }

    @media (max-width: 680px) {
      .release-badge-label {
        display: none;
      }
    }
  `,
})
export class ReleaseBadgeComponent {
  private readonly buildInfoService = inject(BuildInfoService);
  private readonly locale = inject(LOCALE_ID);

  readonly version = computed(() =>
    this.buildInfoService.isKnown()
      ? this.buildInfoService.buildInfo().version
      : $localize`:@@admin.release.unknown:unbekannt`
  );

  readonly tooltip = computed(() => {
    if (!this.buildInfoService.isKnown()) {
      return $localize`:@@admin.release.unknownTooltip:Diese Auslieferung enthält keine Build-Informationen (lokaler Build oder Dev-Server).`;
    }
    const { release, builtAt } = this.buildInfoService.buildInfo();
    if (!builtAt) {
      return $localize`:@@admin.release.commitTooltip:Commit ${release}:release:`;
    }
    const built = formatDate(builtAt, 'short', this.locale);
    return $localize`:@@admin.release.builtTooltip:Commit ${release}:release: · gebaut am ${built}:built:`;
  });
}
