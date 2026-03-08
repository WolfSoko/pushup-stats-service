import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PushupEntitiesStore } from '@pu-stats/data-access';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';

@Component({
  selector: 'app-entries-page',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    StatsTableComponent,
  ],
  template: `
    <main class="page-wrap">
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
                [value]="from()"
                (input)="from.set(asValue($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.dateTo">Datum bis</mat-label>
              <input
                matInput
                type="date"
                [value]="to()"
                (input)="to.set(asValue($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.sourceFilter">Quelle</mat-label>
              <mat-select [value]="source()" (valueChange)="source.set($event)">
                <mat-option value="" i18n="@@entries.allOption"
                  >Alle</mat-option
                >
                @for (option of sourceOptions(); track option) {
                  <mat-option [value]="option">{{ option }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.typeFilter">Typ</mat-label>
              <mat-select [value]="type()" (valueChange)="type.set($event)">
                <mat-option value="" i18n="@@entries.allOption"
                  >Alle</mat-option
                >
                @for (option of typeOptions(); track option) {
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
                [value]="repsMin() ?? ''"
                (input)="repsMin.set(asNumber($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@entries.repsMax">Reps max</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="repsMax() ?? ''"
                (input)="repsMax.set(asNumber($event))"
              />
            </mat-form-field>
          </section>
        </mat-card-content>
      </mat-card>

      <app-stats-table
        [entries]="filteredRows()"
        [busyAction]="store.busyAction()"
        [busyId]="store.busyId()"
        (create)="onCreateEntry($event)"
        (update)="onUpdateEntry($event)"
        (remove)="onDeleteEntry($event)"
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
  readonly store = inject(PushupEntitiesStore);

  readonly from = signal('');
  readonly to = signal('');
  readonly source = signal('');
  readonly type = signal('');
  readonly repsMin = signal<number | null>(null);
  readonly repsMax = signal<number | null>(null);

  readonly rows = this.store.entriesDesc;
  readonly sourceOptions = this.store.sourceOptions;
  readonly typeOptions = this.store.typeOptions;

  readonly filteredRows = computed(() => {
    const source = this.source();
    const type = this.type();
    const repsMin = this.repsMin();
    const repsMax = this.repsMax();
    const from = this.from();
    const to = this.to();

    return this.rows().filter((row) => {
      const date = row.timestamp.slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (source && row.source !== source) return false;
      if (type && (row.type || 'Standard') !== type) return false;
      if (repsMin !== null && row.reps < repsMin) return false;
      if (repsMax !== null && row.reps > repsMax) return false;
      return true;
    });
  });

  constructor() {
    void this.store.load({});

    effect(() => {
      const from = this.from();
      const to = this.to();
      void this.store.setFilterAndLoad({
        from: from || undefined,
        to: to || undefined,
      });
    });

    effect(() => {
      const rows = this.rows();
      if (!rows.length || this.from() || this.to()) return;

      const oldest = [...rows]
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )[0]
        ?.timestamp.slice(0, 10);
      const today = this.todayIso();
      if (oldest) {
        this.from.set(oldest);
        this.to.set(today);
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

  onCreateEntry(payload: {
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
    return this.store.create(payload);
  }

  onUpdateEntry(payload: {
    id: string;
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
    return this.store.update(payload.id, {
      timestamp: payload.timestamp,
      reps: payload.reps,
      source: payload.source,
      type: payload.type,
    });
  }

  onDeleteEntry(id: string) {
    return this.store.remove(id);
  }

  private todayIso(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
