import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import {
  nextSectionVisibility,
  withSectionVisibility,
  type ProfileSection,
  type ProfileSectionVisibility,
  type PublicProfile,
} from '@pu-stats/models';
import { PublicProfileSeo } from './public-profile-seo';
import {
  buildExerciseGroups,
  buildHeatmapRows,
  type ExerciseGroup,
  type HeatmapRow,
} from './profile-view.model';
import {
  EXERCISE_GROUP_LABELS,
  PROFILE_LABELS,
  WEEKDAY_LABELS,
} from './profile-labels';
import { UserConfigStore } from '../core/user-config.store';
import { ProfilePhotoService } from '../core/profile-photo.service';
import { InviteBannerComponent } from '../core/invite-banner.component';
import { InviteService } from '../core/invite.service';
import { FriendsStore } from '../friends/friends.store';

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
    InviteBannerComponent,
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

  /**
   * Resolved lazily: `InviteService` reaches the auth stack for the user's
   * own uid, and this route also renders for anonymous visitors (and in
   * harnesses without Firebase Auth). The button it backs only exists for
   * the signed-in owner, where the providers are there.
   */
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  protected readonly isOwner = computed(
    () => this.profile()?.viewerIsOwner === true
  );

  /**
   * Local mirror of the per-section levels so a switch moves immediately
   * instead of waiting for the round trip through Firestore and back.
   * Seeded from the server, and the server stays the authority.
   */
  private readonly visibilityOverride = signal<Partial<
    Record<ProfileSection, ProfileSectionVisibility>
  > | null>(null);

  protected readonly visibility = computed<
    Partial<Record<ProfileSection, ProfileSectionVisibility>>
  >(() => this.visibilityOverride() ?? this.profile()?.visibility ?? {});

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

  /** Who may see this section. Defaults to friends-only, as the model does. */
  protected levelOf(section: ProfileSection): ProfileSectionVisibility {
    return this.visibility()[section] ?? 'friends';
  }

  protected isVisible(section: ProfileSection): boolean {
    return this.levelOf(section) !== 'off';
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

  protected visibilityIcon(section: ProfileSection): string {
    const level = this.levelOf(section);
    if (level === 'public') return 'public';
    return level === 'friends' ? 'group' : 'visibility_off';
  }

  protected visibilityLabel(section: ProfileSection): string {
    const level = this.levelOf(section);
    if (level === 'public') return this.labels.visibilityPublic;
    return level === 'friends'
      ? this.labels.visibilityFriends
      : this.labels.visibilityOff;
  }

  protected nextLabel(section: ProfileSection): string {
    const next = nextSectionVisibility(this.levelOf(section));
    if (next === 'public') return this.labels.visibilityNextPublic;
    return next === 'friends'
      ? this.labels.visibilityNextFriends
      : this.labels.visibilityNextOff;
  }

  /**
   * One tap moves a section to the next audience: public → friends → off →
   * public. A cycle rather than three controls keeps the switch where it
   * is — inline next to the value it governs — and the tooltip names both
   * the current state and what the next tap does.
   */
  protected async cycleSection(section: ProfileSection): Promise<void> {
    const next = nextSectionVisibility(this.levelOf(section));
    const levels = withSectionVisibility(this.visibility(), section, next);
    this.visibilityOverride.set(levels);
    const ui = this.configStore.config()?.ui ?? {};
    // Spread the stored map rather than writing `{ profileVisibility }`
    // alone: whether a partial nested write keeps its siblings is exactly
    // the question `docs/gotchas/firestore.md` says was never settled, and
    // losing `publicProfile` here would silently unpublish the profile.
    await this.configStore.save({
      ui: { ...ui, profileVisibility: levels },
    });
  }

  protected readonly heatmapRows = computed<ReadonlyArray<HeatmapRow>>(() =>
    buildHeatmapRows(this.profile()?.heatmap ?? {}, WEEKDAY_LABELS)
  );

  protected readonly exerciseGroups = computed<ReadonlyArray<ExerciseGroup>>(
    () =>
      buildExerciseGroups(
        this.profile()?.exercises ?? [],
        (entry) => exerciseDisplayName(entry.exerciseId),
        (entry) =>
          formatExerciseTotal(entry.total, entry.measurement, this.localeId),
        (kind) => EXERCISE_GROUP_LABELS[kind]
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

  /**
   * Offered to a signed-in visitor who is not already a friend. Anonymous
   * visitors get nothing to click — a request needs an account on both
   * ends.
   */
  /**
   * Offered to anyone looking at someone else's profile they are not
   * already friends with — signed in or not. Asking the auth stack here
   * would drag it into a route that renders for anonymous visitors; an
   * anonymous click is answered by the server and turned into a trip to
   * the signup page, which is the better flow anyway.
   */
  protected readonly canAddFriend = computed(
    () => !this.isOwner() && this.profile()?.viewerIsFriend !== true
  );

  protected readonly friendRequestSent = signal(false);

  protected async addFriend(): Promise<void> {
    const uid = this.profile()?.uid;
    if (!uid) return;
    const friends = this.injector.get(FriendsStore, null);
    if (!friends) return;
    const ok = await friends.requestFriend(uid);
    if (ok) {
      this.friendRequestSent.set(true);
      return;
    }
    if (friends.lastRejection() === 'unauthenticated') {
      void this.router.navigate(['/register'], {
        queryParams: { returnUrl: `/u/${uid}` },
      });
    }
  }

  protected inviteFriend(): void {
    void this.injector.get(InviteService, null)?.inviteFriend();
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
      this.visibilityOverride.set(null);
      this.state.set({ kind: 'ready', profile });
      this.seo.apply(profile);
    } catch {
      if (version !== this.loadVersion) return;
      this.state.set({ kind: 'error' });
      this.seo.apply(null);
    }
  }
}
