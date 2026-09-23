import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  InjectionToken,
  LOCALE_ID,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BRAND_LOGO_URL,
  BRAND_NAME,
  BRAND_URL,
  type ExerciseWikiEntry,
  type ExerciseWikiLocalized,
  findExerciseWikiEntryBySlug,
  localizeExerciseWiki,
} from '@pu-stats/models';
import { SeoService } from '../core/seo.service';
import { isWorkoutExercise } from '../workouts/workout-form';

// `vi.mock` cannot intercept this workspace-internal import in the `web`
// esbuild unit-test build (see docs/gotchas/testing.md), so the noindex
// gate for a locale whose translation body hasn't caught up yet — no
// longer reachable through any real catalog entry now that every locale
// carries a body — is tested via this DI seam instead.
export const EXERCISE_WIKI_ENTRY_LOOKUP = new InjectionToken<
  typeof findExerciseWikiEntryBySlug
>('EXERCISE_WIKI_ENTRY_LOOKUP', {
  providedIn: 'root',
  factory: () => findExerciseWikiEntryBySlug,
});

export const EXERCISE_WIKI_LOCALIZER = new InjectionToken<
  (entry: ExerciseWikiEntry, locale: string) => ExerciseWikiLocalized | null
>('EXERCISE_WIKI_LOCALIZER', {
  providedIn: 'root',
  factory: () => localizeExerciseWiki,
});

@Component({
  selector: 'app-exercise-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entry) {
      <article class="detail-page">
        <header class="detail-header">
          <a
            mat-button
            routerLink="/wiki/uebungen"
            class="back-link"
            i18n="@@wiki.exercise.detail.back"
          >
            <mat-icon>arrow_back</mat-icon>
            Übungen
          </a>
          <h1>{{ name }}</h1>
          <mat-chip-set aria-label="Schwierigkeitsgrad">
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
          <p class="summary">{{ summary }}</p>
        </header>

        <mat-card class="detail-card">
          <mat-card-content>
            <h2 i18n="@@wiki.pushupTypes.instructionsTitle">Ausführung</h2>
            <ol class="instructions">
              @for (step of instructions; track $index) {
                <li>{{ step }}</li>
              }
            </ol>
            @if (tips.length > 0) {
              <h2 i18n="@@wiki.pushupTypes.tipsTitle">Tipps</h2>
              <ul class="tips">
                @for (tip of tips; track $index) {
                  <li>{{ tip }}</li>
                }
              </ul>
            }
          </mat-card-content>
        </mat-card>

        @if (article) {
          <section class="detail-article" [innerHTML]="article"></section>
        }

        <footer class="detail-footer">
          <a
            mat-stroked-button
            routerLink="/wiki/uebungen"
            i18n="@@wiki.exercise.detail.toList"
            >Alle Übungen</a
          >
          @if (workoutReady) {
            <a
              mat-stroked-button
              data-testid="wiki-exercise-new-session"
              routerLink="/workouts/new"
              [queryParams]="{ exercise: entry.id }"
            >
              <mat-icon>playlist_add</mat-icon>
              <span i18n="@@wiki.exercise.newSession">Als Session anlegen</span>
            </a>
          }
          <a
            mat-flat-button
            color="primary"
            routerLink="/training-plans"
            i18n="@@wiki.exercise.detail.cta"
            >Zu den Trainingsplänen</a
          >
        </footer>
      </article>
    }
  `,
  styleUrl: './exercise-detail.component.css',
})
export class ExerciseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly destroyRef = inject(DestroyRef);
  private readonly findEntryBySlug = inject(EXERCISE_WIKI_ENTRY_LOOKUP);
  private readonly localizeEntry = inject(EXERCISE_WIKI_LOCALIZER);

  entry: ExerciseWikiEntry | null = null;
  name = '';
  summary = '';
  instructions: ReadonlyArray<string> = [];
  tips: ReadonlyArray<string> = [];
  /** Long-form body for the active locale; `null` keeps the page noindexed. */
  article: string | null = null;
  workoutReady = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.removeJsonLd());
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    const found = (slug && this.findEntryBySlug(slug)) ?? null;
    if (!found) {
      void this.router.navigateByUrl('/wiki/uebungen');
      return;
    }

    const localized = this.localizeEntry(found, this.locale);
    if (!localized) {
      void this.router.navigateByUrl('/wiki/uebungen');
      return;
    }

    this.entry = found;
    this.name = localized.name;
    this.summary = localized.summary;
    this.instructions = localized.instructions;
    this.tips = localized.tips;
    this.article = localized.article ?? null;
    this.workoutReady = isWorkoutExercise(found.id);

    const titleSuffix = $localize`:@@seo.wiki.exercise.titleSuffix:Anleitung & Technik | ${BRAND_NAME}:brand:`;
    const seoTitle = `${this.name} – ${titleSuffix}`;

    // Indexability follows the content: entries that carry a long-form
    // body are indexed, frontmatter-only ones stay `noindex` because
    // ~60-100 words read as thin content and once cost the site an
    // AdSense review. `generate-sitemap.js` applies the same rule, so
    // the sitemap and the robots tag can never disagree.
    this.seo.update(seoTitle, this.summary, `/wiki/uebungen/${found.slug}`, {
      noindex: !this.article,
    });
    this.injectJsonLd(found);
  }

  private injectJsonLd(entry: ExerciseWikiEntry): void {
    const head = this.document.head;
    if (!head) return;

    this.removeJsonLd();

    const lang = this.locale.toLowerCase().split(/[-_]/)[0];
    const canonical = `${BRAND_URL}/${lang}/wiki/uebungen/${entry.slug}`;
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: this.name,
      description: this.summary,
      inLanguage: lang,
      step: this.instructions.map((step, idx) => ({
        '@type': 'HowToStep',
        position: idx + 1,
        text: step,
      })),
      url: canonical,
      mainEntityOfPage: canonical,
      publisher: {
        '@type': 'Organization',
        name: BRAND_NAME,
        url: BRAND_URL,
        logo: {
          '@type': 'ImageObject',
          url: BRAND_LOGO_URL,
        },
      },
    };

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-exercise-ld', '1');
    script.textContent = JSON.stringify(jsonLd);
    head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.document.head?.querySelector('script[data-exercise-ld]')?.remove();
  }
}
