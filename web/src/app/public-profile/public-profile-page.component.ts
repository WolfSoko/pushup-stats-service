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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  resolveAchievementBadges,
  type AchievementBadge,
} from './achievement-badge';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import { formatExerciseTotal } from './exercise-total.format';
import { PublicProfileApiService } from '@pu-stats/data-access';
import { type ProfileSection, type PublicProfile } from '@pu-stats/models';
import { PublicProfileSeo } from './public-profile-seo';
import {
  buildExerciseRows,
  buildHeatmapRows,
  type ExerciseRow,
  type HeatmapRow,
} from './profile-view.model';
import { withSectionVisible } from './profile-visibility';
import { PROFILE_LABELS, WEEKDAY_LABELS } from './profile-labels';
import { UserConfigStore } from '../core/user-config.store';
import { ProfilePhotoService } from '../core/profile-photo.service';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; profile: PublicProfile }
  | { kind: 'not-found' }
  | { kind: 'error' };

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
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PublicProfileSeo],
  templateUrl: './public-profile-page.component.html',
  styleUrl: './public-profile-page.component.scss',
})
export class PublicProfilePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicProfileApiService);
  private readonly seo = inject(PublicProfileSeo);
  private readonly destroyRef = inject(DestroyRef);
  private readonly firebaseApp = inject(FirebaseApp);
  private readonly localeId = inject(LOCALE_ID) as string;
  private readonly configStore = inject(UserConfigStore);
  protected readonly photos = inject(ProfilePhotoService);

  protected readonly labels = PROFILE_LABELS;

  protected readonly state = signal<LoadState>({ kind: 'loading' });
  /** Google photo URLs can 404 or be blocked; fall back to the icon. */
  protected readonly photoFailed = signal(false);
  protected readonly profile = computed(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.profile : null;
  });

  protected readonly isOwner = computed(
    () => this.profile()?.viewerIsOwner === true
  );

  /**
   * Local mirror of the opt-out list so a switch flips immediately
   * instead of waiting for the round trip through Firestore and back.
   * Seeded from the server, and the server stays the authority.
   */
  private readonly hiddenOverride = signal<ProfileSection[] | null>(null);

  protected readonly hidden = computed<ReadonlyArray<ProfileSection>>(
    () => this.hiddenOverride() ?? this.profile()?.hidden ?? []
  );

  /** Shows the page exactly as a visitor would get it. */
  protected readonly previewAsVisitor = signal(false);

  /**
   * The switches are only offered while the owner is *not* previewing —
   * a control panel on top of "this is what visitors see" would make the
   * preview a lie.
   */
  protected readonly showControls = computed(
    () => this.isOwner() && !this.previewAsVisitor()
  );

  /**
   * Offering the preview before the profile is public would promise a
   * visitor view that no visitor can reach.
   */
  protected readonly canPreview = computed(
    () => this.isOwner() && this.profile()?.isPrivate === false
  );

  protected isVisible(section: ProfileSection): boolean {
    return !this.hidden().includes(section);
  }

  /**
   * What actually renders.
   *
   * While the switches are on screen every element stays put, even an
   * empty or hidden one — a switch you cannot see is a switch you cannot
   * turn back on. Otherwise it is the plain visitor rule: visible and
   * with something to say.
   */
  protected renders(section: ProfileSection, hasContent: boolean): boolean {
    return this.showControls() || (this.isVisible(section) && hasContent);
  }

  protected async toggleSection(
    section: ProfileSection,
    visible: boolean
  ): Promise<void> {
    const next = withSectionVisible(this.hidden(), section, visible);
    this.hiddenOverride.set(next);
    const ui = this.configStore.config()?.ui ?? {};
    // Spread the stored map rather than writing `{ profileHidden }` alone:
    // whether a partial nested write keeps its siblings is exactly the
    // question `docs/gotchas/firestore.md` says was never settled, and
    // losing `publicProfile` here would silently unpublish the profile.
    await this.configStore.save({ ui: { ...ui, profileHidden: next } });
  }

  protected readonly heatmapRows = computed<ReadonlyArray<HeatmapRow>>(() =>
    buildHeatmapRows(this.profile()?.heatmap ?? {}, WEEKDAY_LABELS)
  );

  protected readonly exerciseRows = computed<ReadonlyArray<ExerciseRow>>(() =>
    buildExerciseRows(
      this.profile()?.exercises ?? [],
      (entry) => exerciseDisplayName(entry.exerciseId),
      (entry) =>
        formatExerciseTotal(entry.total, entry.measurement, this.localeId)
    )
  );

  protected badgesFor(profile: PublicProfile): ReadonlyArray<AchievementBadge> {
    return resolveAchievementBadges(profile.achievements ?? []);
  }

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
          this.seo.apply(null);
          return;
        }
        void this.load(uid);
      });
  }

  protected async onPhotoPicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset first so picking the same file twice fires `change` again.
    input.value = '';
    if (!file) return;
    const result = await this.photos.upload(file);
    if (result.ok) {
      this.photoFailed.set(false);
      this.reload();
    }
  }

  protected reload(): void {
    const uid = this.route.snapshot.paramMap.get('uid')?.trim();
    if (uid) void this.load(uid);
  }

  protected shareProfile(): void {
    this.seo.share(this.profile());
  }

  private async load(uid: string): Promise<void> {
    const version = ++this.loadVersion;
    this.state.set({ kind: 'loading' });
    try {
      const profile = await this.api.getProfile(uid);
      if (version !== this.loadVersion) return;
      if (!profile) {
        this.state.set({ kind: 'not-found' });
        this.seo.apply(null);
        return;
      }
      // Drop the local mirror: the server is the authority again, and a
      // stale override would survive a reload after a failed save.
      this.hiddenOverride.set(null);
      this.state.set({ kind: 'ready', profile });
      this.seo.apply(profile);
    } catch {
      if (version !== this.loadVersion) return;
      this.state.set({ kind: 'error' });
      this.seo.apply(null);
    }
  }
}
