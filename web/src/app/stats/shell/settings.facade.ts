import { isPlatformBrowser } from '@angular/common';
import { Analytics, logEvent } from '@angular/fire/analytics';
import {
  Injectable,
  LOCALE_ID,
  OnDestroy,
  PLATFORM_ID,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { PushSubscriptionService } from '@pu-push/push';
import {
  DEFAULT_SNAP_QUALITY,
  DisplayNameViolation,
  SnapQuality,
  validateDisplayName,
} from '@pu-stats/models';

import { buildProfileShareUrl } from '../../core/profile-share-url';
import { ShareService } from '../../core/share.service';
import { UserConfigStore } from '../../core/user-config.store';
import { TrainingPlanStore } from '../../training-plans/training-plan.store';
import { SettingsAutoSaveController } from './settings-autosave.controller';
import {
  eventValue,
  isAnalyticsConsentGranted,
  resolveConfig,
} from './settings-page.helpers';
import type { DraftSnapshot, ResolvedConfig } from './settings-page.models';

/**
 * Owns every settings draft plus the autosave lifecycle.
 *
 * Extracted from `SettingsPageComponent` because the section is being
 * split into routed child pages, and routed children cannot receive
 * inputs from a parent — they need a shared instance to inject. Provided
 * on the `settings` route so one facade spans the whole section and the
 * autosave debounce survives navigation between its tabs; leaving the
 * section destroys it and drains pending writes.
 *
 * Matches the repo rule that stores own state and components only bind.
 */
@Injectable()
export class SettingsFacade implements OnDestroy {
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly pushService = inject(PushSubscriptionService);
  private readonly userConfigStore = inject(UserConfigStore);
  private readonly shareService = inject(ShareService);
  private readonly localeId = inject(LOCALE_ID) as string;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly trainingPlans = inject(TrainingPlanStore);

  readonly isGuest = this.user.isGuest;
  readonly userId = this.user.userIdSafe;
  readonly planActive = this.trainingPlans.hasActivePlan;
  readonly activePlanSlug = computed(
    () => this.trainingPlans.activeCatalog()?.slug ?? ''
  );

  readonly displayNameDraft = signal('');
  readonly displayNameViolation = computed<DisplayNameViolation | null>(() =>
    validateDisplayName(this.displayNameDraft())
  );
  readonly leaderboardOptOutDraft = signal(false);
  readonly publicProfileDraft = signal(false);
  readonly adsConsentDraft = signal(false);
  readonly snapQualityDraft = signal<SnapQuality>(DEFAULT_SNAP_QUALITY);

  readonly profileUrl = computed(() =>
    buildProfileShareUrl(this.userId(), this.localeId)
  );

  readonly deletingAccount = signal(false);
  readonly deletePhraseInput = signal('');
  readonly deleteDialogError = signal('');

  private readonly deleteConfirmationPhrase = $localize`:@@settings.delete.confirmPlaceholder:löschen`;

  readonly config = computed<ResolvedConfig>(() =>
    resolveConfig(this.userConfigStore.config())
  );

  private readonly autoSave = new SettingsAutoSaveController({
    readDraft: () => this.draftSnapshot(),
    readConfig: () => this.config(),
    applyConfig: (cfg) => this.applyConfigToDrafts(cfg),
    save: (update) => this.userConfigStore.save(update),
    onSaved: (draft) => this.trackSaved(draft),
    isBrowser: isPlatformBrowser(this.platformId),
  });

  readonly saveStatus = this.autoSave.saveStatus;

  constructor() {
    // The realtime listener and the debounce timer both mutate `saveStatus`;
    // running the side-effect blocks in `untracked` keeps those writes from
    // looping the effects back on themselves.
    effect(() => {
      const cfg = this.config();
      if (!cfg) return;
      untracked(() => this.autoSave.hydrate(cfg));
    });

    effect(() => {
      const draft = this.draftSnapshot();
      const violation = this.displayNameViolation();
      untracked(() => this.autoSave.onDraftChange(draft, violation));
    });
  }

  ngOnDestroy(): void {
    this.autoSave.destroy();
  }

  shareMyProfile(): void {
    const url = this.profileUrl();
    if (!url) return;
    void this.shareService.share({
      title: $localize`:@@settings.publicProfile.share.title:Mein Pushup Tracker Profil`,
      text: $localize`:@@settings.publicProfile.share.text:Schau dir mein Pushup-Profil an:`,
      url,
    });
  }

  asValue(event: Event): string {
    return eventValue(event);
  }

  retrySave(): void {
    this.autoSave.retry();
  }

  openDeleteDialog(dialogTemplate: TemplateRef<unknown>): void {
    this.deletePhraseInput.set('');
    this.deleteDialogError.set('');
    this.dialog.open(dialogTemplate, {
      width: '520px',
      disableClose: true,
    });
  }

  async confirmDeleteFromDialog(): Promise<void> {
    if (
      this.deletePhraseInput().trim().toLowerCase() !==
      this.deleteConfirmationPhrase
    ) {
      this.deleteDialogError.set(
        $localize`:@@settings.delete.error:Bitte exakt „löschen“ eingeben.`
      );
      return;
    }

    this.dialog.closeAll();
    await this.autoSave.drain();

    this.deletingAccount.set(true);

    try {
      await this.userConfigStore.save({
        displayName: $localize`:@@settings.anonymizedName:Gelöschter Benutzer`,
        email: null,
        ui: {
          hideFromLeaderboard: true,
        },
      });
      await this.pushService.unsubscribe();
      await this.auth.deleteAccount();
      this.trackAnalytics('account_anonymized_and_deleted', { success: true });
      await this.router.navigateByUrl('/');
    } catch {
      this.autoSave.reportError();
    } finally {
      this.deletingAccount.set(false);
    }
  }

  private draftSnapshot(): DraftSnapshot {
    return {
      displayName: this.displayNameDraft().trim(),
      hideFromLeaderboard: this.leaderboardOptOutDraft(),
      publicProfile: this.publicProfileDraft(),
      adsConsent: this.adsConsentDraft(),
      snapQuality: this.snapQualityDraft(),
    };
  }

  private applyConfigToDrafts(cfg: ResolvedConfig): void {
    this.displayNameDraft.set(cfg.displayName);
    this.leaderboardOptOutDraft.set(cfg.hideFromLeaderboard);
    this.publicProfileDraft.set(cfg.publicProfile);
    this.adsConsentDraft.set(cfg.consent?.targetedAds ?? true);
    this.snapQualityDraft.set(cfg.snapQuality);
  }

  private trackSaved(draft: DraftSnapshot): void {
    this.trackAnalytics('settings_saved', {
      hideFromLeaderboard: draft.hideFromLeaderboard,
      publicProfile: draft.publicProfile,
      adsConsent: draft.adsConsent,
    });
  }

  private trackAnalytics(
    eventName: string,
    params: Record<string, string | number | boolean>
  ): void {
    if (!this.analytics || !isAnalyticsConsentGranted()) return;
    logEvent(this.analytics, eventName, params);
  }
}
