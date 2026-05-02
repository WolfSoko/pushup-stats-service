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
  protected readonly profile = computed(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.profile : null;
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
