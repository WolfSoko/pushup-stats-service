import { DOCUMENT } from '@angular/common';
import { inject, Injectable, LOCALE_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const BASE_URL = 'https://pushup-stats.de';
const LOCALE_PREFIXES = ['de', 'en'];

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

    const origin = this.document.location?.origin ?? '';
    const canonical = `${origin}${path}`;
    this.setTag('property', 'og:url', canonical);
    this.setCanonical(canonical);

    const locale = this.detectLocale(path);
    const ogLocale = locale === 'en' ? 'en_US' : 'de_DE';
    this.setTag('property', 'og:locale', ogLocale);

    const strippedPath = this.stripLocalePrefix(path);
    this.setHreflang('alternate', 'de', `${BASE_URL}/de${strippedPath}`);
    this.setHreflang('alternate', 'en', `${BASE_URL}/en${strippedPath}`);
    this.setHreflang('alternate', 'x-default', `${BASE_URL}${strippedPath}`);
  }

  private detectLocale(path: string): string {
    const lang = this.localeId?.split('-')[0]?.split('_')[0] ?? '';
    if (LOCALE_PREFIXES.includes(lang)) return lang;
    const segment = path.split('/')[1] ?? '';
    return LOCALE_PREFIXES.includes(segment) ? segment : 'de';
  }

  private stripLocalePrefix(path: string): string {
    const segment = path.split('/')[1] ?? '';
    if (LOCALE_PREFIXES.includes(segment)) {
      const rest = path.slice(segment.length + 1) || '/';
      return rest.startsWith('/') ? rest : `/${rest}`;
    }
    return path || '/';
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
