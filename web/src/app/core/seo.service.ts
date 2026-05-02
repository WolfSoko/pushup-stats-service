import { DOCUMENT } from '@angular/common';
import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const BASE_URL = 'https://pushup-stats.de';
// Keep in sync with `web/src/server-locale-redirect.ts` and the
// `i18n.locales` map in `web/project.json`. Each known locale gets a
// `<link rel="alternate" hreflang="…">` entry on every page.
const LOCALE_PREFIXES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'grc',
  'la',
] as const;
type LocalePrefix = (typeof LOCALE_PREFIXES)[number];
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
    const localeUrl = (lang: LocalePrefix): string =>
      `${BASE_URL}/${lang}${strippedPath}`;
    const canonical = localeUrl(locale);

    this.setTag('property', 'og:url', canonical);
    this.setCanonical(canonical);

    for (const lang of LOCALE_PREFIXES) {
      this.setHreflang('alternate', lang, localeUrl(lang));
    }
    this.setHreflang('alternate', 'x-default', localeUrl(DEFAULT_LOCALE));

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
   * Map a locale code to its OpenGraph BCP 47 form. OG only formally
   * supports `xx_YY` IETF tags, so we approximate for classical
   * languages by returning the bare two-letter code (no region).
   */
  private ogLocaleFor(locale: LocalePrefix): string {
    const map: Record<LocalePrefix, string> = {
      de: 'de_DE',
      en: 'en_US',
      fr: 'fr_FR',
      es: 'es_ES',
      it: 'it_IT',
      nl: 'nl_NL',
      grc: 'grc',
      la: 'la',
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
