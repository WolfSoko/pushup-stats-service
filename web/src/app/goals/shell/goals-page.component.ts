import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
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
import { GoalsAutoSaveController } from './goals-autosave.controller';
import { GOAL_SCOPES, WEEKDAYS } from './goals-page.content';
import {
  buildExerciseOptions,
  clampTargetForEntry,
  clampTargetToOption,
  findOption,
  makeEntryId,
  normaliseWeekdays,
  targetFromInput,
  targetLabel,
} from './goals-page.helpers';

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
  templateUrl: './goals-page.component.html',
  styleUrl: './goals-page.component.scss',
})
export class GoalsPageComponent implements OnDestroy {
  private readonly userConfigStore = inject(UserConfigStore);
  private readonly user = inject(UserContextService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isGuest = this.user.isGuest;
  readonly exerciseOptions = buildExerciseOptions();
  readonly weekdays = WEEKDAYS;
  readonly scopes = GOAL_SCOPES;
  readonly maxPerScope = COMPLEX_GOALS_MAX_PER_SCOPE;

  readonly removeAriaLabel = $localize`:@@goals.removeAria:Ziel entfernen`;
  readonly weekdayAria = $localize`:@@goals.weekdayAria:Wochentage`;

  private readonly draftDaily = signal<ComplexGoalEntry[]>([]);
  private readonly draftWeekly = signal<ComplexGoalEntry[]>([]);
  private readonly draftMonthly = signal<ComplexGoalEntry[]>([]);

  private readonly draftSnapshot = computed<ComplexGoals>(() => ({
    daily: this.draftDaily(),
    weekly: this.draftWeekly(),
    monthly: this.draftMonthly(),
  }));

  private readonly autoSave = new GoalsAutoSaveController({
    readDraft: () => this.draftSnapshot(),
    applyDraft: (goals) => this.applyGoalsToDrafts(goals),
    save: (goals) => this.userConfigStore.saveGoals(goals),
    isBrowser: isPlatformBrowser(this.platformId),
  });

  readonly saveStatus = this.autoSave.saveStatus;

  constructor() {
    // The realtime listener and the debounce timer both mutate `saveStatus`;
    // running the side-effect blocks in `untracked` keeps those writes from
    // looping the effects back on themselves.
    effect(() => {
      const goals = this.userConfigStore.goals();
      untracked(() => this.autoSave.hydrate(goals));
    });

    effect(() => {
      const draft = this.draftSnapshot();
      untracked(() => this.autoSave.onDraftChange(draft));
    });
  }

  ngOnDestroy(): void {
    this.autoSave.destroy();
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
    this.autoSave.retry();
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
    this.draftDaily.set(goals.daily ?? []);
    this.draftWeekly.set(goals.weekly ?? []);
    this.draftMonthly.set(goals.monthly ?? []);
  }
}
