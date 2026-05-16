import { isPlatformBrowser } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import {
  EXERCISE_WIKI_CATALOG,
  type ExerciseWikiEntry,
  localizeExerciseWiki,
} from '@pu-stats/models';

interface LocalizedExercise {
  id: string;
  slug: string;
  difficulty: ExerciseWikiEntry['difficulty'];
  categoryId: ExerciseWikiEntry['categoryId'];
  icon: string;
  name: string;
  summary: string;
  instructions: ReadonlyArray<string>;
  tips: ReadonlyArray<string>;
}

interface CategoryGroup {
  id: ExerciseWikiEntry['categoryId'];
  label: string;
  entries: ReadonlyArray<LocalizedExercise>;
}

@Component({
  selector: 'app-exercises-wiki-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wiki-page">
      <header class="wiki-header">
        <a
          mat-icon-button
          routerLink="/training-plans"
          aria-label="Zurück zu den Trainingsplänen"
          i18n-aria-label="@@wiki.exercises.back"
        >
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="wiki-header-text">
          <h1 i18n="@@wiki.exercises.title">Übungen — saubere Ausführung</h1>
          <p class="muted" i18n="@@wiki.exercises.intro">
            Kurzanleitungen für alle Übungen, die du in der App tracken kannst —
            von Kniebeugen über Klimmzüge bis zu Mobilitäts-Drills.
          </p>
        </div>
      </header>

      <nav class="toc" aria-labelledby="wiki-exercises-toc-heading">
        <h2 id="wiki-exercises-toc-heading" i18n="@@wiki.exercises.tocTitle">
          Übersicht
        </h2>
        @for (group of categories(); track group.id) {
          <section class="toc-group">
            <h3>{{ group.label }}</h3>
            <ul>
              @for (entry of group.entries; track entry.id) {
                <li>
                  <a
                    class="toc-link"
                    href="#{{ entry.slug }}"
                    (click)="scrollTo($event, entry.slug)"
                    >{{ entry.name }}</a
                  >
                  <span class="muted toc-summary"> — {{ entry.summary }}</span>
                </li>
              }
            </ul>
          </section>
        }
      </nav>

      <div class="type-list">
        @for (group of categories(); track group.id) {
          <h2 class="category-heading">{{ group.label }}</h2>
          @for (entry of group.entries; track entry.id) {
            <section [id]="entry.slug" class="type-section">
              <mat-card>
                <mat-card-header class="type-card-header">
                  <mat-card-title>
                    <h3>{{ entry.name }}</h3>
                  </mat-card-title>
                  <mat-card-subtitle>
                    <mat-chip-set>
                      @if (entry.difficulty === 'beginner') {
                        <mat-chip
                          class="difficulty-chip beginner"
                          i18n="@@wiki.pushupTypes.level.beginner"
                          >Einsteiger</mat-chip
                        >
                      } @else if (entry.difficulty === 'intermediate') {
                        <mat-chip
                          class="difficulty-chip intermediate"
                          i18n="@@wiki.pushupTypes.level.intermediate"
                          >Mittelstufe</mat-chip
                        >
                      } @else {
                        <mat-chip
                          class="difficulty-chip advanced"
                          i18n="@@wiki.pushupTypes.level.advanced"
                          >Fortgeschritten</mat-chip
                        >
                      }
                    </mat-chip-set>
                  </mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p class="type-summary">{{ entry.summary }}</p>
                  <h4 i18n="@@wiki.pushupTypes.instructionsTitle">
                    Ausführung
                  </h4>
                  <ol class="instructions">
                    @for (step of entry.instructions; track $index) {
                      <li>{{ step }}</li>
                    }
                  </ol>
                  @if (entry.tips.length > 0) {
                    <h4 i18n="@@wiki.pushupTypes.tipsTitle">Tipps</h4>
                    <ul class="tips">
                      @for (tip of entry.tips; track $index) {
                        <li>{{ tip }}</li>
                      }
                    </ul>
                  }
                  <a
                    mat-button
                    class="detail-link"
                    [routerLink]="['/wiki/uebungen', entry.slug]"
                    i18n="@@wiki.exercises.viewDetail"
                    >Detailseite öffnen</a
                  >
                </mat-card-content>
              </mat-card>
            </section>
          }
        }
      </div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .wiki-page {
        max-width: 880px;
        margin: 0 auto;
        padding: 24px 16px 48px;
      }
      .wiki-header {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 24px;
      }
      .wiki-header-text {
        flex: 1;
        min-width: 0;
      }
      .wiki-header h1 {
        margin: 4px 0 8px;
        font-size: clamp(1.5rem, 4vw, 2rem);
        line-height: 1.2;
      }
      .wiki-header p {
        margin: 0;
        line-height: 1.55;
      }
      .muted {
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .toc {
        background: var(--mat-sys-surface-container, rgba(0, 0, 0, 0.04));
        padding: 20px 24px;
        border-radius: 12px;
        margin-bottom: 40px;
      }
      .toc h2 {
        margin: 0 0 16px;
        font-size: 1.05rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mat-sys-on-surface-variant);
      }
      .toc-group {
        margin-bottom: 16px;
      }
      .toc-group:last-child {
        margin-bottom: 0;
      }
      .toc-group h3 {
        margin: 0 0 6px;
        font-size: 0.95rem;
        color: var(--mat-sys-primary);
      }
      .toc ul {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 6px;
      }
      .toc li {
        line-height: 1.5;
      }
      .toc-link {
        font-weight: 500;
        text-decoration: none;
        color: var(--mat-sys-primary);
      }
      .toc-link:hover,
      .toc-link:focus-visible {
        text-decoration: underline;
      }
      .toc-summary {
        font-size: 0.9rem;
      }
      .type-list {
        display: grid;
        gap: 16px;
      }
      .category-heading {
        margin: 32px 0 4px;
        font-size: 1.1rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .category-heading:first-child {
        margin-top: 0;
      }
      .type-section {
        scroll-margin-top: 80px;
      }
      .type-section mat-card {
        padding: 8px 4px;
      }
      .type-card-header {
        margin-bottom: 8px;
      }
      .type-section h3 {
        margin: 0;
        font-size: 1.25rem;
      }
      .type-section h4 {
        margin: 20px 0 6px;
        font-size: 0.95rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .type-summary {
        font-weight: 500;
        margin-top: 4px;
        margin-bottom: 0;
        line-height: 1.55;
      }
      .difficulty-chip {
        font-size: 0.78rem;
        --mdc-chip-container-height: 24px;
      }
      .difficulty-chip.beginner {
        --mdc-chip-elevated-container-color: rgba(76, 175, 80, 0.18);
      }
      .difficulty-chip.intermediate {
        --mdc-chip-elevated-container-color: rgba(255, 167, 38, 0.2);
      }
      .difficulty-chip.advanced {
        --mdc-chip-elevated-container-color: rgba(244, 67, 54, 0.2);
      }
      .instructions,
      .tips {
        padding-left: 22px;
        line-height: 1.6;
        margin: 4px 0 0;
      }
      .instructions li,
      .tips li {
        margin-bottom: 6px;
      }
      .instructions li:last-child,
      .tips li:last-child {
        margin-bottom: 0;
      }
      .detail-link {
        margin-top: 16px;
        margin-left: -8px;
      }
    `,
  ],
})
export class ExercisesWikiPageComponent {
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly route = inject(ActivatedRoute);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly categories = computed<ReadonlyArray<CategoryGroup>>(() => {
    const labels = this.categoryLabels();
    const grouped = new Map<
      ExerciseWikiEntry['categoryId'],
      LocalizedExercise[]
    >();
    for (const entry of EXERCISE_WIKI_CATALOG) {
      const localized = localizeExerciseWiki(entry, this.locale);
      if (!localized) continue;
      const bucket = grouped.get(entry.categoryId) ?? [];
      bucket.push({
        id: entry.id,
        slug: entry.slug,
        difficulty: entry.difficulty,
        categoryId: entry.categoryId,
        icon: entry.icon,
        name: localized.name,
        summary: localized.summary,
        instructions: localized.instructions,
        tips: localized.tips,
      });
      grouped.set(entry.categoryId, bucket);
    }
    const out: CategoryGroup[] = [];
    for (const [id, entries] of grouped) {
      out.push({ id, label: labels[id] ?? id, entries });
    }
    return out;
  });

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  constructor() {
    afterRenderEffect(() => {
      const slug = this.queryParams().get('exercise');
      if (slug) {
        this.scrollToSection(slug);
      }
    });
  }

  scrollTo(event: Event, slug: string): void {
    event.preventDefault();
    this.scrollToSection(slug);
    if (this.isBrowser && history.replaceState) {
      history.replaceState(null, '', `${location.pathname}#${slug}`);
    }
  }

  private scrollToSection(slug: string): void {
    if (!this.isBrowser) return;
    const target = document.getElementById(slug);
    if (target && this.host.nativeElement.contains(target)) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Category labels are extracted as `$localize` so the XLIFF extractor
  // picks them up. Mirrors the categoryDisplayName helper in
  // exercise-display-names.ts, but inlined to keep this component free
  // of feature-lib dependencies.
  private categoryLabels(): Partial<
    Record<ExerciseWikiEntry['categoryId'], string>
  > {
    return {
      push: $localize`:@@exercise.category.push:Drücken`,
      pull: $localize`:@@exercise.category.pull:Ziehen`,
      squat: $localize`:@@exercise.category.squat:Kniebeuge`,
      hinge: $localize`:@@exercise.category.hinge:Hüftstreckung`,
      lunge: $localize`:@@exercise.category.lunge:Ausfallschritt`,
      core: $localize`:@@exercise.category.core:Rumpf`,
      cardio: $localize`:@@exercise.category.cardio:Ausdauer`,
      mobility: $localize`:@@exercise.category.mobility:Mobilität`,
    };
  }
}
