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
        <div class="wiki-header-text">
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
                class="toc-link"
                href="#{{ type.slug }}"
                (click)="scrollTo($event, type.slug)"
                >{{ type.name }}</a
              >
              <span class="muted toc-summary"> — {{ type.summary }}</span>
            </li>
          }
        </ul>
      </nav>

      <div class="type-list">
        @for (type of types(); track type.id) {
          <section [id]="type.slug" class="type-section">
            <mat-card>
              <mat-card-header class="type-card-header">
                <mat-card-title>
                  <h2>{{ type.name }}</h2>
                </mat-card-title>
                <mat-card-subtitle>
                  <mat-chip-set>
                    @if (type.difficulty === 'beginner') {
                      <mat-chip
                        class="difficulty-chip beginner"
                        i18n="@@wiki.pushupTypes.level.beginner"
                        >Einsteiger</mat-chip
                      >
                    } @else if (type.difficulty === 'intermediate') {
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
                <a
                  mat-button
                  class="detail-link"
                  [routerLink]="['/wiki/liegestuetz-typen', type.slug]"
                  i18n="@@wiki.pushupTypes.viewDetail"
                  >Detailseite öffnen</a
                >
              </mat-card-content>
            </mat-card>
          </section>
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
        margin: 0 0 12px;
        font-size: 1.05rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mat-sys-on-surface-variant);
      }
      .toc ul {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 8px;
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
        font-size: 0.92rem;
      }
      .type-list {
        display: grid;
        gap: 24px;
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
      .type-section h2 {
        margin: 0;
        font-size: 1.4rem;
      }
      .type-section h3 {
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
export class PushupTypesPageComponent {
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly route = inject(ActivatedRoute);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

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
    // try to scroll. Re-fires when `?type=` changes, covering in-place
    // navigations that don't recreate the component.
    afterRenderEffect(() => {
      const slug = this.queryParams().get('type');
      if (slug) {
        this.scrollToSection(slug);
      }
    });
  }

  scrollTo(event: Event, slug: string): void {
    event.preventDefault();
    this.scrollToSection(slug);
    if (this.isBrowser && history.replaceState) {
      // Preserve the full path; passing just `#slug` would work but
      // composing `pathname + #slug` makes intent explicit.
      history.replaceState(null, '', `${location.pathname}#${slug}`);
    }
  }

  /**
   * `Element.scrollIntoView` walks up every scrollable ancestor and
   * scrolls them as needed. Using it instead of `ViewportScroller` is
   * essential here because the app shell wraps content in a
   * `<mat-sidenav-content>` that owns its own scroll container —
   * `ViewportScroller` only scrolls `window` and would silently no-op.
   *
   * Use `getElementById` (not `querySelector`) so an unexpected
   * `?type=` value containing CSS special characters can't throw a
   * `DOMException` and break the page. Containment check guards
   * against IDs from outside this component (defensive, since the
   * catalog slugs are static).
   */
  private scrollToSection(slug: string): void {
    if (!this.isBrowser) return;
    const target = document.getElementById(slug);
    if (target && this.host.nativeElement.contains(target)) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
