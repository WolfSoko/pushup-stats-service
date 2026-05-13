import { Component, computed, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { findExerciseDefinition } from '@pu-stats/models';
import { exerciseDisplayName } from '../i18n/exercise-display-names';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';
import { EntriesStore, type ExerciseKindFilterOption } from '../entries.store';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';

@Component({
  selector: 'app-entries-page',
  providers: [EntriesStore],
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    PageHeaderComponent,
    PreviewBannerComponent,
    StatsTableComponent,
  ],
  template: `
    <main class="page-wrap">
      <app-preview-banner />
      <app-page-header icon="history" variant="history">
        <h1 page-title i18n="@@historyHeaderTitle">Historie</h1>
        <p page-subtitle i18n="@@historyHeaderSubtitle">
          Durchsuche, filtere und bearbeite deine Trainingseinträge.
        </p>
      </app-page-header>
      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@entries.title">Filter</mat-card-title>
          <mat-card-subtitle i18n="@@entries.subtitle"
            >Zeitraum und Kriterien</mat-card-subtitle
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
              <mat-label i18n="@@entries.exerciseFilter">Übung</mat-label>
              <mat-select
                multiple
                [value]="store.kinds()"
                (valueChange)="store.setKinds($event)"
              >
                @for (option of kindFilterOptions(); track option.value) {
                  <mat-option [value]="option.value">{{
                    option.label
                  }}</mat-option>
                }
              </mat-select>
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
                @for (option of store.typeOptions(); track option.value) {
                  <mat-option [value]="option.value">{{
                    option.label
                  }}</mat-option>
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

      @if (store.entriesLoaded() && !store.rows().length) {
        <mat-card class="empty-cta" data-testid="entries-empty-cta">
          <mat-card-content>
            <mat-icon aria-hidden="true">fitness_center</mat-icon>
            <div>
              <strong i18n="@@entries.empty.title">Noch keine Einträge.</strong>
              <p i18n="@@entries.empty.body">
                Trage deinen ersten Trainingseintrag ein — dann wird hier deine
                Historie sichtbar.
              </p>
            </div>
            <a
              mat-flat-button
              color="primary"
              routerLink="/app"
              [queryParams]="{ log: '1' }"
              data-testid="entries-empty-cta-log"
              i18n="@@entries.empty.cta"
            >
              <mat-icon aria-hidden="true">add</mat-icon>
              Eintrag erstellen
            </a>
          </mat-card-content>
        </mat-card>
      }
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
    .empty-cta mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .empty-cta mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      opacity: 0.7;
    }
    .empty-cta strong {
      display: block;
      margin-bottom: 4px;
    }
    .empty-cta p {
      margin: 0;
      opacity: 0.85;
      max-width: 48ch;
    }
    .empty-cta a {
      margin-left: auto;
    }
  `,
})
export class EntriesPageComponent {
  protected readonly store = inject(EntriesStore);

  /**
   * Locale-aware labels for the new "Übung" multi-select. Built in the
   * component because `$localize` is template/component territory; the
   * signal store stays UI-framework-agnostic.
   */
  readonly kindFilterOptions = computed<ExerciseKindFilterOption[]>(() =>
    this.store.kindOptionsRaw().map((value) => ({
      value,
      label: this.kindLabel(value),
    }))
  );

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

  private kindLabel(value: string): string {
    if (value === 'pushup') {
      return $localize`:@@exercise.category.push:Drücken`;
    }
    const def = findExerciseDefinition(value);
    if (!def) return value;
    return exerciseDisplayName(def.id);
  }
}
