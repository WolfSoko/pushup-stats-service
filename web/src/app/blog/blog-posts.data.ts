import { GENERATED_BLOG_POSTS } from './generated';
import type { BlogPost } from './blog-posts.types';

// Re-exported for backwards compatibility. New consumers should import
// the type directly from `./blog-posts.types`.
export type { BlogPost };

/**
 * Resolves a locale string (e.g. `fr-CH`, `de`) to the primary subtag
 * we look up by. Posts are language-tagged, not region-tagged, so we
 * always reduce to the primary tag. Falls back to `de` when the active
 * locale's primary tag has no posts (matches the SSR locale-redirect
 * behaviour, which treats `de` as the source/default).
 */
function resolveLang(locale: string): string {
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  const hasPostsForPrimary = BLOG_POSTS.some((p) => p.lang === primary);
  return hasPostsForPrimary ? primary : 'de';
}

export function getBlogPostsByLocale(locale: string): BlogPost[] {
  const lang = resolveLang(locale);
  return BLOG_POSTS.filter((p) => p.lang === lang).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
}

export function findBlogPost(
  slug: string,
  locale: string
): BlogPost | undefined {
  const lang = resolveLang(locale);
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
