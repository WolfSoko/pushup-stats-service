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

const BASE_URL = 'https://pushup-stats.de';

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
          <h1>{{ post.title }}</h1>
          <p class="article-meta">
            <time [attr.datetime]="post.publishedAt">{{
              post.publishedAt | date: 'longDate'
            }}</time>
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

      .article-meta time {
        font-size: 0.85rem;
        color: var(--text-subtle);
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
    this.seo.update(found.title, found.description, `/blog/${found.slug}`);
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({
      name: 'keywords',
      content: found.keywords.join(', '),
    });
    this.injectJsonLd(found);
  }

  private injectJsonLd(post: BlogPost): void {
    const head = this.document.head;
    if (!head) return;

    this.removeJsonLd();

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-blog-ld', '1');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      author: {
        '@type': 'Organization',
        name: 'Pushup Tracker',
        url: BASE_URL,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Pushup Tracker',
        url: BASE_URL,
      },
      url: `${BASE_URL}/blog/${post.slug}`,
      keywords: post.keywords.join(', '),
    });
    head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.document.head?.querySelector('script[data-blog-ld]')?.remove();
  }
}
