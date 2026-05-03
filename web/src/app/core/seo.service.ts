import { DOCUMENT } from '@angular/common';
import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../../server-locale-redirect';

const BASE_URL = 'https://pushup-stats.com';
// Single source of truth lives in `server-locale-redirect.ts`; a
// type alias keeps this file's existing references compact.
const LOCALE_PREFIXES = SUPPORTED_LOCALES;
type LocalePrefix = SupportedLocale;
const DEFAULT_LOCALE: LocalePrefix = 'de';

function isKnownLocale(value: string): value is LocalePrefix {
  return (LOCALE_PREFIXES as readonly string[]).includes(value);
}

function toIsoDateTime(value: string | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);

  update(
    seoTitle: string,
    seoDescription: string,
    path: string,
    options: {
      imageUrl?: string;
      imageAlt?: string;
      publishedTime?: string;
      modifiedTime?: string;
      /**
       * Per-locale path overrides for hreflang alternates. Required
       * for routes whose slug differs by locale (e.g. blog posts with
       * `translationSlug`). When omitted, the route is assumed to be
       * locale-agnostic and the same path is advertised for every
       * supported locale. Locales not present in the map are skipped
       * so we never claim alternates for content that doesn't resolve
       * (e.g. a German blog slug under `/fr/blog/…`).
       */
      alternates?: Partial<Record<LocalePrefix, string>>;
    } = {}
  ): void {
    this.title.setTitle(seoTitle);

    this.setTag('name', 'description', seoDescription);
    this.setTag('property', 'og:title', seoTitle);
    this.setTag('property', 'og:description', seoDescription);
    this.setTag('property', 'og:type', 'website');
    this.setTag('name', 'twitter:card', 'summary_large_image');
    this.setTag('name', 'twitter:title', seoTitle);
    this.setTag('name', 'twitter:description', seoDescription);

    const locale = this.detectLocale(path);
    this.setTag('property', 'og:locale', this.ogLocaleFor(locale));

    const strippedPath = this.stripLocalePrefix(path);
    const url = (lang: LocalePrefix, p: string): string =>
      `${BASE_URL}/${lang}${p.startsWith('/') ? p : `/${p}`}`;

    // Resolve the per-locale path map. Without overrides we treat the
    // current path as locale-agnostic and advertise it for every
    // supported locale. With overrides, only the locales the caller
    // actually has translations for show up — see Copilot review on
    // blog posts where `/de/blog/<de-slug>` ≠ `/en/blog/<en-slug>`.
    const localePaths: Partial<Record<LocalePrefix, string>> =
      options.alternates ??
      Object.fromEntries(LOCALE_PREFIXES.map((lang) => [lang, strippedPath]));

    // Canonical resolution: when the active locale is one we have an
    // alternate path for, the canonical points there. Otherwise we
    // fall back to the source locale so phantom URLs (e.g.
    // `/fr/blog/<de-slug>` when fr/es/it/nl/el/la builds reuse the
    // German blog data) deduplicate to the post's real language URL
    // and match the JSON-LD canonical emitted by callers.
    const canonicalLocale =
      localePaths[locale] !== undefined ? locale : DEFAULT_LOCALE;
    const canonical = url(
      canonicalLocale,
      localePaths[canonicalLocale] ?? strippedPath
    );

    this.setTag('property', 'og:url', canonical);
    this.setCanonical(canonical);

    this.clearStaleHreflang();
    for (const lang of LOCALE_PREFIXES) {
      const altPath = localePaths[lang];
      if (altPath != null)
        this.setHreflang('alternate', lang, url(lang, altPath));
    }
    const xDefaultPath = localePaths[DEFAULT_LOCALE] ?? localePaths[locale];
    if (xDefaultPath != null) {
      this.setHreflang(
        'alternate',
        'x-default',
        url(DEFAULT_LOCALE, xDefaultPath)
      );
    }

    this.applyImage(options.imageUrl, options.imageAlt ?? seoTitle);
    this.applyArticleTimes(options.publishedTime, options.modifiedTime);
  }

  private applyImage(imageUrl: string | undefined, alt: string): void {
    if (imageUrl) {
      this.setTag('property', 'og:image', imageUrl);
      this.setTag('property', 'og:image:alt', alt);
      this.setTag('name', 'twitter:image', imageUrl);
      this.setTag('name', 'twitter:image:alt', alt);
    } else {
      this.removeTag('property', 'og:image');
      this.removeTag('property', 'og:image:alt');
      this.removeTag('name', 'twitter:image');
      this.removeTag('name', 'twitter:image:alt');
    }
  }

  private applyArticleTimes(
    publishedTime: string | undefined,
    modifiedTime: string | undefined
  ): void {
    const published = toIsoDateTime(publishedTime);
    const modified = toIsoDateTime(modifiedTime);
    if (published) {
      this.setTag('property', 'article:published_time', published);
    } else {
      this.removeTag('property', 'article:published_time');
    }
    if (modified) {
      this.setTag('property', 'article:modified_time', modified);
    } else {
      this.removeTag('property', 'article:modified_time');
    }
  }

  /**
   * Map a locale code to its OpenGraph locale value. OpenGraph uses the
   * underscore-separated `ll_CC` form (language + region, e.g. `en_US`)
   * rather than BCP 47's hyphenated tags. For languages without a clear
   * region we fall back to the bare two-letter language code.
   */
  private ogLocaleFor(locale: LocalePrefix): string {
    const map: Record<LocalePrefix, string> = {
      de: 'de_DE',
      en: 'en_US',
      fr: 'fr_FR',
      es: 'es_ES',
      it: 'it_IT',
      nl: 'nl_NL',
      el: 'el_GR',
      la: 'la',
      no: 'no_NO',
    };
    return map[locale];
  }

  private detectLocale(path: string): LocalePrefix {
    const lang = this.localeId?.split('-')[0]?.split('_')[0] ?? '';
    if (isKnownLocale(lang)) return lang;
    const segment = path.split('/')[1] ?? '';
    return isKnownLocale(segment) ? segment : DEFAULT_LOCALE;
  }

  private stripLocalePrefix(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path || ''}`;
    const segment = normalized.split('/')[1] ?? '';
    if (isKnownLocale(segment)) {
      const rest = normalized.slice(segment.length + 1);
      return rest || '/';
    }
    return normalized || '/';
  }

  private setTag(
    kind: 'name' | 'property',
    key: string,
    content: string
  ): void {
    this.meta.updateTag({ [kind]: key, content });
  }

  private removeTag(kind: 'name' | 'property', key: string): void {
    this.meta.removeTag(`${kind}='${key}'`);
  }

  private setCanonical(url: string): void {
    const head = this.document.head;
    if (!head) return;

    let link = head.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      head.appendChild(link);
    }
    link.href = url;
  }

  /**
   * Remove any pre-existing `<link rel="alternate" hreflang="…">`
   * tags. Re-emitted on every `update()` so that navigating between
   * routes with different alternate sets (e.g. a fully-localised
   * route to a blog post that only exists in two languages) doesn't
   * leave stale alternates behind from the previous page.
   */
  private clearStaleHreflang(): void {
    const head = this.document.head;
    if (!head) return;
    head
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .forEach((node) => node.remove());
  }

  private setHreflang(rel: string, hreflang: string, href: string): void {
    const head = this.document.head;
    if (!head) return;

    let link = head.querySelector(
      `link[rel="${rel}"][hreflang="${hreflang}"]`
    ) as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.rel = rel;
      link.setAttribute('hreflang', hreflang);
      head.appendChild(link);
    }
    link.href = href;
  }
}
