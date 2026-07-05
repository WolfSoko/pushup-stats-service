// Pure type module — extracted so the build-time generator can emit
// `import type { BlogPost } from './blog-posts.types'` without a circular
// dependency on `blog-posts.data.ts` (which imports the generated module).

export interface BlogPost {
  slug: string;
  lang: string;
  title: string;
  description: string;
  publishedAt: string;
  /** Optional ISO date; when present the article shows "Updated on …" and sets article:modified_time. */
  updatedAt?: string;
  content: string;
  keywords: string[];
  /** Map of every locale this article is translated into, to that locale's slug (including this post's own locale) — enables full hreflang alternate sets on both the sitemap and the article page. */
  alternateSlugs?: Record<string, string>;
  /** Absolute URL of the hero image rendered above the article body and used for og:image. */
  heroImage?: string;
  /** Accessible alt text for the hero image. */
  heroImageAlt?: string;
  /** Small credit line rendered under the hero — typically "Photo: Photographer on Unsplash". HTML allowed. */
  heroImageCredit?: string;
}
