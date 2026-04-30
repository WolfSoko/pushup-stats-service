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

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const uid = (params.get('uid') ?? '').trim();
        if (!uid) {
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
    this.state.set({ kind: 'loading' });
    try {
      const profile = await this.api.getProfile(uid);
      if (!profile) {
        this.state.set({ kind: 'not-found' });
        this.applySeo(null);
        return;
      }
      this.state.set({ kind: 'ready', profile });
      this.applySeo(profile);
    } catch {
      this.state.set({ kind: 'error' });
      this.applySeo(null);
    }
  }

  private applySeo(profile: PublicProfile | null): void {
    if (!profile) {
      this.seo.update(
        $localize`:@@publicProfile.seo.notFound.title:Profil nicht verfügbar – Pushup Tracker`,
        $localize`:@@publicProfile.seo.notFound.description:Dieses Profil existiert nicht oder ist nicht öffentlich.`,
        '/u/'
      );
      return;
    }
    this.seo.update(
      $localize`:@@publicProfile.seo.title:${profile.displayName}:name: – Pushup Tracker Profil`,
      $localize`:@@publicProfile.seo.description:${profile.displayName}:name: hat ${profile.total}:total: Liegestütze und eine ${profile.currentStreak}:streak:-Tage-Streak auf Pushup Tracker.`,
      `/u/${profile.uid}`
    );
  }
}
