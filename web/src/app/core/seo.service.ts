import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

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
}
