import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import {
  localizePushupType,
  PUSHUP_TYPES,
  PushupTypeInfo,
} from '@pu-stats/models';

interface LocalizedType {
  id: PushupTypeInfo['id'];
  slug: string;
  difficulty: PushupTypeInfo['difficulty'];
  name: string;
  summary: string;
  instructions: ReadonlyArray<string>;
  tips: ReadonlyArray<string>;
}

@Component({
  selector: 'app-pushup-types-page',
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
          i18n-aria-label="@@wiki.pushupTypes.back"
        >
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div>
          <h1 i18n="@@wiki.pushupTypes.title">
            Liegestütztypen — saubere Ausführung
          </h1>
          <p class="muted" i18n="@@wiki.pushupTypes.intro">
            Kurzanleitungen für jede Liegestütz-Variante, die in den
            Trainingsplänen vorkommt. Die Tooltipps in den Plänen verlinken
            direkt auf den passenden Abschnitt.
          </p>
        </div>
      </header>

      <nav class="toc" aria-labelledby="wiki-toc-heading">
        <h2 id="wiki-toc-heading" i18n="@@wiki.pushupTypes.tocTitle">
          Übersicht
        </h2>
        <ul>
          @for (type of types(); track type.id) {
            <li>
              <a
                [href]="'#' + type.slug"
                (click)="scrollTo($event, type.slug)"
                >{{ type.name }}</a
              >
              <span class="muted"> — {{ type.summary }}</span>
            </li>
          }
        </ul>
      </nav>

      @for (type of types(); track type.id) {
        <section [id]="type.slug" class="type-section">
          <mat-card>
            <mat-card-header>
              <mat-card-title>
                <h2>{{ type.name }}</h2>
              </mat-card-title>
              <mat-card-subtitle>
                <mat-chip-set>
                  @if (type.difficulty === 'beginner') {
                    <mat-chip i18n="@@wiki.pushupTypes.level.beginner"
                      >Einsteiger</mat-chip
                    >
                  } @else if (type.difficulty === 'intermediate') {
                    <mat-chip i18n="@@wiki.pushupTypes.level.intermediate"
                      >Mittelstufe</mat-chip
                    >
                  } @else {
                    <mat-chip i18n="@@wiki.pushupTypes.level.advanced"
                      >Fortgeschritten</mat-chip
                    >
                  }
                </mat-chip-set>
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <p class="type-summary">{{ type.summary }}</p>
              <h3 i18n="@@wiki.pushupTypes.instructionsTitle">Ausführung</h3>
              <ol class="instructions">
                @for (step of type.instructions; track $index) {
                  <li>{{ step }}</li>
                }
              </ol>
              @if (type.tips.length > 0) {
                <h3 i18n="@@wiki.pushupTypes.tipsTitle">Tipps</h3>
                <ul class="tips">
                  @for (tip of type.tips; track $index) {
                    <li>{{ tip }}</li>
                  }
                </ul>
              }
            </mat-card-content>
          </mat-card>
        </section>
      }
    </main>
  `,
  styles: [
    `
      .wiki-page {
        max-width: 880px;
        margin: 0 auto;
        padding: 16px;
      }
      .wiki-header {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .wiki-header h1 {
        margin: 0 0 4px;
      }
      .muted {
        color: rgba(0, 0, 0, 0.6);
      }
      :host-context(.dark-theme) .muted {
        color: rgba(255, 255, 255, 0.6);
      }
      .toc {
        background: rgba(0, 0, 0, 0.04);
        padding: 16px 20px;
        border-radius: 8px;
        margin-bottom: 24px;
      }
      :host-context(.dark-theme) .toc {
        background: rgba(255, 255, 255, 0.04);
      }
      .toc h2 {
        margin: 0 0 8px;
        font-size: 1rem;
      }
      .toc ul {
        margin: 0;
        padding-left: 20px;
      }
      .toc li {
        margin-bottom: 4px;
      }
      .type-section {
        margin-bottom: 16px;
        scroll-margin-top: 16px;
      }
      .type-section h2 {
        margin: 0;
      }
      .type-section h3 {
        margin: 16px 0 4px;
        font-size: 1rem;
      }
      .type-summary {
        font-weight: 500;
      }
      .instructions,
      .tips {
        padding-left: 20px;
        line-height: 1.55;
      }
      .instructions li,
      .tips li {
        margin-bottom: 4px;
      }
    `,
  ],
})
export class PushupTypesPageComponent {
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly route = inject(ActivatedRoute);
  private readonly viewport = inject(ViewportScroller);

  readonly types = computed<ReadonlyArray<LocalizedType>>(() =>
    PUSHUP_TYPES.map((type) => ({
      id: type.id,
      slug: type.slug,
      difficulty: type.difficulty,
      ...localizePushupType(type, this.locale),
    }))
  );

  // Honour an incoming `?type=<slug>` query param so deep-links from
  // training-plan tooltips scroll to the relevant section after route
  // hydration. We use a query param (not a fragment) because Angular
  // SSR + prerender strips fragments before client hydration.
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  constructor() {
    // afterRenderEffect runs in the browser after each render, so the
    // target `<section id>` is guaranteed to be in the DOM before we
    // call `scrollToAnchor`. It also re-fires when `?type=` changes,
    // covering in-place navigations that don't recreate the component.
    afterRenderEffect(() => {
      const slug = this.queryParams().get('type');
      if (slug) {
        this.viewport.scrollToAnchor(slug);
      }
    });
  }

  scrollTo(event: Event, slug: string): void {
    event.preventDefault();
    this.viewport.scrollToAnchor(slug);
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', `#${slug}`);
    }
  }
}
