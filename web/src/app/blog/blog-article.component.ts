import { DOCUMENT, DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  LOCALE_ID,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SeoService } from '../core/seo.service';
import { BlogPost, findBlogPost } from './blog-posts.data';
import { countWords, readingMinutes } from './reading-time';

const BASE_URL = 'https://pushup-stats.de';
const LOGO_URL = `${BASE_URL}/assets/pushup-logo.png`;

@Component({
  selector: 'app-blog-article',
  imports: [RouterLink, MatButtonModule, MatIconModule, DatePipe],
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
          <h1>{{ post.title }}</h1>
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
  styles: [
    `
      :host {
        display: block;
      }

      .blog-article {
        max-width: 760px;
        margin: 0 auto;
        padding: clamp(20px, 4vw, 44px);
      }

      .article-header {
        margin-bottom: 32px;
      }

      .article-hero {
        margin: 8px 0 24px;
        border-radius: 16px;
        overflow: hidden;
        background: var(--surface-subtle, #eee);
        aspect-ratio: 16 / 9;
        position: relative;
      }

      .article-hero img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .article-hero figcaption {
        position: absolute;
        left: 12px;
        bottom: 10px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.72rem;
        line-height: 1.3;
        color: #fff;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }

      .article-hero figcaption ::ng-deep a {
        color: #fff;
        text-decoration: underline;
      }

      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 0 0 16px -8px;
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      h1 {
        margin: 0 0 8px;
        font-size: clamp(1.6rem, 4vw, 2.4rem);
        line-height: 1.2;
      }

      .article-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        color: var(--text-subtle);
      }

      .article-meta time {
        font-size: inherit;
        color: inherit;
      }

      .article-meta .updated {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .article-body {
        line-height: 1.75;
        color: var(--text-body-secondary);

        ::ng-deep {
          h2 {
            margin: 32px 0 12px;
            font-size: clamp(1.15rem, 2.5vw, 1.4rem);
            color: var(--text-heading-secondary);
          }

          p {
            margin: 0 0 16px;
          }

          ul,
          ol {
            margin: 0 0 16px;
            padding-left: 24px;
          }

          li {
            margin-bottom: 6px;
          }

          strong {
            color: var(--text-heading-secondary);
          }

          a {
            color: var(--mat-sys-primary, #7c4dff);
            text-decoration: underline;
            text-underline-offset: 2px;
          }

          a:hover {
            text-decoration-thickness: 2px;
          }
        }
      }

      .article-footer {
        margin-top: 48px;
        padding-top: 24px;
        border-top: 1px solid var(--border-subtle);
      }

      .not-found {
        max-width: 760px;
        margin: 0 auto;
        padding: clamp(20px, 4vw, 44px);
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
        color: var(--text-muted);
      }
    `,
  ],
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
    this.seo.update(found.title, found.description, `/blog/${found.slug}`, {
      imageUrl: found.heroImage,
      imageAlt: found.heroImageAlt,
      publishedTime: found.publishedAt,
      modifiedTime: found.updatedAt,
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

    const canonical = `${BASE_URL}/${this.locale.startsWith('en') ? 'en' : 'de'}/blog/${post.slug}`;
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
