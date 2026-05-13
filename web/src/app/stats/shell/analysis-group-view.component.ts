import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { type UnifiedEntryFilterKey } from '@pu-stats/models';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { AnalysisStore } from '../analysis.store';
import { kindDisplayName } from '../i18n/exercise-display-names';

/**
 * The store's `activeView` / view-scoped computeds drive the data,
 * so this component carries no inputs — dropping it inside any tab
 * content gives the right slice without prop-drilling.
 */
@Component({
  selector: 'app-analysis-group-view',
  imports: [
    DecimalPipe,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    HeatmapComponent,
    SetsDistributionComponent,
    StatsChartComponent,
    TypePieComponent,
  ],
  template: `
    <app-stats-chart
      [series]="store.viewChartSeries()"
      [granularity]="store.viewGranularity()"
      [rangeMode]="store.rangeMode()"
      [from]="store.from()"
      [to]="store.to()"
      [entries]="store.viewChartEntries()"
      [measurement]="store.viewMeasurement()"
      [paceSeries]="store.viewPaceSeries()"
      [dayChartMode]="store.resolvedDayChartMode()"
      (dayChartModeChange)="store.setDayChartMode($event)"
    />

    <section class="grid">
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
              <div>
                {{ store.bestSingleSet() }}
                <span i18n="@@analysis.repsUnit">Wdh.</span>
              </div>
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
          @defer (hydrate on viewport) {
            <app-type-pie [data]="typeBreakdownDisplay()" />
          }
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
            @defer (hydrate on viewport) {
              <app-sets-distribution [data]="store.setsDistribution()" />
            }
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
        @defer (hydrate on viewport) {
          <app-heatmap
            [entries]="store.viewFilteredRows()"
            [mode]="heatmapMode()"
          />
        }
      </mat-card-content>
    </mat-card>

    <section class="trends-section" data-testid="analysis-trends-section">
      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@analysis.weekTrendTitle"
            >Wochentrend</mat-card-title
          >
          <mat-card-subtitle i18n="@@analysis.weekTrendSubtitle"
            >Letzte 8 Wochen</mat-card-subtitle
          >
        </mat-card-header>
        <mat-card-content>
          @defer (on viewport) {
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
                  row.avgSetsPerEntry !== null &&
                  row.avgSetsPerEntry !== undefined
                    ? (row.avgSetsPerEntry | number)
                    : '—'
                }}</mat-cell>
              </ng-container>
              <mat-header-row
                *matHeaderRowDef="trendColumnsWithSets"
              ></mat-header-row>
              <mat-row
                *matRowDef="let row; columns: trendColumnsWithSets"
              ></mat-row>
            </mat-table>
          } @placeholder {
            <div class="trend-placeholder" aria-hidden="true"></div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@analysis.monthTrendTitle"
            >Monatstrend</mat-card-title
          >
          <mat-card-subtitle i18n="@@analysis.monthTrendSubtitle"
            >Letzte 6 Monate</mat-card-subtitle
          >
        </mat-card-header>
        <mat-card-content>
          @defer (on viewport) {
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
                  row.avgSetsPerEntry !== null &&
                  row.avgSetsPerEntry !== undefined
                    ? (row.avgSetsPerEntry | number)
                    : '—'
                }}</mat-cell>
              </ng-container>
              <mat-header-row
                *matHeaderRowDef="trendColumnsWithSets"
              ></mat-header-row>
              <mat-row
                *matRowDef="let row; columns: trendColumnsWithSets"
              ></mat-row>
            </mat-table>
          } @placeholder {
            <div class="trend-placeholder" aria-hidden="true"></div>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: `
    :host {
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
    .heatmap-full {
      width: 100%;
    }
    .heatmap-wrap {
      overflow: auto;
      width: 100%;
      min-height: 400px;
    }
    /* Reserve roughly the rendered table height so revealing the
       deferred trend block doesn't shift the rest of the page down. */
    .trend-placeholder {
      min-height: 320px;
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
    @media (max-width: 900px) {
      :host {
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
    @media (max-width: 600px) {
      .best-grid {
        grid-template-columns: 1fr;
      }
      .heatmap-full mat-card-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .heatmap-toggle {
        margin-left: 0;
      }
    }
  `,
})
export class AnalysisGroupViewComponent {
  readonly store = inject(AnalysisStore);
  readonly trendColumnsWithSets = ['label', 'total', 'avgSetsPerEntry'];
  readonly heatmapMode = signal<'reps' | 'sets'>('reps');

  /**
   * Resolves the bare-id labels emitted by `store.typeBreakdown()` (in
   * kind mode) into localised display names. Pushup-variant mode
   * passes through because the store already produces locale-aware
   * variant names. The gate mirrors `analysis.store` — a per-category
   * tab other than `pushup` (Liegestütze) is always kind mode, so the
   * breakdown carries exerciseIds like `abs.situps` that need
   * translating even without an explicit kinds filter.
   */
  readonly typeBreakdownDisplay = computed(() => {
    const view = this.store.activeView();
    const kinds = this.store.kinds();
    const showPushupVariants =
      view === 'pushup' ||
      (view === 'overview' &&
        (kinds.length === 0 || (kinds.length === 1 && kinds[0] === 'pushup')));
    const data = this.store.typeBreakdown();
    if (showPushupVariants) return data;
    return data.map((d) => ({
      ...d,
      label: kindDisplayName(d.id as UnifiedEntryFilterKey),
    }));
  });
}
