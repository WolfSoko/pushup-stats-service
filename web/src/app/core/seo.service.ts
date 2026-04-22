import { DOCUMENT } from '@angular/common';
import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const BASE_URL = 'https://pushup-stats.de';
const LOCALE_PREFIXES = ['de', 'en'] as const;
type LocalePrefix = (typeof LOCALE_PREFIXES)[number];
const DEFAULT_LOCALE: LocalePrefix = 'de';

function isKnownLocale(value: string): value is LocalePrefix {
  return (LOCALE_PREFIXES as readonly string[]).includes(value);
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly localeId = inject(LOCALE_ID);

  update(seoTitle: string, seoDescription: string, path: string): void {
    this.title.setTitle(seoTitle);

    this.setTag('name', 'description', seoDescription);
    this.setTag('property', 'og:title', seoTitle);
    this.setTag('property', 'og:description', seoDescription);
    this.setTag('property', 'og:type', 'website');
    this.setTag('name', 'twitter:card', 'summary_large_image');
    this.setTag('name', 'twitter:title', seoTitle);
    this.setTag('name', 'twitter:description', seoDescription);

    const locale = this.detectLocale(path);
    const ogLocale = locale === 'en' ? 'en_US' : 'de_DE';
    this.setTag('property', 'og:locale', ogLocale);

    const strippedPath = this.stripLocalePrefix(path);
    const deUrl = `${BASE_URL}/de${strippedPath}`;
    const enUrl = `${BASE_URL}/en${strippedPath}`;
    const canonical = locale === 'en' ? enUrl : deUrl;

    this.setTag('property', 'og:url', canonical);
    this.setCanonical(canonical);

    this.setHreflang('alternate', 'de', deUrl);
    this.setHreflang('alternate', 'en', enUrl);
    this.setHreflang('alternate', 'x-default', deUrl);
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
