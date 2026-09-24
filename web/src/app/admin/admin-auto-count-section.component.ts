import { DatePipe, PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  formatSignedDelta,
  formatThresholds,
  reportDelta,
} from './admin-auto-count.helpers';
import { errorMessage } from './admin-page.helpers';
import type {
  AdminAutoCountFeedback,
  AdminAutoCountReport,
  AdminAutoCountSummary,
} from './admin-page.models';
import { BusyDirective, SkeletonTableComponent } from '@pu-stats/ui';
import { CallableFunctionsService } from './callable-functions.service';

/**
 * How the camera rep counter is doing in the field, grouped by the
 * threshold set each run used. Read-only: the reports come from the
 * `adminListAutoCountFeedback` callable, because the collection itself
 * is create-only for clients.
 */
@Component({
  selector: 'app-admin-auto-count-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonTableComponent,
    BusyDirective,
    DatePipe,
    PercentPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-auto-count-section.component.html',
  styleUrl: './admin-auto-count-section.component.scss',
})
export class AdminAutoCountSectionComponent {
  private readonly callables = inject(CallableFunctionsService);

  readonly refreshTooltip = $localize`:@@admin.refresh:Neu laden`;

  readonly summaryColumns = [
    'profileId',
    'thresholds',
    'runs',
    'exactRate',
    'meanAbsDelta',
    'meanDelta',
  ];
  readonly reportColumns = [
    'createdAt',
    'exerciseId',
    'detectedReps',
    'actualReps',
    'delta',
  ];

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<AdminAutoCountFeedback | null>(null);

  readonly summaries = computed<AdminAutoCountSummary[]>(
    () => this.data()?.summaries ?? []
  );
  readonly recent = computed<AdminAutoCountReport[]>(
    () => this.data()?.recent ?? []
  );
  readonly totalReports = computed(() => this.data()?.totalReports ?? 0);

  /**
   * A rate over a handful of runs says nothing; the table flags those so
   * a lucky 100 % is not mistaken for a tuned profile.
   */
  readonly thinEvidenceThreshold = 10;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const fn = this.callables.call<void, AdminAutoCountFeedback>(
        'adminListAutoCountFeedback'
      );
      const result = await fn();
      this.data.set(result.data);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected thresholds(thresholds: Record<string, number>): string {
    return formatThresholds(thresholds);
  }

  protected signed(value: number): string {
    return formatSignedDelta(value);
  }

  protected delta(report: AdminAutoCountReport): string {
    return formatSignedDelta(reportDelta(report));
  }

  protected isThinEvidence(summary: AdminAutoCountSummary): boolean {
    return summary.runs < this.thinEvidenceThreshold;
  }
}
