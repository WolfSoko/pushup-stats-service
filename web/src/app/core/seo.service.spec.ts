import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

const BASE_URL = 'https://pushup-stats.de';

describe('SeoService', () => {
  function setup(locale: 'de' | 'en'): SeoService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LOCALE_ID, useValue: locale }],
    });
    // Remove any link tags left from previous tests.
    document.head
      .querySelectorAll('link[rel="canonical"], link[rel="alternate"]')
      .forEach((node) => node.remove());
    // Remove image meta tags so each test starts from a clean slate.
    document.head
      .querySelectorAll(
        'meta[property="og:image"], meta[property="og:image:alt"], meta[name="twitter:image"], meta[name="twitter:image:alt"]'
      )
      .forEach((node) => node.remove());
    return TestBed.inject(SeoService);
  }

  function getCanonicalHref(): string | null {
    return (
      document.head
        .querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.getAttribute('href') ?? null
    );
  }

  function getHreflangHref(hreflang: string): string | null {
    return (
      document.head
        .querySelector<HTMLLinkElement>(
          `link[rel="alternate"][hreflang="${hreflang}"]`
        )
        ?.getAttribute('href') ?? null
    );
  }

  describe('canonical URL', () => {
    it('is an absolute URL anchored on BASE_URL (does not rely on document.location.origin)', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/');

      expect(getCanonicalHref()).toBe(`${BASE_URL}/de/`);
    });

    it('includes the current locale prefix so that canonical is self-referential', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/blog/hello');

      expect(getCanonicalHref()).toBe(`${BASE_URL}/de/blog/hello`);
    });

    it('points to the /en/ URL on the English build', () => {
      const seo = setup('en');
      seo.update('Title', 'Description', '/blog/hello');

      expect(getCanonicalHref()).toBe(`${BASE_URL}/en/blog/hello`);
    });

    it('strips an existing locale prefix so canonical never has a duplicated prefix', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/de/blog/hello');

      expect(getCanonicalHref()).toBe(`${BASE_URL}/de/blog/hello`);
    });
  });

  describe('hreflang alternates', () => {
    it('emits self-referential hreflang that matches the canonical on the de build', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/blog/hello');

      expect(getCanonicalHref()).toBe(getHreflangHref('de'));
    });

    it('emits self-referential hreflang that matches the canonical on the en build', () => {
      const seo = setup('en');
      seo.update('Title', 'Description', '/blog/hello');

      expect(getCanonicalHref()).toBe(getHreflangHref('en'));
    });

    it('on the de build, canonical does not match any non-self hreflang (Lighthouse best practice)', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/blog/hello');

      const canonical = getCanonicalHref();
      expect(canonical).toBe(getHreflangHref('de'));
      expect(canonical).not.toBe(getHreflangHref('en'));
    });

    it('on the en build, canonical does not match any non-self hreflang (Lighthouse best practice)', () => {
      const seo = setup('en');
      seo.update('Title', 'Description', '/blog/hello');

      const canonical = getCanonicalHref();
      expect(canonical).toBe(getHreflangHref('en'));
      expect(canonical).not.toBe(getHreflangHref('de'));
    });

    it('points x-default to the /de/ URL (the default locale) consistently', () => {
      const seoDe = setup('de');
      seoDe.update('Title', 'Description', '/');
      expect(getHreflangHref('x-default')).toBe(`${BASE_URL}/de/`);

      const seoEn = setup('en');
      seoEn.update('Title', 'Description', '/');
      expect(getHreflangHref('x-default')).toBe(`${BASE_URL}/de/`);
    });

    it('produces both de and en alternates with the same stripped path', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/blog/hello');

      expect(getHreflangHref('de')).toBe(`${BASE_URL}/de/blog/hello`);
      expect(getHreflangHref('en')).toBe(`${BASE_URL}/en/blog/hello`);
    });
  });

  describe('og:url', () => {
    it('equals the canonical URL', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/blog/hello');

      const canonical = getCanonicalHref();
      const ogUrl = document.head
        .querySelector<HTMLMetaElement>('meta[property="og:url"]')
        ?.getAttribute('content');
      expect(ogUrl).toBe(canonical);
    });
  });

  describe('image metadata', () => {
    const IMAGE_URL = 'https://images.unsplash.com/photo-x?w=1200';
    const IMAGE_ALT = 'A photo';

    function getMetaContent(selector: string): string | null {
      return (
        document.head
          .querySelector<HTMLMetaElement>(selector)
          ?.getAttribute('content') ?? null
      );
    }

    it('writes og:image and twitter:image when imageUrl is provided', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/blog/hello', {
        imageUrl: IMAGE_URL,
        imageAlt: IMAGE_ALT,
      });

      expect(getMetaContent('meta[property="og:image"]')).toBe(IMAGE_URL);
      expect(getMetaContent('meta[property="og:image:alt"]')).toBe(IMAGE_ALT);
      expect(getMetaContent('meta[name="twitter:image"]')).toBe(IMAGE_URL);
      expect(getMetaContent('meta[name="twitter:image:alt"]')).toBe(IMAGE_ALT);
    });

    it('falls back to the title as image alt when imageAlt is omitted', () => {
      const seo = setup('de');
      seo.update('Great Title', 'Description', '/blog/hello', {
        imageUrl: IMAGE_URL,
      });

      expect(getMetaContent('meta[property="og:image:alt"]')).toBe(
        'Great Title'
      );
    });

    it('removes stale image tags when a subsequent update has no image', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/blog/hello', {
        imageUrl: IMAGE_URL,
        imageAlt: IMAGE_ALT,
      });
      seo.update('Title 2', 'Description', '/');

      expect(
        document.head.querySelector('meta[property="og:image"]')
      ).toBeNull();
      expect(
        document.head.querySelector('meta[name="twitter:image"]')
      ).toBeNull();
    });
  });

  describe('article timestamps', () => {
    function getMetaContent(selector: string): string | null {
      return (
        document.head
          .querySelector<HTMLMetaElement>(selector)
          ?.getAttribute('content') ?? null
      );
    }

    it('emits article:published_time / modified_time as full ISO-8601 strings', () => {
      const seo = setup('de');
      seo.update('T', 'D', '/blog/x', {
        publishedTime: '2026-04-01',
        modifiedTime: '2026-04-20',
      });

      expect(getMetaContent('meta[property="article:published_time"]')).toBe(
        '2026-04-01T00:00:00Z'
      );
      expect(getMetaContent('meta[property="article:modified_time"]')).toBe(
        '2026-04-20T00:00:00Z'
      );
    });

    it('passes through values that already contain a time component', () => {
      const seo = setup('de');
      seo.update('T', 'D', '/blog/x', {
        publishedTime: '2026-04-01T12:34:56+02:00',
      });

      expect(getMetaContent('meta[property="article:published_time"]')).toBe(
        '2026-04-01T12:34:56+02:00'
      );
    });

    it('removes article meta tags when a subsequent update omits them', () => {
      const seo = setup('de');
      seo.update('T', 'D', '/blog/x', {
        publishedTime: '2026-04-01',
        modifiedTime: '2026-04-20',
      });
      seo.update('T2', 'D2', '/');

      expect(
        document.head.querySelector('meta[property="article:published_time"]')
      ).toBeNull();
      expect(
        document.head.querySelector('meta[property="article:modified_time"]')
      ).toBeNull();
    });
  });

  describe('idempotency', () => {
    it('updates existing canonical/hreflang links instead of appending duplicates', () => {
      const seo = setup('de');
      seo.update('Title', 'Description', '/');
      seo.update('Title', 'Description', '/blog/hello');

      expect(
        document.head.querySelectorAll('link[rel="canonical"]').length
      ).toBe(1);
      expect(
        document.head.querySelectorAll('link[rel="alternate"][hreflang="de"]')
          .length
      ).toBe(1);
      expect(
        document.head.querySelectorAll('link[rel="alternate"][hreflang="en"]')
          .length
      ).toBe(1);
      expect(
        document.head.querySelectorAll(
          'link[rel="alternate"][hreflang="x-default"]'
        ).length
      ).toBe(1);
      expect(getCanonicalHref()).toBe(`${BASE_URL}/de/blog/hello`);
    });
  });
});
