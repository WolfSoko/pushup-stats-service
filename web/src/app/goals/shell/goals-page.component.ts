import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import {
  type ComplexGoalEntry,
  type ComplexGoals,
  COMPLEX_GOALS_MAX_PER_SCOPE,
  type GoalScope,
  PUSHUP_DEFINITION,
} from '@pu-stats/models';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';
import { UserConfigStore } from '../../core/user-config.store';
import {
  buildExerciseOptions,
  clampTargetForEntry,
  clampTargetToOption,
  cloneGoals,
  findOption,
  makeEntryId,
  normaliseWeekdays,
  scopesEqual,
  targetFromInput,
  targetLabel,
} from './goals-page.helpers';
import {
  AUTO_SAVE_DEBOUNCE_MS,
  type GoalScopeDescriptor,
  SAVED_INDICATOR_MS,
  type SaveStatus,
  type WeekdayOption,
} from './goals-page.models';

const WEEKDAYS: readonly WeekdayOption[] = [
  { value: 1, label: $localize`:@@goals.weekday.short.mon:Mo` },
  { value: 2, label: $localize`:@@goals.weekday.short.tue:Di` },
  { value: 3, label: $localize`:@@goals.weekday.short.wed:Mi` },
  { value: 4, label: $localize`:@@goals.weekday.short.thu:Do` },
  { value: 5, label: $localize`:@@goals.weekday.short.fri:Fr` },
  { value: 6, label: $localize`:@@goals.weekday.short.sat:Sa` },
  { value: 0, label: $localize`:@@goals.weekday.short.sun:So` },
];

@Component({
  selector: 'app-goals-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PageHeaderComponent,
    RouterLink,
  ],
  template: `
    <main class="page-wrap">
      <app-page-header icon="flag" variant="default">
        <h1 page-title i18n="@@goalsHeaderTitle">Tagesziele</h1>
        <p page-subtitle i18n="@@goalsHeaderSubtitle">
          Verschiedene Übungen pro Tag, pro Woche, pro Monat.
        </p>
        <div
          page-actions
          class="save-status"
          role="status"
          aria-live="polite"
          [attr.data-status]="saveStatus()"
          data-testid="goals-save-status"
        >
          @switch (saveStatus()) {
            @case ('saving') {
              <mat-progress-spinner
                diameter="16"
                mode="indeterminate"
              ></mat-progress-spinner>
              <span i18n="@@goals.status.saving">Speichert…</span>
            }
            @case ('saved') {
              <mat-icon class="status-icon ok">check_circle</mat-icon>
              <span i18n="@@goals.status.saved">Gespeichert</span>
            }
            @case ('error') {
              <mat-icon class="status-icon err">error</mat-icon>
              <span i18n="@@goals.status.error">Fehler beim Speichern</span>
              <button
                type="button"
                mat-stroked-button
                (click)="retrySave()"
                i18n="@@goals.status.retry"
              >
                Erneut versuchen
              </button>
            }
            @case ('pending') {
              <mat-icon class="status-icon">edit</mat-icon>
              <span i18n="@@goals.status.pending"
                >Ungespeicherte Änderungen…</span
              >
            }
            @default {
              <mat-icon class="status-icon ok">cloud_done</mat-icon>
              <span i18n="@@goals.status.synced">Alle Ziele gespeichert</span>
            }
          }
        </div>
      </app-page-header>

      @if (isGuest()) {
        <div class="guest-banner">
          <mat-icon>info</mat-icon>
          <span i18n="@@guest.banner.text"
            >Du nutzt die App als Gast. Erstelle ein Konto um alle Funktionen zu
            nutzen.</span
          >
          <a mat-stroked-button routerLink="/register" i18n="@@guest.banner.cta"
            >Konto erstellen</a
          >
        </div>
      }

      <p class="intro" i18n="@@goals.intro">
        Lege pro Tag, Woche und Monat eine Liste von Übungen mit Zielwerten an.
        Bei Tageszielen kannst du außerdem festlegen, an welchen Wochentagen das
        jeweilige Ziel gilt — perfekt für einen Push/Pull/Beine-Splitplan.
      </p>

      @for (scope of scopes; track scope.id) {
        <mat-card
          [id]="'goals-' + scope.id"
          class="section-card"
          [attr.data-testid]="'goals-section-' + scope.id"
        >
          <mat-card-header>
            <mat-icon mat-card-avatar>{{ scope.icon }}</mat-icon>
            <mat-card-title>{{ scope.title }}</mat-card-title>
            <mat-card-subtitle>{{ scope.subtitle }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content class="stack">
            @let list = entriesFor(scope.id)();
            @if (list.length === 0) {
              <p
                class="muted empty"
                [attr.data-testid]="'goals-empty-' + scope.id"
                i18n="@@goals.section.empty"
              >
                Noch keine Ziele angelegt. Füge unten dein erstes Ziel hinzu.
              </p>
            }
            @for (entry of list; track entry.id) {
              <div
                class="goal-row"
                [attr.data-testid]="'goal-row-' + scope.id + '-' + $index"
              >
                <mat-form-field appearance="outline" class="exercise-field">
                  <mat-label i18n="@@goals.field.exercise">Übung</mat-label>
                  <mat-select
                    [value]="entry.exerciseId"
                    (selectionChange)="
                      updateExercise(scope.id, entry.id, $event.value)
                    "
                  >
                    @for (opt of exerciseOptions; track opt.id) {
                      <mat-option [value]="opt.id">{{ opt.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="target-field">
                  <mat-label>{{ targetLabel(entry) }}</mat-label>
                  <input
                    matInput
                    type="number"
                    [min]="targetMin(entry)"
                    [max]="targetMax(entry)"
                    [value]="entry.target"
                    [attr.aria-label]="targetLabel(entry)"
                    (input)="
                      updateTarget(scope.id, entry.id, asNumber($event, 1))
                    "
                  />
                  <span matTextSuffix>{{ entry.unit }}</span>
                </mat-form-field>

                <button
                  type="button"
                  mat-icon-button
                  color="warn"
                  (click)="removeEntry(scope.id, entry.id)"
                  [attr.aria-label]="removeAriaLabel"
                  [attr.data-testid]="'goal-remove-' + scope.id + '-' + $index"
                >
                  <mat-icon>delete</mat-icon>
                </button>

                @if (scope.id === 'daily') {
                  <div class="weekday-row">
                    <span class="weekday-label" i18n="@@goals.weekdayLabel"
                      >Aktiv an:</span
                    >
                    <mat-button-toggle-group
                      multiple
                      hideMultipleSelectionIndicator
                      [value]="weekdayValue(entry)"
                      (change)="
                        updateWeekdays(scope.id, entry.id, $event.value)
                      "
                      [attr.aria-label]="weekdayAria"
                    >
                      @for (day of weekdays; track day.value) {
                        <mat-button-toggle [value]="day.value">{{
                          day.label
                        }}</mat-button-toggle>
                      }
                    </mat-button-toggle-group>
                    @if (weekdayValue(entry).length === 0) {
                      <span
                        class="muted weekday-hint"
                        i18n="@@goals.weekdayEveryDayHint"
                        >Keine Auswahl = gilt jeden Tag.</span
                      >
                    }
                  </div>
                }
              </div>
            }
            <button
              type="button"
              mat-stroked-button
              [disabled]="list.length >= maxPerScope"
              (click)="addEntry(scope.id)"
              [attr.data-testid]="'goal-add-' + scope.id"
            >
              <mat-icon>add</mat-icon>
              <span i18n="@@goals.addEntry">Ziel hinzufügen</span>
            </button>
            @if (list.length >= maxPerScope) {
              <p class="muted limit-hint" i18n="@@goals.limitHint">
                Maximal {{ maxPerScope }} Ziele pro Bereich.
              </p>
            }
          </mat-card-content>
        </mat-card>
      }

      <mat-card class="section-card hint-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>tips_and_updates</mat-icon>
          <mat-card-title i18n="@@goals.linkBack.title"
            >Andere Einstellungen</mat-card-title
          >
          <mat-card-subtitle i18n="@@goals.linkBack.subtitle">
            Profil, Sichtbarkeit, Erinnerungen und Werbung verwalten.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <a
            mat-stroked-button
            routerLink="/settings"
            i18n="@@goals.linkBack.cta"
          >
            <mat-icon>tune</mat-icon>
            Einstellungen öffnen
          </a>
        </mat-card-actions>
      </mat-card>
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 16px;
    }
    .intro {
      margin: 0;
      padding: 12px 16px;
      border-radius: 10px;
      background: rgba(123, 159, 255, 0.08);
      border: 1px solid rgba(123, 159, 255, 0.2);
      line-height: 1.5;
    }
    .save-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      transition:
        background 200ms ease,
        border-color 200ms ease;
    }
    .save-status[data-status='saving'] {
      background: rgba(123, 159, 255, 0.16);
      border-color: rgba(123, 159, 255, 0.4);
    }
    .save-status[data-status='saved'] {
      background: rgba(120, 220, 140, 0.14);
      border-color: rgba(120, 220, 140, 0.36);
    }
    .save-status[data-status='error'] {
      background: rgba(255, 120, 120, 0.16);
      border-color: rgba(255, 120, 120, 0.45);
    }
    .save-status[data-status='pending'] {
      background: rgba(255, 200, 100, 0.14);
      border-color: rgba(255, 200, 100, 0.36);
    }
    .save-status .status-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .save-status .status-icon.ok {
      color: #7fd99a;
    }
    .save-status .status-icon.err {
      color: #ff8b8b;
    }
    .section-card {
      padding: 4px 4px 8px;
    }
    .section-card mat-card-header {
      padding-bottom: 8px;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .goal-row {
      display: grid;
      grid-template-columns: minmax(160px, 1fr) minmax(120px, 180px) auto;
      gap: 8px;
      align-items: center;
      padding: 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .weekday-row {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .weekday-label {
      font-size: 0.85rem;
      opacity: 0.85;
    }
    .weekday-hint {
      flex-basis: 100%;
      margin-top: 0;
    }
    .exercise-field,
    .target-field {
      width: 100%;
    }
    .muted {
      opacity: 0.8;
      font-size: 0.9rem;
      margin: 0;
    }
    .empty {
      padding: 12px 4px;
      font-style: italic;
    }
    .limit-hint {
      margin-top: 4px;
    }
    .guest-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 6px;
      background: rgba(100, 160, 255, 0.1);
      border: 1px solid rgba(100, 160, 255, 0.3);
      flex-wrap: wrap;
    }
    @media (max-width: 640px) {
      .goal-row {
        grid-template-columns: 1fr auto;
      }
      .target-field {
        grid-column: 1 / 2;
      }
    }
  `,
})
export class GoalsPageComponent {
  private readonly userConfigStore = inject(UserConfigStore);
  private readonly user = inject(UserContextService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isGuest = this.user.isGuest;
  readonly exerciseOptions = buildExerciseOptions();
  readonly weekdays = WEEKDAYS;
  readonly maxPerScope = COMPLEX_GOALS_MAX_PER_SCOPE;

  readonly removeAriaLabel = $localize`:@@goals.removeAria:Ziel entfernen`;
  readonly weekdayAria = $localize`:@@goals.weekdayAria:Wochentage`;

  readonly scopes: readonly GoalScopeDescriptor[] = [
    {
      id: 'daily',
      icon: 'today',
      title: $localize`:@@goals.section.daily.title:Tagesziele`,
      subtitle: $localize`:@@goals.section.daily.subtitle:Was du an einzelnen Wochentagen schaffen willst.`,
    },
    {
      id: 'weekly',
      icon: 'date_range',
      title: $localize`:@@goals.section.weekly.title:Wochenziele`,
      subtitle: $localize`:@@goals.section.weekly.subtitle:Summen pro Übung über die ganze Woche.`,
    },
    {
      id: 'monthly',
      icon: 'calendar_month',
      title: $localize`:@@goals.section.monthly.title:Monatsziele`,
      subtitle: $localize`:@@goals.section.monthly.subtitle:Größere Ziele über den ganzen Monat verteilt.`,
    },
  ];

  readonly saveStatus = signal<SaveStatus>('idle');

  private readonly draftDaily = signal<ComplexGoalEntry[]>([]);
  private readonly draftWeekly = signal<ComplexGoalEntry[]>([]);
  private readonly draftMonthly = signal<ComplexGoalEntry[]>([]);

  /**
   * Last persisted snapshot per scope. While drafts diverge from this we
   * consider the user to have unsaved edits and skip rehydration from the
   * Firestore listener so live emissions don't clobber the input.
   */
  private readonly lastPersisted = signal<ComplexGoals | null>(null);

  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightSave: Promise<void> | null = null;

  private readonly draftSnapshot = computed<ComplexGoals>(() => ({
    daily: this.draftDaily(),
    weekly: this.draftWeekly(),
    monthly: this.draftMonthly(),
  }));

  constructor() {
    // Hydrate drafts from store. Skip while dirty or saving so the live
    // Firestore listener doesn't clobber input mid-edit. Mirrors the
    // pattern used in SettingsPageComponent.
    effect(() => {
      const storeGoals = this.userConfigStore.goals();
      untracked(() => {
        const status = this.saveStatus();
        const baseline = this.lastPersisted();
        const dirty =
          baseline !== null && !scopesEqual(this.draftSnapshot(), baseline);
        if (
          baseline !== null &&
          (status === 'pending' || status === 'saving' || dirty)
        ) {
          return;
        }
        this.applyGoalsToDrafts(storeGoals);
      });
    });

    // Auto-save: every draft change schedules a debounced flush.
    effect(() => {
      const draft = this.draftSnapshot();
      const baseline = this.lastPersisted();
      untracked(() => {
        if (baseline === null) return;
        if (scopesEqual(draft, baseline)) {
          this.cancelAutoSaveTimer();
          if (this.saveStatus() === 'pending') this.saveStatus.set('idle');
          return;
        }
        this.scheduleAutoSave();
      });
    });
  }

  entriesFor(scope: GoalScope) {
    switch (scope) {
      case 'daily':
        return this.draftDaily;
      case 'weekly':
        return this.draftWeekly;
      case 'monthly':
        return this.draftMonthly;
    }
  }

  retrySave(): void {
    void this.flushSave();
  }

  addEntry(scope: GoalScope): void {
    const list = this.entriesFor(scope)();
    if (list.length >= this.maxPerScope) return;
    const next: ComplexGoalEntry = {
      id: makeEntryId(),
      exerciseId: PUSHUP_DEFINITION.id,
      target: 10,
      measurement: PUSHUP_DEFINITION.measurement,
      unit: PUSHUP_DEFINITION.unit,
    };
    this.entriesFor(scope).set([...list, next]);
  }

  removeEntry(scope: GoalScope, entryId: string): void {
    const list = this.entriesFor(scope)();
    this.entriesFor(scope).set(list.filter((e) => e.id !== entryId));
  }

  updateExercise(scope: GoalScope, entryId: string, exerciseId: string): void {
    const opt = findOption(this.exerciseOptions, exerciseId);
    if (!opt) return;
    this.entriesFor(scope).update((list) =>
      list.map((e) =>
        e.id === entryId
          ? {
              ...e,
              exerciseId: opt.id,
              measurement: opt.measurement,
              unit: opt.unit,
              target: clampTargetToOption(e.target, opt),
            }
          : e
      )
    );
  }

  updateTarget(scope: GoalScope, entryId: string, target: number): void {
    if (!Number.isFinite(target)) return;
    this.entriesFor(scope).update((list) =>
      list.map((e) =>
        e.id === entryId
          ? {
              ...e,
              target: clampTargetForEntry(
                target,
                findOption(this.exerciseOptions, e.exerciseId)
              ),
            }
          : e
      )
    );
  }

  /** Catalog `min` for the entry's exercise (defaults to 1). */
  targetMin(entry: ComplexGoalEntry): number {
    return findOption(this.exerciseOptions, entry.exerciseId)?.min ?? 1;
  }

  /** Catalog `max` for the entry's exercise — used for the `<input>` cap. */
  targetMax(entry: ComplexGoalEntry): number {
    return (
      findOption(this.exerciseOptions, entry.exerciseId)?.max ??
      Number.MAX_SAFE_INTEGER
    );
  }

  updateWeekdays(scope: GoalScope, entryId: string, weekdays: number[]): void {
    if (scope !== 'daily') return;
    const normalised = normaliseWeekdays(weekdays);
    this.entriesFor(scope).update((list) =>
      list.map((e) => (e.id === entryId ? { ...e, weekdays: normalised } : e))
    );
  }

  weekdayValue(entry: ComplexGoalEntry): number[] {
    return entry.weekdays ?? [];
  }

  targetLabel(entry: ComplexGoalEntry): string {
    return targetLabel(entry);
  }

  asNumber(event: Event, fallback: number): number {
    return targetFromInput(event, fallback);
  }

  private applyGoalsToDrafts(goals: ComplexGoals): void {
    const snapshot = cloneGoals(goals);
    this.draftDaily.set(snapshot.daily ?? []);
    this.draftWeekly.set(snapshot.weekly ?? []);
    this.draftMonthly.set(snapshot.monthly ?? []);
    this.lastPersisted.set(cloneGoals(goals));
    if (this.saveStatus() === 'pending') this.saveStatus.set('idle');
  }

  private scheduleAutoSave(): void {
    this.saveStatus.set('pending');
    this.cancelAutoSaveTimer();
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.flushSave();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  private cancelAutoSaveTimer(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private async flushSave(): Promise<void> {
    if (this.inFlightSave) {
      await this.inFlightSave;
      const draft = this.draftSnapshot();
      const baseline = this.lastPersisted();
      if (baseline && scopesEqual(draft, baseline)) return;
    }
    const run = this.performSave();
    this.inFlightSave = run;
    try {
      await run;
    } finally {
      if (this.inFlightSave === run) this.inFlightSave = null;
    }
  }

  private async performSave(): Promise<void> {
    this.cancelAutoSaveTimer();
    const draft = this.draftSnapshot();
    this.saveStatus.set('saving');
    try {
      await this.userConfigStore.saveGoals(draft);
      this.lastPersisted.set(cloneGoals(draft));
      this.saveStatus.set('saved');
      if (this.savedTimer !== null) clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => {
        this.savedTimer = null;
        if (this.saveStatus() === 'saved') this.saveStatus.set('idle');
      }, SAVED_INDICATOR_MS);
    } catch {
      this.saveStatus.set('error');
    }
  }
}
