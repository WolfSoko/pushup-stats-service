import { DecimalPipe, formatDate, PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SkeletonComponent } from '@pu-stats/ui';

import { formatXp, levelPercent } from '../../../core/xp/xp-format';
import { AnalysisXpStore } from '../../analysis-xp.store';
import type { XpBucket } from '../../analysis/xp-analysis';
import {
  categoryDisplayName,
  exerciseDisplayName,
} from '../../i18n/exercise-display-names';

/**
 * XP section on the analysis overview: level, XP in the selected range
 * as a timeline, and where the XP came from (categories, top exercises).
 */
@Component({
  selector: 'app-xp-analysis-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    PercentPipe,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    SkeletonComponent,
  ],
  providers: [AnalysisXpStore],
  templateUrl: './xp-analysis-card.component.html',
  styleUrl: './xp-analysis-card.component.scss',
})
export class XpAnalysisCardComponent {
  protected readonly store = inject(AnalysisXpStore);
  private readonly locale = inject(LOCALE_ID);

  protected readonly categoryName = categoryDisplayName;
  protected readonly exerciseName = exerciseDisplayName;

  protected readonly levelPercent = computed(() =>
    levelPercent(this.store.progress())
  );

  /** Tallest bucket, so bars scale to the range rather than to a fixed max. */
  private readonly maxBucket = computed(() =>
    Math.max(1, ...this.store.analysis().buckets.map((b) => b.xp))
  );

  protected xpLabel(xp: number): string {
    return formatXp(xp, this.locale);
  }

  protected bucketTitle(bucket: XpBucket): string {
    const date = formatDate(bucket.key, 'mediumDate', this.locale);
    const xp = this.xpLabel(bucket.xp);
    return $localize`:@@analysis.xp.bucketTitle:${date}:date:: ${xp}:xp:`;
  }

  protected barHeight(xp: number): number {
    return xp > 0 ? Math.max(4, Math.round((xp / this.maxBucket()) * 100)) : 0;
  }
}
