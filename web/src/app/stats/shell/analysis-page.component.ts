import { NgStyle } from '@angular/common';
import { Component, computed, inject, resource } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { StatsApiService } from '@nx-temp/stats-data-access';
import { PushupRecord } from '@nx-temp/stats-models';

interface TrendPoint {
  label: string;
  total: number;
}

interface HeatmapRow {
  hour: string;
  weekdays: number[];
}

@Component({
  selector: 'app-analysis-page',
  imports: [MatCardModule, MatTableModule, MatTooltipModule, NgStyle],
  template: `
    <main class="page-wrap">
      <section class="grid">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Wochentrend</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-table [dataSource]="weekTrend()">
              <ng-container matColumnDef="label">
                <mat-header-cell *matHeaderCellDef>Woche</mat-header-cell>
                <mat-cell *matCellDef="let row">{{ row.label }}</mat-cell>
              </ng-container>
              <ng-container matColumnDef="total">
                <mat-header-cell *matHeaderCellDef>Reps</mat-header-cell>
                <mat-cell *matCellDef="let row">{{ row.total }}</mat-cell>
              </ng-container>
              <mat-header-row *matHeaderRowDef="trendColumns"></mat-header-row>
              <mat-row *matRowDef="let row; columns: trendColumns"></mat-row>
            </mat-table>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Monatstrend</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-table [dataSource]="monthTrend()">
              <ng-container matColumnDef="label">
                <mat-header-cell *matHeaderCellDef>Monat</mat-header-cell>
                <mat-cell *matCellDef="let row">{{ row.label }}</mat-cell>
              </ng-container>
              <ng-container matColumnDef="total">
                <mat-header-cell *matHeaderCellDef>Reps</mat-header-cell>
                <mat-cell *matCellDef="let row">{{ row.total }}</mat-cell>
              </ng-container>
              <mat-header-row *matHeaderRowDef="trendColumns"></mat-header-row>
              <mat-row *matRowDef="let row; columns: trendColumns"></mat-row>
            </mat-table>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Bestwerte & Streaks</mat-card-title>
          </mat-card-header>
          <mat-card-content class="best-grid">
            <div><strong>Bestwert Einzel-Eintrag:</strong><div>{{ bestSingleEntry()?.reps ?? 0 }} Reps</div></div>
            <div><strong>Bester Tag:</strong><div>{{ bestDay()?.date ?? '—' }} · {{ bestDay()?.total ?? 0 }} Reps</div></div>
            <div><strong>Aktuelle Streak:</strong><div>{{ currentStreak() }} Tage</div></div>
            <div><strong>Längste Streak:</strong><div>{{ longestStreak() }} Tage</div></div>
          </mat-card-content>
        </mat-card>
      </section>

      <mat-card class="heatmap-full">
        <mat-card-header>
          <mat-card-title>Heatmap (Wochentag/Uhrzeit)</mat-card-title>
        </mat-card-header>
        <mat-card-content class="heatmap-wrap">
          <mat-table [dataSource]="heatmap()" class="heatmap-table">
            <ng-container matColumnDef="hour">
              <mat-header-cell *matHeaderCellDef>Std</mat-header-cell>
              <mat-cell *matCellDef="let row" class="weekday-cell">{{ row.hour }}</mat-cell>
            </ng-container>

            @for (day of weekdayColumns; track day; let dayIndex = $index) {
              <ng-container [matColumnDef]="day">
                <mat-header-cell *matHeaderCellDef>{{ day }}</mat-header-cell>
                <mat-cell *matCellDef="let row" class="heatmap-cell" [ngStyle]="heatCellStyle(row.weekdays[dayIndex])" [matTooltip]="row.weekdays[dayIndex] + ' Reps'">
                </mat-cell>
              </ng-container>
            }

            <mat-header-row *matHeaderRowDef="heatmapColumns"></mat-header-row>
            <mat-row *matRowDef="let row; columns: heatmapColumns"></mat-row>
          </mat-table>
        </mat-card-content>
        <div class="legend">
          <span>0</span>
          <div class="gradient-bar"></div>
          <span>{{ heatmapMax() }} (Max)</span>
        </div>
      </mat-card>
    </main>
  `,
  styles: `
    .page-wrap { max-width: 1200px; margin: 0 auto; padding: 16px; display: grid; gap: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    mat-table { width: 100%; }

    mat-card-content { overflow: auto; }

    .best-grid { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 12px; }

    .heatmap-full { width: 100%; }
    .heatmap-wrap { overflow: auto; width: 100%; }
    .heatmap-table { width: 100%; min-width: 620px; }
    .weekday-cell { font-weight: 600; min-width: 52px; }
    .heatmap-cell {
      justify-content: center;
      border-radius: 6px;
      margin: 1px;
      min-height: 30px;
      min-width: 40px;
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
      padding: 0 4px;
    }

    @media (max-width: 900px) {
      .page-wrap { padding: 12px; gap: 12px; }
      .grid { grid-template-columns: 1fr; gap: 12px; }
      .best-grid { grid-template-columns: 1fr 1fr; }
      .heatmap-table { min-width: 520px; }
      .heatmap-cell { min-width: 34px; min-height: 28px; font-size: 0.72rem; }
    }

    @media (max-width: 600px) {
      .best-grid { grid-template-columns: 1fr; }
      .heatmap-table { min-width: 460px; }
      .weekday-cell { min-width: 44px; font-size: 0.75rem; }
      .heatmap-cell { min-width: 30px; min-height: 24px; font-size: 0.66rem; }
    }

    .legend { display: flex; align-items: center; gap: 12px; padding: 12px 24px; font-size: 0.85rem; }
    .gradient-bar { flex: 1; max-width: 200px; height: 12px; border-radius: 4px; background: linear-gradient(to right, rgba(69, 137, 255, 0.12), rgba(69, 137, 255, 0.8)); }
  `,
})
export class AnalysisPageComponent {
  private readonly api = inject(StatsApiService);

  readonly trendColumns = ['label', 'total'];
  readonly weekdayColumns = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  readonly heatmapColumns = ['hour', ...this.weekdayColumns];

  readonly entriesResource = resource({ loader: async () => firstValueFrom(this.api.listPushups({})) });
  readonly rows = computed(() => this.entriesResource.value() ?? []);

  readonly weekTrend = computed(() => {
    const byWeek = new Map<string, number>();
    for (const row of this.rows()) {
      const date = new Date(row.timestamp);
      const year = this.isoWeekYear(date);
      const week = String(this.isoWeek(date)).padStart(2, '0');
      const key = `${year}-W${week}`;
      byWeek.set(key, (byWeek.get(key) ?? 0) + row.reps);
    }
    return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([label, total]) => ({ label, total }));
  });

  readonly monthTrend = computed<TrendPoint[]>(() => {
    const byMonth = new Map<string, number>();
    for (const row of this.rows()) {
      const date = new Date(row.timestamp);
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(label, (byMonth.get(label) ?? 0) + row.reps);
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, total]) => ({ label, total }));
  });

  readonly heatmap = computed<HeatmapRow[]>(() => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({
      hour: String(hour).padStart(2, '0'),
      weekdays: Array(7).fill(0),
    }));

    for (const row of this.rows()) {
      const date = new Date(row.timestamp);
      const weekday = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      rows[hour].weekdays[weekday] += row.reps;
    }
    return rows;
  });

  readonly heatmapMax = computed(() => Math.max(1, ...this.heatmap().flatMap((row) => row.weekdays)));

  readonly bestSingleEntry = computed<PushupRecord | null>(() => {
    if (!this.rows().length) return null;
    return [...this.rows()].sort((a, b) => b.reps - a.reps)[0] ?? null;
  });

  readonly bestDay = computed<{ date: string; total: number } | null>(() => {
    const byDay = new Map<string, number>();
    for (const row of this.rows()) {
      const key = row.timestamp.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + row.reps);
    }
    if (!byDay.size) return null;
    const [date, total] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    return { date, total };
  });

  readonly longestStreak = computed(() => {
    const dates = this.sortedUniqueDates();
    if (!dates.length) return 0;
    let best = 1;
    let current = 1;
    for (let i = 1; i < dates.length; i++) {
      if (this.daysBetween(dates[i - 1], dates[i]) === 1) current += 1;
      else current = 1;
      best = Math.max(best, current);
    }
    return best;
  });

  readonly currentStreak = computed(() => {
    const dates = this.sortedUniqueDates();
    if (!dates.length) return 0;
    let streak = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      if (this.daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
      else break;
    }
    return streak;
  });

  heatCellStyle(value: number): Record<string, string> {
    const intensity = Math.min(1, value / this.heatmapMax());
    const alpha = 0.12 + intensity * 0.68;
    return {
      'background-color': `rgba(69, 137, 255, ${alpha.toFixed(3)})`,
      color: intensity > 0.55 ? '#ffffff' : '#d7e6ff',
    };
  }

  private sortedUniqueDates(): string[] {
    return [...new Set(this.rows().map((x) => x.timestamp.slice(0, 10)))].sort((a, b) => a.localeCompare(b));
  }

  private daysBetween(a: string, b: string): number {
    const ad = new Date(`${a}T00:00:00`).getTime();
    const bd = new Date(`${b}T00:00:00`).getTime();
    return Math.round((bd - ad) / 86_400_000);
  }

  private isoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  }

  private isoWeekYear(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    return d.getUTCFullYear();
  }
}
