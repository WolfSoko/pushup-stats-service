import { DOCUMENT, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  LOCALE_ID,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { SeoService } from '../core/seo.service';
import { BlogPost, findBlogPost } from './blog-posts.data';
import { countWords, readingMinutes } from './reading-time';

const BASE_URL = 'https://pushup-stats.com';
const LOGO_URL = `${BASE_URL}/assets/pushup-logo.png`;

@Component({
  selector: 'app-blog-article',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    DatePipe,
    PageHeaderComponent,
  ],
  template: `
    @if (post) {
      <article class="blog-article">
        <header class="article-header">
          <a
            mat-button
            routerLink="/blog"
            class="back-link"
            i18n="@@blog.article.back"
          >
            <mat-icon>arrow_back</mat-icon>
            Blog
          </a>
          @if (post.heroImage && !heroImageFailed) {
            <figure class="article-hero">
              <img
                [src]="post.heroImage"
                [alt]="post.heroImageAlt ?? post.title"
                loading="eager"
                decoding="async"
                width="1200"
                height="675"
                (error)="heroImageFailed = true"
              />
              @if (post.heroImageCredit) {
                <figcaption [innerHTML]="post.heroImageCredit"></figcaption>
              }
            </figure>
          }
          <app-page-header icon="article" variant="blog">
            <h1 page-title>{{ post.title }}</h1>
            <p page-subtitle>{{ post.description }}</p>
          </app-page-header>
          <p class="article-meta">
            <time [attr.datetime]="post.publishedAt">{{
              post.publishedAt | date: 'longDate'
            }}</time>
            @if (readingTimeMinutes) {
              <span aria-hidden="true">·</span>
              <span i18n="@@blog.article.readingTime"
                >{{ readingTimeMinutes }} Min. Lesezeit</span
              >
            }
            @if (post.updatedAt) {
              <span aria-hidden="true">·</span>
              <span class="updated">
                <span i18n="@@blog.article.updated">Aktualisiert am</span>
                <time [attr.datetime]="post.updatedAt">{{
                  post.updatedAt | date: 'longDate'
                }}</time>
              </span>
            }
          </p>
        </header>

        <div class="article-body" [innerHTML]="post.content"></div>

        <footer class="article-footer">
          <a
            mat-stroked-button
            routerLink="/register"
            i18n="@@blog.article.cta"
          >
            Kostenlos tracken – Jetzt registrieren
          </a>
        </footer>
      </article>
    } @else {
      <div class="not-found">
        <p i18n="@@blog.article.notFound">Artikel nicht gefunden.</p>
        <a mat-stroked-button routerLink="/blog" i18n="@@blog.article.toList"
          >Zur Übersicht</a
        >
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './blog-article.component.scss',
})
export class BlogArticleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly destroyRef = inject(DestroyRef);

  post: BlogPost | null = null;
  readingTimeMinutes = 0;
  heroImageFailed = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.removeJsonLd());
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    const found = (slug && findBlogPost(slug, this.locale)) ?? null;

    if (!found) {
      this.router.navigateByUrl('/blog');
      return;
    }

    this.post = found;
    const wordCount = countWords(found.content);
    this.readingTimeMinutes = readingMinutes(found.content);
    // Blog posts have locale-specific slugs (`alternateSlugs`), so we
    // tell SeoService exactly which locales this article exists in
    // and what their slugs are. Locales without a translation get no
    // hreflang alternate — better than advertising URLs that 404.
    const alternates: Record<string, string> = Object.fromEntries(
      Object.entries(found.alternateSlugs).map(([lang, slug]) => [
        lang,
        `/blog/${slug}`,
      ])
    );
    this.seo.update(found.title, found.description, `/blog/${found.slug}`, {
      imageUrl: found.heroImage,
      imageAlt: found.heroImageAlt,
      publishedTime: found.publishedAt,
      modifiedTime: found.updatedAt,
      alternates,
    });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({
      name: 'keywords',
      content: found.keywords.join(', '),
    });
    this.injectJsonLd(found, wordCount);
  }

  private injectJsonLd(post: BlogPost, wordCount: number): void {
    const head = this.document.head;
    if (!head) return;

    this.removeJsonLd();

    // Mirror SeoService's canonical resolution: a German post viewed
    // under a fallback locale build (fr/es/it/nl/el/la → German
    // content) canonicalises to /de/, an English post canonicalises
    // to /en/. Without this both canonical URLs (the `<link>` tag and
    // the JSON-LD payload) drifted apart whenever the active build
    // locale wasn't the post's real language.
    const canonical = `${BASE_URL}/${post.lang}/blog/${post.slug}`;
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt ?? post.publishedAt,
      wordCount,
      inLanguage: post.lang,
      author: {
        '@type': 'Organization',
        name: 'Pushup Tracker',
        url: BASE_URL,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Pushup Tracker',
        url: BASE_URL,
        logo: {
          '@type': 'ImageObject',
          url: LOGO_URL,
        },
      },
      url: canonical,
      mainEntityOfPage: canonical,
      keywords: post.keywords.join(', '),
    };
    if (post.heroImage) {
      jsonLd['image'] = [post.heroImage];
    }

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-blog-ld', '1');
    script.textContent = JSON.stringify(jsonLd);
    head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.document.head?.querySelector('script[data-blog-ld]')?.remove();
  }
}
