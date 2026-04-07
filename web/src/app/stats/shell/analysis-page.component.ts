import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  effect,
  inject,
  PLATFORM_ID,
  REQUEST,
  signal,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { createWeekRange } from '@pu-stats/models';
import { LiveDataStore } from '@pu-stats/data-access';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { AnalysisStore } from '../analysis.store';

@Component({
  selector: 'app-analysis-page',
  providers: [AnalysisStore],
  imports: [
    MatButtonToggleModule,
    MatCardModule,
    MatTableModule,
    FilterBarComponent,
    HeatmapComponent,
    PreviewBannerComponent,
    SetsDistributionComponent,
    StatsChartComponent,
    TypePieComponent,
  ],
  template: `
    <main class="page-wrap">
      <app-preview-banner />

      <section class="filter-section">
        <app-filter-bar
          [from]="store.from()"
          [to]="store.to()"
          (fromChange)="store.setFrom($event)"
          (toChange)="store.setTo($event)"
        />
      </section>

      <app-stats-chart
        [series]="store.chartSeries()"
        [granularity]="store.granularity()"
        [rangeMode]="store.rangeMode()"
        [from]="store.from()"
        [to]="store.to()"
        [entries]="store.rows()"
        [dayChartMode]="store.dayChartMode()"
        (dayChartModeChange)="store.setDayChartMode($event)"
      />

      <section class="grid">
        <mat-card>
          <mat-card-header>
            <mat-card-title i18n="@@analysis.weekTrendTitle"
              >Wochentrend</mat-card-title
            >
            <mat-card-subtitle>{{
              store.weekTrendSubtitle()
            }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-table [dataSource]="store.weekTrend()">
              <ng-container matColumnDef="label">
                <mat-header-cell *matHeaderCellDef i18n="@@analysis.weekCol"
                  >Woche</mat-header-cell
                >
                <mat-cell *matCellDef="let row">{{ row.label }}</mat-cell>
              </ng-container>
              <ng-container matColumnDef="total">
                <mat-header-cell *matHeaderCellDef i18n="@@analysis.repsCol"
                  >Reps</mat-header-cell
                >
                <mat-cell *matCellDef="let row">{{ row.total }}</mat-cell>
              </ng-container>
              <ng-container matColumnDef="avgSetsPerEntry">
                <mat-header-cell *matHeaderCellDef i18n="@@analysis.avgSetsCol"
                  >&#x2300; Sets</mat-header-cell
                >
                <mat-cell *matCellDef="let row">{{
                  row.avgSetsPerEntry ?? '—'
                }}</mat-cell>
              </ng-container>
              <mat-header-row
                *matHeaderRowDef="trendColumnsWithSets"
              ></mat-header-row>
              <mat-row
                *matRowDef="let row; columns: trendColumnsWithSets"
              ></mat-row>
            </mat-table>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title i18n="@@analysis.monthTrendTitle"
              >Monatstrend</mat-card-title
            >
            <mat-card-subtitle>{{
              store.monthTrendSubtitle()
            }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-table [dataSource]="store.monthTrend()">
              <ng-container matColumnDef="label">
                <mat-header-cell *matHeaderCellDef i18n="@@analysis.monthCol"
                  >Monat</mat-header-cell
                >
                <mat-cell *matCellDef="let row">{{ row.label }}</mat-cell>
              </ng-container>
              <ng-container matColumnDef="total">
                <mat-header-cell *matHeaderCellDef i18n="@@analysis.repsCol"
                  >Reps</mat-header-cell
                >
                <mat-cell *matCellDef="let row">{{ row.total }}</mat-cell>
              </ng-container>
              <ng-container matColumnDef="avgSetsPerEntry">
                <mat-header-cell *matHeaderCellDef i18n="@@analysis.avgSetsCol"
                  >&#x2300; Sets</mat-header-cell
                >
                <mat-cell *matCellDef="let row">{{
                  row.avgSetsPerEntry ?? '—'
                }}</mat-cell>
              </ng-container>
              <mat-header-row
                *matHeaderRowDef="trendColumnsWithSets"
              ></mat-header-row>
              <mat-row
                *matRowDef="let row; columns: trendColumnsWithSets"
              ></mat-row>
            </mat-table>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title i18n="@@analysis.bestStreaksTitle"
              >Bestwerte & Streaks</mat-card-title
            >
          </mat-card-header>
          <mat-card-content class="best-grid">
            <div>
              <strong i18n="@@analysis.bestSingleEntry"
                >Bestwert Einzel-Eintrag:</strong
              >
              <div>{{ store.bestSingleEntry()?.reps ?? 0 }} Reps</div>
            </div>
            <div>
              <strong i18n="@@analysis.bestDay">Bester Tag:</strong>
              <div>
                {{ store.bestDay()?.date ?? '—' }} ·
                {{ store.bestDay()?.total ?? 0 }} Reps
              </div>
            </div>
            @if (store.bestSingleSet()) {
              <div>
                <strong i18n="@@analysis.bestSingleSet"
                  >Bestes Einzel-Set:</strong
                >
                <div>{{ store.bestSingleSet() }} Reps</div>
              </div>
            }
            <div>
              <strong i18n="@@analysis.currentStreak">Aktuelle Streak:</strong>
              <div>
                <ng-container i18n="@@analysis.streakDays"
                  >{{ store.currentStreak() }} Tage</ng-container
                >
              </div>
            </div>
            <div>
              <strong i18n="@@analysis.longestStreak">Längste Streak:</strong>
              <div>
                <ng-container i18n="@@analysis.streakDays"
                  >{{ store.longestStreak() }} Tage</ng-container
                >
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title i18n="@@analysis.typesTitle"
              >Typen (Anteile)</mat-card-title
            >
          </mat-card-header>
          <mat-card-content>
            <app-type-pie [data]="store.typeBreakdown()" />
          </mat-card-content>
        </mat-card>

        @if (store.avgSetSize()) {
          <mat-card>
            <mat-card-header>
              <mat-card-title i18n="@@analysis.avgSetSizeTitle"
                >&#x2300; Set-Gr&#x00F6;&#x00DF;e</mat-card-title
              >
            </mat-card-header>
            <mat-card-content class="kpi-big">
              <b>{{ store.avgSetSize() }}</b>
              <span i18n="@@analysis.repsPerSet">Reps / Set</span>
            </mat-card-content>
          </mat-card>
        }

        @if (store.setsDistribution().length) {
          <mat-card>
            <mat-card-header>
              <mat-card-title i18n="@@analysis.setsDistTitle"
                >Sets-Verteilung</mat-card-title
              >
            </mat-card-header>
            <mat-card-content>
              <app-sets-distribution [data]="store.setsDistribution()" />
            </mat-card-content>
          </mat-card>
        }
      </section>

      <mat-card class="heatmap-full">
        <mat-card-header>
          <mat-card-title i18n="@@analysis.heatmapTitle"
            >Heatmap (Wochentag/Uhrzeit)</mat-card-title
          >
          <mat-button-toggle-group
            [value]="heatmapMode()"
            (change)="heatmapMode.set($event.value)"
            class="heatmap-toggle"
            aria-label="Heatmap-Modus auswählen"
            i18n-aria-label="@@analysis.heatmapToggleAriaLabel"
          >
            <mat-button-toggle value="reps" i18n="@@analysis.heatmapReps"
              >Reps</mat-button-toggle
            >
            <mat-button-toggle value="sets" i18n="@@analysis.heatmapSets"
              >Sets</mat-button-toggle
            >
          </mat-button-toggle-group>
        </mat-card-header>
        <mat-card-content class="heatmap-wrap">
          <app-heatmap [entries]="store.rows()" [mode]="heatmapMode()" />
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }
    mat-table {
      width: 100%;
    }

    mat-card-content {
      overflow: auto;
    }

    .best-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(180px, 1fr));
      gap: 12px;
    }

    .filter-section {
      margin-bottom: 16px;
    }

    .chart-card {
      margin-bottom: 16px;
    }

    .heatmap-full {
      width: 100%;
    }
    .heatmap-wrap {
      overflow: auto;
      width: 100%;
      min-height: 400px;
    }

    @media (max-width: 900px) {
      .page-wrap {
        padding: 12px;
        gap: 12px;
      }
      .grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .best-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    .kpi-big {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 16px 0;
    }
    .kpi-big b {
      font-size: 2.5rem;
      line-height: 1;
    }
    .kpi-big span {
      opacity: 0.7;
      font-size: 0.85rem;
    }

    .heatmap-toggle {
      margin-left: auto;
    }

    @media (max-width: 600px) {
      .best-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AnalysisPageComponent {
  readonly store = inject(AnalysisStore);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true }) as {
    url?: string;
  } | null;

  readonly trendColumns = ['label', 'total'];
  readonly trendColumnsWithSets = ['label', 'total', 'avgSetsPerEntry'];

  readonly heatmapMode = signal<'reps' | 'sets'>('reps');

  private readonly live = inject(LiveDataStore);

  constructor() {
    // Resolve initial range from URL query params (SSR-aware)
    const initialRange = this.resolveInitialRange();
    this.store.setRange(initialRange.from, initialRange.to);

    // Reload stats when live data changes (new entries via websocket)
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const tick = this.live.updateTick();
      if (!tick) return;
      this.store.refreshAll();
    });

    // URL history tracking effect (UI side effect, stays in component)
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const params = new URLSearchParams();
      const from = this.store.from();
      const to = this.store.to();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const query = params.toString();
      const nextUrl = `${this.document.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    });
  }

  private resolveInitialRange(): { from: string; to: string } {
    const defaultRange = createWeekRange();
    const search = this.resolveSearchString();
    const params = new URLSearchParams(search);
    const from = params.get('from') ?? defaultRange.from;
    const to = params.get('to') ?? defaultRange.to;
    return { from, to };
  }

  private resolveSearchString(): string {
    if (isPlatformBrowser(this.platformId)) {
      return this.document.location.search || '';
    }

    const url = this.request?.url || '';
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return '';
    return url.slice(qIndex);
  }
}
