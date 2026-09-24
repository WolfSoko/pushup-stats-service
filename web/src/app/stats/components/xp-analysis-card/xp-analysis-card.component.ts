import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SkeletonComponent } from '@pu-stats/ui';

import { AnalysisXpStore } from '../../analysis-xp.store';
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
    DatePipe,
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

  protected readonly categoryName = categoryDisplayName;
  protected readonly exerciseName = exerciseDisplayName;

  protected readonly levelPercent = computed(() =>
    Math.round(this.store.progress().fraction * 100)
  );

  /** Tallest bucket, so bars scale to the range rather than to a fixed max. */
  private readonly maxBucket = computed(() =>
    Math.max(1, ...this.store.analysis().buckets.map((b) => b.xp))
  );

  protected barHeight(xp: number): number {
    return xp > 0 ? Math.max(4, Math.round((xp / this.maxBucket()) * 100)) : 0;
  }
}
