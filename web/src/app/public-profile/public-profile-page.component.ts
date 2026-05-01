import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
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

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; profile: PublicProfile }
  | { kind: 'not-found' }
  | { kind: 'error' };

const SHARE_URL_BASE = 'https://pushup-stats.de';

/**
 * Public URL of the dynamic OG image function. We do NOT branch by env
 * here on purpose — staging/dev have a small audience and social cards are
 * a production-shipping concern; falling back to the default static
 * og:image (set by `index.html`) on staging is acceptable.
 *
 * The function lives behind the legacy `cloudfunctions.net` alias rather
 * than the `*.run.app` URL so the URL stays stable across redeploys.
 */
const OG_IMAGE_BASE =
  'https://europe-west3-pushup-stats.cloudfunctions.net/ogProfile';

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
  protected readonly ctaLabel = $localize`:@@publicProfile.cta:Selbst tracken – pushup-stats.de`;

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
      url: `${SHARE_URL_BASE}/u/${profile.uid}`,
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
    return uid ? `/u/${uid}` : '/u/';
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
    this.seo.update(
      $localize`:@@publicProfile.seo.title:${profile.displayName}:name: – Pushup Tracker Profil`,
      $localize`:@@publicProfile.seo.description:${profile.displayName}:name: hat ${profile.total}:total: Liegestütze und eine ${profile.currentStreak}:streak:-Tage-Streak auf Pushup Tracker.`,
      `/u/${profile.uid}`,
      {
        // Per-user dynamic OG card (1200×630 PNG rendered by satori + resvg
        // in the `ogProfile` Cloud Function). Crawlers fetch this directly,
        // so the full absolute URL is required.
        imageUrl: `${OG_IMAGE_BASE}?uid=${encodeURIComponent(profile.uid)}`,
        imageAlt: $localize`:@@publicProfile.seo.imageAlt:${profile.displayName}:name: auf Pushup Tracker`,
      }
    );
  }
}
