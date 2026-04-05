import { Component, effect, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';
import { EntriesStore } from '../entries.store';

@Component({
  selector: 'app-entries-page',
  providers: [EntriesStore],
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PreviewBannerComponent,
    StatsTableComponent,
  ],
  template: `
    <main class="page-wrap">
      <app-preview-banner />
      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@entries.title">Daten</mat-card-title>
          <mat-card-subtitle i18n="@@entries.subtitle"
            >Filter und Verwaltung</mat-card-subtitle
          >
        </mat-card-header>

        <mat-card-content>
          <section class="filters">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.dateFrom">Datum von</mat-label>
              <input
                matInput
                type="date"
                [value]="store.from()"
                (input)="store.setFrom(asValue($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.dateTo">Datum bis</mat-label>
              <input
                matInput
                type="date"
                [value]="store.to()"
                (input)="store.setTo(asValue($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.sourceFilter">Quelle</mat-label>
              <mat-select
                [value]="store.source()"
                (valueChange)="store.setSource($event)"
              >
                <mat-option value="" i18n="@@entries.allOption"
                  >Alle</mat-option
                >
                @for (option of store.sourceOptions(); track option) {
                  <mat-option [value]="option">{{ option }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.typeFilter">Typ</mat-label>
              <mat-select
                [value]="store.type()"
                (valueChange)="store.setType($event)"
              >
                <mat-option value="" i18n="@@entries.allOption"
                  >Alle</mat-option
                >
                @for (option of store.typeOptions(); track option) {
                  <mat-option [value]="option">{{ option }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.repsMin">Reps min</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="store.repsMin() ?? ''"
                (input)="store.setRepsMin(asNumber($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.repsMax">Reps max</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="store.repsMax() ?? ''"
                (input)="store.setRepsMax(asNumber($event))"
              />
            </mat-form-field>
          </section>
        </mat-card-content>
      </mat-card>

      <app-stats-table
        [entries]="store.filteredRows()"
        [busyAction]="store.busyAction()"
        [busyId]="store.busyId()"
        (create)="store.createEntry($event)"
        (update)="store.updateEntry($event)"
        (remove)="store.deleteEntry($event)"
      />
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .filters {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
  `,
})
export class EntriesPageComponent {
  protected readonly store = inject(EntriesStore);

  constructor() {
    effect(() => {
      const rows = this.store.rows();
      if (!rows.length || this.store.from() || this.store.to()) return;

      const oldest = [...rows]
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )[0]
        ?.timestamp.slice(0, 10);
      const today = this.todayIso();
      if (oldest) {
        this.store.setFrom(oldest);
        this.store.setTo(today);
      }
    });
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  asNumber(event: Event): number | null {
    const value = (event.target as HTMLInputElement).value;
    if (!value) return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  private todayIso(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
