import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { WikiDifficultyChipsComponent } from './wiki-difficulty-chips.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  buildWikiCategories,
  type CategoryLabels,
  filterWikiCategories,
  matchesPushupHub,
  pushupTypeHits,
} from './exercises-page.search';

/**
 * Hub-card slug for the Liegestütz cross-link. Uses a reserved
 * `pushup-hub` form that no catalog exercise slug would ever take so
 * the TOC anchor can never collide with `EXERCISE_WIKI_CATALOG`
 * entries, current or future.
 */
const PUSHUP_HUB_SLUG = 'pushup-hub';

/**
 * `?suche` focuses the search field on arrival (the inbox message links
 * there); `?suche=kniebeuge` also prefills it.
 */
export const SEARCH_PARAM = 'suche';

@Component({
  selector: 'app-exercises-wiki-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    WikiDifficultyChipsComponent,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exercises-page.component.html',
  styleUrl: './exercises-page.component.css',
})
export class ExercisesWikiPageComponent {
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly route = inject(ActivatedRoute);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly pushupHubSlug = PUSHUP_HUB_SLUG;

  /**
   * Heading label for the dedicated Liegestütze category section.
   * Reuses the existing `@@exercise.category.pushup` id so the value
   * stays in sync with the same label used in the entry dialog and
   * the stats table — no separate translation needed.
   */
  readonly pushupCategoryLabel = $localize`:@@exercise.category.pushup:Liegestütze`;

  /** The whole localized catalog, grouped — built once per page. */
  private readonly allCategories = buildWikiCategories(
    this.locale,
    this.categoryLabels()
  );

  /** What the search field holds; blank shows everything. */
  readonly query = signal('');
  readonly searching = computed(() => this.query().trim() !== '');

  readonly categories = computed(() =>
    filterWikiCategories(this.query(), this.allCategories)
  );

  /** Pushup types live in their own wiki, but the search finds them too. */
  readonly pushupHits = computed(() =>
    pushupTypeHits(this.query(), this.locale)
  );

  private readonly pushupHubText = `${this.pushupCategoryLabel} ${$localize`:@@wiki.exercises.pushupHub.tocLink:Liegestütze (alle Varianten)`} pushup`;

  readonly showPushupHub = computed(
    () =>
      !this.searching() ||
      this.pushupHits().length > 0 ||
      matchesPushupHub(this.query(), this.pushupHubText)
  );

  readonly resultCount = computed(
    () =>
      this.categories().reduce((sum, g) => sum + g.entries.length, 0) +
      // The hub card is a result of its own when only its text matched.
      (this.showPushupHub() ? Math.max(1, this.pushupHits().length) : 0)
  );

  readonly nothingFound = computed(
    () =>
      this.searching() &&
      this.categories().length === 0 &&
      !this.showPushupHub()
  );

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  private readonly searchInput =
    viewChild<ElementRef<HTMLInputElement>>('searchInput');

  clearSearch(): void {
    this.query.set('');
  }

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  constructor() {
    const initialSearch = this.route.snapshot.queryParamMap.get(SEARCH_PARAM);
    if (initialSearch !== null) {
      this.query.set(initialSearch);
      afterNextRender(() => this.searchInput()?.nativeElement.focus());
    }
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
  private categoryLabels(): CategoryLabels {
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
