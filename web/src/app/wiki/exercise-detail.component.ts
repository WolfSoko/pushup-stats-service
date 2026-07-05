import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  LOCALE_ID,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  type ExerciseWikiEntry,
  findExerciseWikiEntryBySlug,
  localizeExerciseWiki,
} from '@pu-stats/models';
import { SeoService } from '../core/seo.service';

const BASE_URL = 'https://pushup-stats.com';
const LOGO_URL = `${BASE_URL}/assets/pushup-logo.png`;

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

        <footer class="detail-footer">
          <a
            mat-stroked-button
            routerLink="/wiki/uebungen"
            i18n="@@wiki.exercise.detail.toList"
            >Alle Übungen</a
          >
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
  styles: [
    `
      :host {
        display: block;
      }
      .detail-page {
        max-width: 760px;
        margin: 0 auto;
        padding: clamp(20px, 4vw, 44px);
      }
      .detail-header {
        margin-bottom: 24px;
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 0 0 16px -8px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9rem;
      }
      h1 {
        margin: 4px 0 12px;
        font-size: clamp(1.6rem, 4vw, 2.4rem);
        line-height: 1.2;
      }
      .summary {
        margin: 16px 0 0;
        font-size: 1.05rem;
        line-height: 1.6;
        color: var(--mat-sys-on-surface-variant);
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
      .detail-card {
        padding: 8px 4px;
      }
      .detail-card h2 {
        margin: 20px 0 6px;
        font-size: 0.95rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .detail-card h2:first-child {
        margin-top: 4px;
      }
      .instructions,
      .tips {
        padding-left: 22px;
        line-height: 1.65;
        margin: 4px 0 16px;
      }
      .instructions li,
      .tips li {
        margin-bottom: 8px;
      }
      .instructions li:last-child,
      .tips li:last-child {
        margin-bottom: 0;
      }
      .detail-footer {
        margin-top: 32px;
        padding-top: 20px;
        border-top: 1px solid var(--mat-sys-outline-variant);
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
    `,
  ],
})
export class ExerciseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly destroyRef = inject(DestroyRef);

  entry: ExerciseWikiEntry | null = null;
  name = '';
  summary = '';
  instructions: ReadonlyArray<string> = [];
  tips: ReadonlyArray<string> = [];

  constructor() {
    this.destroyRef.onDestroy(() => this.removeJsonLd());
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    const found = (slug && findExerciseWikiEntryBySlug(slug)) ?? null;
    if (!found) {
      this.router.navigateByUrl('/wiki/uebungen');
      return;
    }

    const localized = localizeExerciseWiki(found, this.locale);
    if (!localized) {
      this.router.navigateByUrl('/wiki/uebungen');
      return;
    }

    this.entry = found;
    this.name = localized.name;
    this.summary = localized.summary;
    this.instructions = localized.instructions;
    this.tips = localized.tips;

    const titleSuffix = $localize`:@@seo.wiki.exercise.titleSuffix:Anleitung & Technik | Pushup Tracker`;
    const seoTitle = `${this.name} – ${titleSuffix}`;

    // noindex until the wiki entries carry substantial unique content —
    // same rationale as pushup-type-detail (thin content, AdSense).
    this.seo.update(seoTitle, this.summary, `/wiki/uebungen/${found.slug}`, {
      noindex: true,
    });
    this.injectJsonLd(found);
  }

  private injectJsonLd(entry: ExerciseWikiEntry): void {
    const head = this.document.head;
    if (!head) return;

    this.removeJsonLd();

    const lang = this.locale.toLowerCase().split(/[-_]/)[0];
    const canonical = `${BASE_URL}/${lang}/wiki/uebungen/${entry.slug}`;
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
        name: 'Pushup Tracker',
        url: BASE_URL,
        logo: {
          '@type': 'ImageObject',
          url: LOGO_URL,
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
