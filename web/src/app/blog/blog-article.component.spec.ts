import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeZh from '@angular/common/locales/zh';
import { BlogArticleComponent } from './blog-article.component';
import { SeoService } from '../core/seo.service';
import { findBlogPost } from './blog-posts.data';

// The global test-setup only registers `de`/`fr` locale data; the zh
// fixture below needs `zh` so the article template's DatePipe doesn't
// throw NG0701 when rendering the zh post's `publishedAt`.
registerLocaleData(localeZh);

describe('BlogArticleComponent', () => {
  let fixture: ComponentFixture<BlogArticleComponent>;
  const seoMock = { update: vi.fn() };

  function makeRoute(slug: string): ActivatedRoute {
    const map = convertToParamMap({ slug });
    return { snapshot: { paramMap: map } } as unknown as ActivatedRoute;
  }

  async function setup(slug: string, locale: string): Promise<void> {
    vi.clearAllMocks();

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BlogArticleComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: makeRoute(slug) },
        { provide: SeoService, useValue: seoMock },
        { provide: LOCALE_ID, useValue: locale },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogArticleComponent);
    fixture.detectChanges();
  }

  describe('hreflang alternates', () => {
    it('should pass every sibling locale slug through to SeoService for a post translated into more than two locales', async () => {
      // given — "liegestuetze-fehler" ships in all 10 supported locales
      // with a distinct slug per locale (regression: the old
      // `translationSlug` field only ever covered exactly-2-locale
      // posts, so the zh post produced no `de` alternate at all, and
      // SeoService's x-default fallback then advertised the German
      // site under the *zh* slug `pushup-mistakes` — a URL that never
      // existed; the real German slug is `liegestuetze-fehler`).
      const post = findBlogPost('pushup-mistakes', 'zh');
      expect(post).toBeDefined();

      // when
      await setup('pushup-mistakes', 'zh');

      // then
      expect(seoMock.update).toHaveBeenCalledWith(
        post?.title,
        post?.description,
        '/blog/pushup-mistakes',
        expect.objectContaining({
          alternates: expect.objectContaining({
            de: '/blog/liegestuetze-fehler',
            en: '/blog/pushup-mistakes',
            zh: '/blog/pushup-mistakes',
          }),
        })
      );
    });

    it('should map each locale to its own translated slug, not the German post slug, for a second post', async () => {
      // given — same regression as above, checked against a different
      // post family to guard against a fix that only special-cases one
      // folder.
      const post = findBlogPost('liegestuetze-ab-40', 'de');
      expect(post).toBeDefined();

      // when
      await setup('liegestuetze-ab-40', 'de');

      // then
      expect(seoMock.update).toHaveBeenCalledWith(
        post?.title,
        post?.description,
        '/blog/liegestuetze-ab-40',
        expect.objectContaining({
          alternates: expect.objectContaining({
            de: '/blog/liegestuetze-ab-40',
            en: '/blog/pushups-over-40',
            zh: '/blog/pushups-over-40',
          }),
        })
      );
    });
  });
});
