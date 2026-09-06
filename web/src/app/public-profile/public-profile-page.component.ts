import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  resolveAchievementBadges,
  type AchievementBadge,
} from './achievement-badge';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import { formatExerciseTotal } from './exercise-total.format';
import { PublicProfileApiService } from '@pu-stats/data-access';
import { type PublicProfile } from '@pu-stats/models';
import { ShareService } from '../core/share.service';
import { SeoService } from '../core/seo.service';
import { buildProfileShareUrl } from '../core/profile-share-url';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; profile: PublicProfile }
  | { kind: 'not-found' }
  | { kind: 'error' };

/**
 * Weekday keys as the stats trigger writes them (German abbreviations,
 * baked into the stored data). Mapped to localised labels here so an
 * English profile does not show "Mo, Di, Mi".
 */
const HEATMAP_WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

interface HeatmapCell {
  readonly hour: number;
  readonly intensity: number;
  readonly title: string;
}

interface HeatmapRow {
  readonly weekday: string;
  readonly cells: ReadonlyArray<HeatmapCell>;
}

interface ExerciseRow {
  readonly exerciseId: string;
  readonly name: string;
  readonly value: string;
  readonly percent: number;
}

const OG_FUNCTION_REGION = 'europe-west3';

/**
 * Builds the absolute OG-image URL for the active Firebase project.
 *
 * Derived from the active `FirebaseApp.options.projectId` so prod / staging
 * / preview deployments all point crawlers at their own `ogProfile` function
 * instead of leaking through to prod (which doesn't have staging users'
 * Firestore docs and would 404 every staging-shared link).
 *
 * Uses the legacy `cloudfunctions.net` alias rather than the `*.run.app`
 * URL so the value stays stable across redeploys.
 */
function buildOgImageUrl(
  projectId: string,
  encodedUid: string,
  lang: string
): string {
  return `https://${OG_FUNCTION_REGION}-${projectId}.cloudfunctions.net/ogProfile?uid=${encodedUid}&lang=${lang}`;
}

@Component({
  selector: 'app-public-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-profile-page.component.html',
  styleUrl: './public-profile-page.component.scss',
})
export class PublicProfilePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicProfileApiService);
  private readonly seo = inject(SeoService);
  private readonly shareService = inject(ShareService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly firebaseApp = inject(FirebaseApp);
  private readonly localeId = inject(LOCALE_ID) as string;

  protected readonly state = signal<LoadState>({ kind: 'loading' });
  /** Google photo URLs can 404 or be blocked; fall back to the icon. */
  protected readonly photoFailed = signal(false);
  protected readonly profile = computed(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.profile : null;
  });

  protected readonly privateTitle = $localize`:@@publicProfile.private.title:Dein Profil ist noch privat`;
  protected readonly privateBody = $localize`:@@publicProfile.private.body:Niemand außer dir kann es sehen. Schalte es in den Einstellungen frei, um es teilen zu können.`;
  protected readonly privateCta = $localize`:@@publicProfile.private.cta:Profil öffentlich machen`;

  protected readonly weekLabel = $localize`:@@publicProfile.week:Diese Woche`;
  protected readonly monthLabel = $localize`:@@publicProfile.month:Dieser Monat`;
  protected readonly exercisesLabel = $localize`:@@publicProfile.exercises:Übungen`;
  protected readonly heatmapLabel = $localize`:@@publicProfile.heatmap:Wann trainiert wird`;
  protected readonly heatmapAria = $localize`:@@publicProfile.heatmap.aria:Trainingsverteilung über Wochentage und Tageszeit`;
  protected readonly memberSinceLabel = $localize`:@@publicProfile.memberSince:Dabei seit`;

  private readonly weekdayLabels: Readonly<Record<string, string>> = {
    Mo: $localize`:@@weekday.short.mon:Mo`,
    Di: $localize`:@@weekday.short.tue:Di`,
    Mi: $localize`:@@weekday.short.wed:Mi`,
    Do: $localize`:@@weekday.short.thu:Do`,
    Fr: $localize`:@@weekday.short.fri:Fr`,
    Sa: $localize`:@@weekday.short.sat:Sa`,
    So: $localize`:@@weekday.short.sun:So`,
  };

  /**
   * Seven weekday rows × 24 hours. Empty when nothing was ever logged —
   * a grid of blank cells says less than no section at all.
   */
  protected readonly heatmapRows = computed<ReadonlyArray<HeatmapRow>>(() => {
    const map = this.profile()?.heatmap ?? {};
    const values = Object.values(map);
    const max = values.length > 0 ? Math.max(...values) : 0;
    if (max <= 0) return [];
    return HEATMAP_WEEKDAYS.map((day) => ({
      weekday: this.weekdayLabels[day],
      cells: Array.from({ length: 24 }, (_, hour) => {
        const reps = map[`${day}-${String(hour).padStart(2, '0')}`] ?? 0;
        return {
          hour,
          // Floor at a faint tint so the grid still reads as a grid;
          // a pure 0 would make empty hours invisible.
          intensity: reps > 0 ? 0.2 + 0.8 * (reps / max) : 0.06,
          title: `${this.weekdayLabels[day]} ${String(hour).padStart(2, '0')}:00`,
        };
      }),
    }));
  });

  /**
   * Exercises as labelled bars. The bar is relative to the biggest entry,
   * never a share of a total: the stored numbers mix reps, seconds and
   * metres, so a common denominator would be meaningless.
   */
  protected readonly exerciseRows = computed<ReadonlyArray<ExerciseRow>>(() => {
    const exercises = this.profile()?.exercises ?? [];
    if (exercises.length === 0) return [];
    const max = Math.max(...exercises.map((e) => e.total));
    return exercises.map((entry) => ({
      exerciseId: entry.exerciseId,
      name: exerciseDisplayName(entry.exerciseId),
      value: formatExerciseTotal(entry.total, entry.measurement, this.localeId),
      percent: max > 0 ? Math.round((entry.total / max) * 100) : 0,
    }));
  });

  protected readonly notFoundTitle = $localize`:@@publicProfile.notFound.title:Profil nicht gefunden`;
  protected readonly notFoundBody = $localize`:@@publicProfile.notFound.body:Dieses Profil existiert nicht oder wurde nicht öffentlich freigegeben.`;
  protected readonly errorTitle = $localize`:@@publicProfile.error.title:Profil konnte nicht geladen werden`;
  protected readonly errorBody = $localize`:@@publicProfile.error.body:Bitte versuche es später erneut.`;
  protected readonly retryLabel = $localize`:@@publicProfile.retry:Erneut versuchen`;
  protected readonly homeLabel = $localize`:@@publicProfile.toHome:Zur Startseite`;
  protected readonly statsLabel = $localize`:@@publicProfile.stats:Statistik`;
  protected readonly totalLabel = $localize`:@@publicProfile.total:Gesamte Reps`;
  protected readonly streakLabel = $localize`:@@publicProfile.streak:Aktuelle Streak`;
  protected readonly daysLabel = $localize`:@@publicProfile.days:Aktive Tage`;
  protected readonly entriesLabel = $localize`:@@publicProfile.entries:Einträge`;
  protected readonly bestSetLabel = $localize`:@@publicProfile.bestSet:Bester Einzel-Eintrag`;
  protected readonly bestDayLabel = $localize`:@@publicProfile.bestDay:Bester Tag`;
  protected readonly shareAriaLabel = $localize`:@@publicProfile.share.aria:Profil teilen`;
  protected readonly achievementsLabel = $localize`:@@publicProfile.achievements:Erfolge`;

  protected badgesFor(profile: PublicProfile): ReadonlyArray<AchievementBadge> {
    return resolveAchievementBadges(profile.achievements ?? []);
  }
  protected readonly shareLabel = $localize`:@@publicProfile.share:Teilen`;
  protected readonly ctaLabel = $localize`:@@publicProfile.cta:Selbst tracken – pushup-stats.com`;

  /**
   * Monotonic request token. Increments on every route emission AND every
   * `load()` start; only the most recent token is allowed to commit state /
   * SEO. Without this, navigating quickly between two `/u/:uid` pages can
   * let the slower request finish last and overwrite the newer profile.
   */
  private loadVersion = 0;

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const uid = (params.get('uid') ?? '').trim();
        if (!uid) {
          this.loadVersion++;
          this.state.set({ kind: 'not-found' });
          this.applySeo(null);
          return;
        }
        void this.load(uid);
      });
  }

  protected reload(): void {
    const uid = this.route.snapshot.paramMap.get('uid')?.trim();
    if (uid) void this.load(uid);
  }

  protected shareProfile(): void {
    const profile = this.profile();
    if (!profile) return;
    const text = $localize`:@@publicProfile.share.text:${profile.displayName}:name: hat ${profile.total}:total: Liegestütze auf Pushup Tracker geschafft 💪 Schau's dir an:`;
    void this.shareService.share({
      title: $localize`:@@publicProfile.share.title:Pushup Tracker Profil`,
      text,
      // Locale-prefixed canonical share URL — see `buildProfileShareUrl`
      // for the rationale (locale-prefixed link survives 30x-stripping
      // tools and lands on the right Angular bundle directly).
      url: buildProfileShareUrl(profile.uid, this.localeId),
    });
  }

  private async load(uid: string): Promise<void> {
    const version = ++this.loadVersion;
    this.state.set({ kind: 'loading' });
    try {
      const profile = await this.api.getProfile(uid);
      if (version !== this.loadVersion) return;
      if (!profile) {
        this.state.set({ kind: 'not-found' });
        this.applySeo(null);
        return;
      }
      this.state.set({ kind: 'ready', profile });
      this.applySeo(profile);
    } catch {
      if (version !== this.loadVersion) return;
      this.state.set({ kind: 'error' });
      this.applySeo(null);
    }
  }

  private currentPath(): string {
    const uid = this.route.snapshot.paramMap.get('uid')?.trim();
    return uid ? `/u/${encodeURIComponent(uid)}` : '/u/';
  }

  private localeShortCode(): string {
    // 'de-DE' / 'en-US' → 'de' / 'en'. Fallback to 'de' (source locale).
    const lang = this.localeId?.split('-')[0]?.toLowerCase();
    return lang === 'en' ? 'en' : 'de';
  }

  private applySeo(profile: PublicProfile | null): void {
    if (!profile) {
      // Use the actual requested path so canonical / og:url stay in sync
      // with the URL the visitor sees, even on the not-found state.
      this.seo.update(
        $localize`:@@publicProfile.seo.notFound.title:Profil nicht verfügbar – Pushup Tracker`,
        $localize`:@@publicProfile.seo.notFound.description:Dieses Profil existiert nicht oder ist nicht öffentlich.`,
        this.currentPath()
      );
      return;
    }
    const encodedUid = encodeURIComponent(profile.uid);
    const projectId =
      (this.firebaseApp.options as { projectId?: string }).projectId ??
      'pushup-stats';
    // Title and description are tuned for the OpenGraph "optimal" ranges
    // (title ~50-60 chars, description ~110-160 chars) so social cards
    // don't get truncated and search snippets show meaningful copy. Both
    // include the user's actual stats so the preview is informative even
    // before the visitor clicks through.
    this.seo.update(
      $localize`:@@publicProfile.seo.title:${profile.displayName}:name: – ${profile.total}:total: Liegestütze · Streak ${profile.currentStreak}:streak: · Pushup Tracker`,
      $localize`:@@publicProfile.seo.description:${profile.displayName}:name: hat ${profile.total}:total: Liegestütze in ${profile.totalDays}:days: aktiven Tagen geschafft – aktuelle Streak: ${profile.currentStreak}:streak: Tage. Tracke selbst kostenlos auf pushup-stats.com.`,
      `/u/${encodedUid}`,
      {
        // Per-user dynamic OG card (1200×630 PNG rendered by satori + resvg
        // in the `ogProfile` Cloud Function). Crawlers fetch this directly,
        // so the full absolute URL is required. URL is environment-correct:
        // `projectId` is read from `FirebaseApp.options` so prod / staging /
        // preview deployments each point at their own function instance.
        imageUrl: buildOgImageUrl(
          projectId,
          encodedUid,
          this.localeShortCode()
        ),
        imageAlt: $localize`:@@publicProfile.seo.imageAlt:${profile.displayName}:name: auf Pushup Tracker`,
      }
    );
  }
}
