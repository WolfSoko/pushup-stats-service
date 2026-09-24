import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { XP_RATE_MAX, type XpRateUnitKey } from '@pu-stats/models';
import { BusyDirective, SkeletonTableComponent } from '@pu-stats/ui';
import { formatXpRate, xpRateUnitLabel } from '../core/xp/xp-rate-label';
import { buildXpRateGroups } from './admin-xp-rates.helpers';
import { AdminXpRatesState } from './admin-xp-rates.state';

/**
 * Admin editor for the XP each exercise is worth per rep / minute / km.
 * Saved rates only apply to entries booked afterwards — earned XP is
 * frozen in the ledger.
 */
@Component({
  selector: 'app-admin-xp-rates-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusyDirective,
    SkeletonTableComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  providers: [AdminXpRatesState],
  templateUrl: './admin-xp-rates-section.component.html',
  styleUrl: './admin-xp-rates-section.component.scss',
})
export class AdminXpRatesSectionComponent {
  private readonly locale = inject(LOCALE_ID) as string;
  readonly state = inject(AdminXpRatesState);

  readonly groups = buildXpRateGroups();
  readonly rateMax = XP_RATE_MAX;
  readonly resetTooltip = $localize`:@@admin.xpRates.reset:Auf Standard zurücksetzen`;

  unitLabel(unit: XpRateUnitKey): string {
    return xpRateUnitLabel(unit);
  }

  formatRate(rate: number): string {
    return formatXpRate(rate, this.locale);
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
