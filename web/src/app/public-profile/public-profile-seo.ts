import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { ActivatedRoute } from '@angular/router';
import { type PublicProfile } from '@pu-stats/models';

import { buildProfileShareUrl } from '../core/profile-share-url';
import { SeoService } from '../core/seo.service';
import { ShareService } from '../core/share.service';

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

/**
 * Share sheet and page metadata for a public profile.
 *
 * Split out of the page component, which had grown past what one class
 * should own. Both concerns turn the same projection into text for
 * somewhere other than the page itself — and both have to respect the
 * owner's visibility switches, which is easier to keep true in one place.
 */
@Injectable()
export class PublicProfileSeo {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly shareService = inject(ShareService);
  private readonly firebaseApp = inject(FirebaseApp);
  private readonly localeId = inject(LOCALE_ID) as string;

  share(profile: PublicProfile | null): void {
    if (!profile) return;
    // `total` is null when the owner switched that element off. The
    // share text is as public as the profile, so it must not print the
    // number — and interpolating null would literally read "null".
    const text =
      profile.total === null
        ? $localize`:@@publicProfile.share.textPlain:${profile.displayName}:name: trackt auf Pushup Tracker 💪 Schau's dir an:`
        : $localize`:@@publicProfile.share.text:${profile.displayName}:name: hat ${profile.total}:total: Liegestütze auf Pushup Tracker geschafft 💪 Schau's dir an:`;
    void this.shareService.share({
      title: $localize`:@@publicProfile.share.title:Pushup Tracker Profil`,
      text,
      // Locale-prefixed canonical share URL — see `buildProfileShareUrl`
      // for the rationale (locale-prefixed link survives 30x-stripping
      // tools and lands on the right Angular bundle directly).
      url: buildProfileShareUrl(profile.uid, this.localeId),
    });
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

  apply(profile: PublicProfile | null): void {
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
    // Every number here can be switched off by the owner. Falling back to
    // a plain title beats printing "null" — or worse, "0", which would
    // read as a real result the profile never claimed.
    const hasStats =
      profile.total !== null &&
      profile.currentStreak !== null &&
      profile.totalDays !== null;
    this.seo.update(
      hasStats
        ? $localize`:@@publicProfile.seo.title:${profile.displayName}:name: – ${profile.total}:total: Liegestütze · Streak ${profile.currentStreak}:streak: · Pushup Tracker`
        : $localize`:@@publicProfile.seo.titlePlain:${profile.displayName}:name: · Pushup Tracker`,
      hasStats
        ? $localize`:@@publicProfile.seo.description:${profile.displayName}:name: hat ${profile.total}:total: Liegestütze in ${profile.totalDays}:days: aktiven Tagen geschafft – aktuelle Streak: ${profile.currentStreak}:streak: Tage. Tracke selbst kostenlos auf pushup-stats.com.`
        : $localize`:@@publicProfile.seo.descriptionPlain:${profile.displayName}:name: auf Pushup Tracker. Tracke selbst kostenlos auf pushup-stats.com.`,
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
