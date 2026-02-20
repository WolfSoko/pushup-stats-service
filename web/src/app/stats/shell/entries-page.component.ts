import {
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { PushupLiveDataService, StatsApiService } from '@pu-stats/data-access';
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
          <mat-card-title>Daten</mat-card-title>
          <mat-card-subtitle>Filter und Verwaltung</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <section class="filters">
            <mat-form-field appearance="outline">
              <mat-label>Datum von</mat-label>
              <input
                matInput
                type="date"
                [value]="from()"
                (input)="from.set(asValue($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Datum bis</mat-label>
              <input
                matInput
                type="date"
                [value]="to()"
                (input)="to.set(asValue($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Quelle</mat-label>
              <mat-select [value]="source()" (valueChange)="source.set($event)">
                <mat-option value="">Alle</mat-option>
                @for (option of sourceOptions(); track option) {
                  <mat-option [value]="option">{{ option }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Typ</mat-label>
              <mat-select [value]="type()" (valueChange)="type.set($event)">
                <mat-option value="">Alle</mat-option>
                @for (option of typeOptions(); track option) {
                  <mat-option [value]="option">{{ option }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Reps min</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="repsMin() ?? ''"
                (input)="repsMin.set(asNumber($event))"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Reps max</mat-label>
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
        [busyAction]="busyAction()"
        [busyId]="busyId()"
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
  private readonly api = inject(StatsApiService);
  private readonly live = inject(PushupLiveDataService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly from = signal('');
  readonly to = signal('');
  readonly source = signal('');
  readonly type = signal('');
  readonly repsMin = signal<number | null>(null);
  readonly repsMax = signal<number | null>(null);
  readonly busyAction = signal<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = signal<string | null>(null);

  // SSR should keep using REST.
  readonly entriesResource = resource({
    params: () => ({
      from: this.from() || undefined,
      to: this.to() || undefined,
    }),
    loader: async ({ params }) => firstValueFrom(this.api.listPushups(params)),
  });

  readonly rows = computed(() => {
    return this.isBrowser
      ? this.live.entries()
      : (this.entriesResource.value() ?? []);
  });

  readonly sourceOptions = computed(() => {
    return [
      ...new Set(
        this.rows()
          .map((x) => x.source)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  });

  readonly typeOptions = computed(() => {
    return [
      ...new Set(
        this.rows()
          .map((x) => x.type || 'Standard')
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  });

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

  async onCreateEntry(payload: {
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
    this.busyAction.set('create');
    this.busyId.set(null);
    try {
      await firstValueFrom(this.api.createPushup(payload));
      if (!this.isBrowser) this.entriesResource.reload();
    } finally {
      this.busyAction.set(null);
      this.busyId.set(null);
    }
  }

  async onUpdateEntry(payload: {
    id: string;
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
    this.busyAction.set('update');
    this.busyId.set(payload.id);
    try {
      await firstValueFrom(
        this.api.updatePushup(payload.id, {
          timestamp: payload.timestamp,
          reps: payload.reps,
          source: payload.source,
          type: payload.type,
        })
      );
      if (!this.isBrowser) this.entriesResource.reload();
    } finally {
      this.busyAction.set(null);
      this.busyId.set(null);
    }
  }

  async onDeleteEntry(id: string) {
    this.busyAction.set('delete');
    this.busyId.set(id);
    try {
      await firstValueFrom(this.api.deletePushup(id));
      if (!this.isBrowser) this.entriesResource.reload();
    } finally {
      this.busyAction.set(null);
      this.busyId.set(null);
    }
  }

  private todayIso(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
