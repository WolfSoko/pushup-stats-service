import { Component, computed, inject, resource } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { StatsApiService } from '@pu-stats/data-access';
import { PushupRecord } from '@pu-stats/models';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';

interface TrendPoint {
  label: string;
  total: number;
}

@Component({
  selector: 'app-analysis-page',
  imports: [MatCardModule, MatTableModule, HeatmapComponent],
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
            <div>
              <strong>Bestwert Einzel-Eintrag:</strong>
              <div>{{ bestSingleEntry()?.reps ?? 0 }} Reps</div>
            </div>
            <div>
              <strong>Bester Tag:</strong>
              <div>
                {{ bestDay()?.date ?? '—' }} · {{ bestDay()?.total ?? 0 }} Reps
              </div>
            </div>
            <div>
              <strong>Aktuelle Streak:</strong>
              <div>{{ currentStreak() }} Tage</div>
            </div>
            <div>
              <strong>Längste Streak:</strong>
              <div>{{ longestStreak() }} Tage</div>
            </div>
          </mat-card-content>
        </mat-card>
      </section>

      <mat-card class="heatmap-full">
        <mat-card-header>
          <mat-card-title>Heatmap (Wochentag/Uhrzeit)</mat-card-title>
        </mat-card-header>
        <mat-card-content class="heatmap-wrap">
          <app-heatmap [entries]="rows()" />
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

    @media (max-width: 600px) {
      .best-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AnalysisPageComponent {
  private readonly api = inject(StatsApiService);

  readonly trendColumns = ['label', 'total'];

  readonly entriesResource = resource({
    loader: async () => firstValueFrom(this.api.listPushups({})),
  });
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
    return [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([label, total]) => ({ label, total }));
  });

  readonly monthTrend = computed<TrendPoint[]>(() => {
    const byMonth = new Map<string, number>();
    for (const row of this.rows()) {
      const date = new Date(row.timestamp);
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(label, (byMonth.get(label) ?? 0) + row.reps);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([label, total]) => ({ label, total }));
  });

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

  private sortedUniqueDates(): string[] {
    return [...new Set(this.rows().map((x) => x.timestamp.slice(0, 10)))].sort(
      (a, b) => a.localeCompare(b)
    );
  }

  private daysBetween(a: string, b: string): number {
    const ad = new Date(`${a}T00:00:00`).getTime();
    const bd = new Date(`${b}T00:00:00`).getTime();
    return Math.round((bd - ad) / 86_400_000);
  }

  private isoWeek(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
    );
  }

  private isoWeekYear(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    return d.getUTCFullYear();
  }
}
