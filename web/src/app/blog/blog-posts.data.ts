import { GENERATED_BLOG_POSTS } from './generated';
import type { BlogPost } from './blog-posts.types';

// Re-exported for backwards compatibility. New consumers should import
// the type directly from `./blog-posts.types`.
export type { BlogPost };

export function getBlogPostsByLocale(locale: string): BlogPost[] {
  const lang = locale.toLowerCase().startsWith('en') ? 'en' : 'de';
  return BLOG_POSTS.filter((p) => p.lang === lang).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
}

export function findBlogPost(
  slug: string,
  locale: string
): BlogPost | undefined {
  const lang = locale.toLowerCase().startsWith('en') ? 'en' : 'de';
  return BLOG_POSTS.find((p) => p.slug === slug && p.lang === lang);
}

/**
 * Full blog catalog. Posts are authored as markdown under
 * `content/blog/<folder>/{de,en,...}.md` and emitted by the build-time
 * generator (`tools/src/generate-content.mjs`) into one TS module per
 * post per locale under `./generated/`. The barrel `./generated/index.ts`
 * re-exports them as `GENERATED_BLOG_POSTS`. See AGENTS.md
 * ("Translatable content workflow").
 */
export const BLOG_POSTS: ReadonlyArray<BlogPost> = GENERATED_BLOG_POSTS;
