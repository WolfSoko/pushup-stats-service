import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import {
  ExerciseFirestoreService,
  ExerciseValidationError,
} from '@pu-stats/data-access';
import {
  ExerciseCategoryId,
  ExerciseDefinition,
  ExerciseEntry,
  exercisesByCategory,
  findExerciseCategory,
  formatEntryDisplay,
  formatEntryTotal,
  measurementCompanionValueField,
  measurementValueField,
  toLocalIsoDate,
} from '@pu-stats/models';
import { firstValueFrom, of } from 'rxjs';
import {
  EntryDialogComponent,
  EntryDialogData,
  EntryDialogResult,
} from '../entry-dialog/entry-dialog.component';

interface ExerciseSummary {
  definition: ExerciseDefinition;
  /** Sum of the primary measurement value over the last 30 days. */
  totalValue30d: number;
  /**
   * Sum of the secondary (companion) display value over the same
   * window — only set for composite measurements like
   * `'distance-time'`, where the duration matters as much as the
   * distance. `undefined` for single-value exercises.
   */
  totalCompanionValue30d?: number;
  lastEntry: ExerciseEntry | null;
}

/**
 * Phase-0 dashboard section per exercise category. Shows the user's
 * total reps over the last 30 days for each catalog exercise in this
 * category and a single button per exercise that opens the lightweight
 * {@link EntryDialogComponent}. Pushup data lives in the
 * legacy collection and is intentionally NOT rendered here — that
 * stays on the existing dashboard cards above.
 */
@Component({
  selector: 'app-exercise-category-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
  ],
  styles: [
    `
      :host {
        display: block;
        margin-top: 16px;
      }
      mat-card {
        border-radius: 16px;
      }
      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .exercise-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
      .exercise-row:first-of-type {
        border-top: none;
      }
      .exercise-label {
        font-weight: 500;
      }
      .exercise-meta {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      .exercise-stats {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .exercise-stats .total {
        font-weight: 600;
      }
      .exercise-stats .label {
        display: block;
        font-size: 11px;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
  template: `
    @if (categoryInfo(); as cat) {
      <mat-card>
        <mat-card-content>
          <div class="section-header">
            <mat-icon aria-hidden="true">{{ cat.icon }}</mat-icon>
            <h2 class="title">{{ categoryName() }}</h2>
          </div>

          @for (item of summaries(); track item.definition.id) {
            <div class="exercise-row">
              <div>
                <div class="exercise-label">
                  {{ exerciseName(item.definition.id) }}
                </div>
                @if (item.lastEntry; as last) {
                  <div class="exercise-meta">
                    <span i18n="@@exerciseSection.lastEntry">Letzter Eintrag</span>
                    : {{ last.timestamp | date: 'shortDate' }}
                    — {{ formatValue(item.definition, last) }}
                  </div>
                }
              </div>
              <div class="exercise-stats">
                <span class="total">{{ formatTotal(item) }}</span>
                <span class="label" i18n="@@exerciseSection.last30d"
                  >Letzte 30 Tage</span
                >
              </div>
              <button
                type="button"
                mat-flat-button
                (click)="openDialog(item.definition)"
                [attr.aria-label]="addAriaLabel(item.definition.id)"
              >
                <mat-icon>add</mat-icon>
                <span i18n="@@exerciseSection.add">Hinzufügen</span>
              </button>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class ExerciseCategorySectionComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly userContext = inject(UserContextService);
  private readonly exerciseService = inject(ExerciseFirestoreService);

  readonly categoryId = input.required<ExerciseCategoryId>();

  readonly categoryInfo = computed(() => findExerciseCategory(this.categoryId()));

  readonly categoryName = computed(() => this.localizeCategory(this.categoryId()));

  /**
   * Pre-built per-exercise i18n lookup. We keep `$localize` calls outside
   * of the component method so the extractor sees them at build time.
   */
  private readonly i18n = buildI18n();

  exerciseName(id: string): string {
    return this.i18n.exerciseNames[id] ?? id;
  }

  addAriaLabel(id: string): string {
    return `${this.i18n.addPrefix}: ${this.exerciseName(id)}`;
  }

  /**
   * Format the per-row "last entry" value. Delegates to
   * `formatEntryDisplay` which handles single-value AND composite
   * measurements (e.g. distance-time renders as
   * `"5.00 km · 25:00 (5:00 /km)"`).
   */
  formatValue(def: ExerciseDefinition, entry: ExerciseEntry): string {
    return formatEntryDisplay(entry, def);
  }

  formatTotal(summary: ExerciseSummary): string {
    return formatEntryTotal(
      {
        primary: summary.totalValue30d,
        companion: summary.totalCompanionValue30d,
      },
      summary.definition
    );
  }

  private localizeCategory(id: ExerciseCategoryId): string {
    return this.i18n.categoryNames[id] ?? id;
  }

  private readonly entriesResource = rxResource({
    params: () => {
      const defs = exercisesByCategory().get(this.categoryId()) ?? [];
      return {
        userId: this.userContext.userIdSafe(),
        exerciseIds: defs.map((d) => d.id),
      };
    },
    stream: ({ params }) => {
      if (!params.userId || params.exerciseIds.length === 0) {
        return of<ExerciseEntry[]>([]);
      }
      return this.exerciseService.listEntries(params.userId, {
        exerciseIds: params.exerciseIds,
        filter: { from: thirtyDaysAgoIso() },
      });
    },
  });

  readonly summaries = computed<ExerciseSummary[]>(() => {
    const entries = this.entriesResource.value() ?? [];
    const defs = exercisesByCategory().get(this.categoryId()) ?? [];
    return defs.map((def) => {
      const matching = entries.filter((e) => e.exerciseId === def.id);
      // The summary total is exercise-scoped: seconds for plank, reps
      // for sit-ups, distance + duration for a tracked run.
      // `measurementValueField` picks the primary field; for composite
      // measurements (`distance-time`) we also sum the companion field
      // so the card can show "42.00 km · 3:30:00 (5:00 /km)".
      const valueField = measurementValueField(def.measurement);
      const companionField = measurementCompanionValueField(def.measurement);
      const totalValue30d = matching.reduce((s, e) => {
        const v = (e[valueField] as number | undefined) ?? 0;
        return s + v;
      }, 0);
      const totalCompanionValue30d = companionField
        ? matching.reduce((s, e) => {
            const v = (e[companionField] as number | undefined) ?? 0;
            return s + v;
          }, 0)
        : undefined;
      // Compare via Date.parse so an offset-bearing timestamp
      // (e.g. `…+02:00`) and a Z-suffixed one sort by their absolute
      // instant — string comparison would order them lexicographically
      // and pick the wrong "latest" entry across timezones.
      const lastEntry = matching.length
        ? matching.reduce((latest, e) =>
            Date.parse(e.timestamp) > Date.parse(latest.timestamp)
              ? e
              : latest
          )
        : null;
      return {
        definition: def,
        totalValue30d,
        totalCompanionValue30d,
        lastEntry,
      };
    });
  });

  async openDialog(def: ExerciseDefinition): Promise<void> {
    const userId = this.userContext.userIdSafe();
    if (!userId) return;
    const ref = this.dialog.open<
      EntryDialogComponent,
      EntryDialogData,
      EntryDialogResult | undefined
    >(EntryDialogComponent, {
      data: {
        definition: def,
        exerciseName: this.exerciseName(def.id),
      },
      width: '420px',
      maxWidth: '95vw',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      await firstValueFrom(
        this.exerciseService.createEntry(userId, {
          exerciseId: result.exerciseId,
          timestamp: result.timestamp,
          // Measurement-aware payload shape: time exercises (plank)
          // ship a `durationSec` and no reps/sets; reps exercises do
          // the inverse. Mirroring the dialog's measurement
          // discriminator keeps the validator happy on both paths.
          ...(result.measurement === 'time'
            ? { durationSec: result.durationSec ?? 0 }
            : {
                reps: result.reps,
                ...(result.sets.length > 1 ? { sets: result.sets } : {}),
              }),
          ...(result.variantId ? { variantId: result.variantId } : {}),
        })
      );
      this.entriesResource.reload();
      this.snack.open(this.i18n.savedToast, this.i18n.dismissLabel, {
        duration: 3000,
      });
    } catch (err) {
      // EntryDialogComponent clamps reps to def.min/def.max and locks
      // canSubmit() at the cap, so an ExerciseValidationError here is
      // a programming or schema-mismatch surface — show the generic
      // toast and let Sentry / the browser console capture the
      // diagnostic.
      const message =
        err instanceof ExerciseValidationError
          ? this.i18n.errorPrefix
          : this.i18n.genericError;
      this.snack.open(message, this.i18n.dismissLabel, { duration: 5000 });
    }
  }
}

function thirtyDaysAgoIso(): string {
  // Use the project's local-zone-aware formatter rather than slicing a
  // UTC ISO — for users east of UTC the slice can shift the cutoff by
  // a day around midnight and silently drop or include an extra day's
  // entries from the section summary.
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toLocalIsoDate(d);
}

interface I18nBundle {
  categoryNames: Record<string, string>;
  exerciseNames: Record<string, string>;
  addPrefix: string;
  savedToast: string;
  dismissLabel: string;
  errorPrefix: string;
  genericError: string;
}

function buildI18n(): I18nBundle {
  const categoryNames: Record<string, string> = {
    pushup: $localize`:@@exercise.category.pushup:Liegestütze`,
    abs: $localize`:@@exercise.category.abs:Bauch`,
    legs: $localize`:@@exercise.category.legs:Beine`,
    plank: $localize`:@@exercise.category.plank:Plank`,
    cardio: $localize`:@@exercise.category.cardio:Ausdauer`,
  };
  const exerciseNames: Record<string, string> = {
    'abs.situps': $localize`:@@exercise.abs.situps.name:Sit-ups`,
    'legs.squats': $localize`:@@exercise.legs.squats.name:Kniebeugen`,
    'plank.standard': $localize`:@@exercise.plank.standard.name:Plank`,
    'cardio.running': $localize`:@@exercise.cardio.running.name:Laufen`,
  };
  return {
    categoryNames,
    exerciseNames,
    addPrefix: $localize`:@@exerciseSection.addAriaPrefix:Eintrag hinzufügen`,
    savedToast: $localize`:@@exerciseSection.savedToast:Eintrag gespeichert`,
    dismissLabel: $localize`:@@exerciseSection.dismiss:OK`,
    errorPrefix: $localize`:@@exerciseSection.errorPrefix:Konnte nicht gespeichert werden`,
    genericError: $localize`:@@exerciseSection.genericError:Etwas ist schiefgelaufen`,
  };
}
