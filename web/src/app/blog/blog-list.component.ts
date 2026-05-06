import { DatePipe } from '@angular/common';
import { Component, inject, LOCALE_ID } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { getBlogPostsByLocale } from './blog-posts.data';

@Component({
  selector: 'app-blog-list',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    DatePipe,
    PageHeaderComponent,
  ],
  template: `
    <main class="blog-list">
      <app-page-header icon="article" variant="blog">
        <h1 page-title i18n="@@blog.list.title">Blog</h1>
        <p page-subtitle i18n="@@blog.list.intro">
          Tipps, Guides und Motivation rund um Liegestütze und Krafttraining.
        </p>
      </app-page-header>

      <div class="articles">
        @for (post of posts; track post.slug) {
          <mat-card class="article-card">
            @if (post.heroImage && !failedImages.has(post.slug)) {
              <a
                [routerLink]="['/blog', post.slug]"
                class="card-media"
                [attr.aria-label]="post.title"
              >
                <img
                  [src]="post.heroImage"
                  [alt]="post.heroImageAlt ?? post.title"
                  loading="lazy"
                  decoding="async"
                  (error)="onImageError(post.slug)"
                />
              </a>
            }
            <mat-card-header>
              <mat-card-title>{{ post.title }}</mat-card-title>
              <mat-card-subtitle>
                <time [attr.datetime]="post.publishedAt">{{
                  post.publishedAt | date: 'longDate'
                }}</time>
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <p>{{ post.description }}</p>
            </mat-card-content>
            <mat-card-actions>
              <a
                mat-stroked-button
                [routerLink]="['/blog', post.slug]"
                i18n="@@blog.list.readArticle"
                >Artikel lesen</a
              >
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .blog-list {
        max-width: 860px;
        margin: 0 auto;
        padding: clamp(20px, 4vw, 44px);
      }

      app-page-header {
        display: block;
        margin-bottom: 32px;
      }

      .articles {
        display: grid;
        gap: 16px;
      }

      .article-card {
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        overflow: hidden;
      }

      .card-media {
        display: block;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: var(--surface-subtle, #eee);
      }

      .card-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 200ms ease;
      }

      .card-media:hover img {
        transform: scale(1.02);
      }

      mat-card-content p {
        color: var(--text-muted);
        margin: 0;
      }

      mat-card-actions {
        margin-top: 1rem;
        padding: 0 16px 16px;
      }

      time {
        font-size: 0.85rem;
        color: var(--text-subtle);
      }
    `,
  ],
})
export class BlogListComponent {
  private readonly locale = inject(LOCALE_ID) as string;
  readonly posts = getBlogPostsByLocale(this.locale);
  readonly failedImages = new Set<string>();

  onImageError(slug: string): void {
    this.failedImages.add(slug);
  }
}
