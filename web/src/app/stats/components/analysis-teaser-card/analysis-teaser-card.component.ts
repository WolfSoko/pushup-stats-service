import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  exerciseEntryToUnified,
  StatsSeriesEntry,
  UnifiedEntry,
} from '@pu-stats/models';
import { toLocalIsoDate } from '@pu-stats/date';
import { StatsChartComponent } from '../stats-chart/stats-chart.component';
import {
  buildTeaserAllSeries,
  buildTeaserExerciseTabs,
  TeaserTabVm,
} from './analysis-teaser-tabs';

@Component({
  selector: 'app-analysis-teaser-card',
  imports: [MatCardModule, MatIconModule, MatTabsModule, StatsChartComponent],
  templateUrl: './analysis-teaser-card.component.html',
  styleUrl: './analysis-teaser-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisTeaserCardComponent {
  private readonly live = inject(LiveDataStore);
  private readonly router = inject(Router);

  readonly streak = input(0);
  readonly weekReps = input(0);
  readonly weeklyGoal = input(0);
  /** Increment to trigger a data reload (e.g. after entry creation). */
  readonly refreshTrigger = input(0);

  private readonly allExercisesLabel = $localize`:@@chart.kindLabel.all:Alle Übungen`;
  /**
   * Pushup label reused from the analysis page i18n catalog so we
   * don't spawn a parallel XLIFF unit. Used to label legacy-pushup
   * data surfaced on the teaser chart.
   */
  private readonly pushupLabel = $localize`:@@exercise.category.pushup:Liegestütze`;

  /**
   * Rolling 7-day window ending today (inclusive). The earlier
   * Monday-to-Sunday ISO-week range collapses to a single visible day
   * whenever today *is* Monday, which made the teaser chart look broken
   * — users only saw today's bar with six empty future days. A trailing
   * window always shows seven days of history regardless of weekday.
   */
  private readonly weekRange = computed(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { from: toLocalIsoDate(start), to: toLocalIsoDate(today) };
  });

  readonly from = computed(() => this.weekRange().from);
  readonly to = computed(() => this.weekRange().to);

  /**
   * Post-cutover the live feed carries pushups too (`exerciseId:'pushup'`),
   * so one range-filtered pass over `exerciseEntries()` feeds both the
   * aggregate series and the per-exercise tabs.
   */
  private readonly weekRows = computed<UnifiedEntry[]>(() => {
    if (!this.live.connected()) return [];
    const { from, to } = this.weekRange();
    return this.live
      .exerciseEntries()
      .filter((entry) => {
        const day = entry.timestamp.slice(0, 10);
        return day >= from && day <= to;
      })
      .map(exerciseEntryToUnified);
  });

  /**
   * Honest heading label that tracks the *actual* data the chart is
   * showing — not a fixed string. Without this, the cold-start / SSR
   * fallback labels REST-only pushup data as "Alle Übungen" and a
   * live-but-pushup-only week still claims to aggregate every exercise.
   *
   * Note: the chart axis is reps, so duration-only entries (plank …)
   * legitimately don't contribute bars. We therefore avoid promising
   * "Alle Übungen" when no other rep-bearing kind is present.
   */
  readonly chartKindLabel = computed(() => {
    if (!this.live.connected()) {
      return this.pushupLabel;
    }
    const rows = this.weekRows();
    const hasPushupReps = rows.some(
      (e) => e.exerciseId === 'pushup' && (e.reps ?? 0) > 0
    );
    const hasOtherReps = rows.some(
      (e) => e.exerciseId !== 'pushup' && (e.reps ?? 0) > 0
    );

    if (hasOtherReps) return this.allExercisesLabel;
    if (hasPushupReps) return this.pushupLabel;
    return '';
  });

  readonly chartSeries = computed<StatsSeriesEntry[]>(() =>
    buildTeaserAllSeries(this.weekRows())
  );

  private readonly exerciseTabs = computed(() =>
    buildTeaserExerciseTabs(this.weekRows())
  );

  /**
   * One tab per exercise done in the 7-day window. With several
   * exercises the reps aggregate keeps its place as a leading "Alle
   * Übungen" tab; a single exercise needs no aggregate duplicate.
   */
  readonly tabs = computed<TeaserTabVm[]>(() => {
    const exerciseTabs = this.exerciseTabs();
    if (exerciseTabs.length < 2) return exerciseTabs;
    return [
      {
        id: 'all',
        label: this.allExercisesLabel,
        measurement: null,
        series: this.chartSeries(),
        paceSeries: [],
      },
      ...exerciseTabs,
    ];
  });

  stopCardActivation(event: Event): void {
    event.stopPropagation();
  }

  navigateToAnalysis(): void {
    this.router.navigate(['/analysis']);
  }
}
