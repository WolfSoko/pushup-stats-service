#!/usr/bin/env node
// Build-time generator: scans `content/blog/<folder>/<lang>.md`,
// `content/wiki/pushup-types/<id>.<lang>.md`, and
// `content/wiki/exercises/<id>.<lang>.md` for any lowercase locale
// code (de, en, fr, es, it, nl, el, la, …), parses YAML frontmatter
// and renders markdown bodies to HTML, then writes:
//
//   web/src/app/blog/generated/<slug>.<lang>.ts  (one file per post per locale)
//   web/src/app/blog/generated/index.ts           (barrel re-exporting all posts)
//   libs/stats/src/lib/models/pushup-type-content.generated.ts
//   libs/stats/src/lib/models/exercise-wiki-content.generated.ts
//
// Authors translate by editing the markdown files; consumers keep
// reading the generated TS modules. See CLAUDE.md ("Translatable
// content workflow") for the full workflow.

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { marked } from 'marked';
import { GENERATED_CONTENT_PATHS } from './generated-content-paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Splits a markdown source into YAML frontmatter and body. Frontmatter
 * is required to be at the very start, delimited by `---` lines. Files
 * without frontmatter fail loudly — silent fallthrough would let
 * authors lose required metadata without noticing.
 */
export function parseFrontmatter(source) {
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    throw new Error('Missing YAML frontmatter at top of file');
  }
  const afterOpen = source.indexOf('\n', 3) + 1;
  const closeIdx = source.indexOf('\n---', afterOpen);
  if (closeIdx === -1) {
    throw new Error('Unterminated YAML frontmatter (missing closing `---`)');
  }
  const yamlBlock = source.slice(afterOpen, closeIdx);
  // Skip the closing `---` and the following newline (handles \n and \r\n).
  let bodyStart = closeIdx + 4;
  if (source[bodyStart] === '\r') bodyStart += 1;
  if (source[bodyStart] === '\n') bodyStart += 1;
  const data = parseYaml(yamlBlock) ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Frontmatter must parse to an object');
  }
  return { data, body: source.slice(bodyStart) };
}

function listDirEntries(dir) {
  try {
    return readdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function readFileIfExists(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Slugs become both URL paths AND filename components (`<slug>.<lang>.ts`).
// Reject anything that could escape the generated dir (path separators,
// `..`, leading dot, whitespace, capitals) so a malicious or sloppy
// frontmatter slug can't write outside web/src/app/blog/generated/.
const SAFE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Exercise wiki ids carry dotted segments (`abs.situps`, `plank.standard`).
// Looser than SAFE_SLUG_RE — only relaxes the dot character, so an id
// still can't contain path separators or escape sequences.
const SAFE_EXERCISE_ID_RE = /^[a-z][a-z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*$/;

function assertSafeSlug(slug, sourcePath) {
  if (typeof slug !== 'string' || !SAFE_SLUG_RE.test(slug)) {
    throw new Error(
      `${sourcePath}: invalid slug ${JSON.stringify(slug)} — must match ${SAFE_SLUG_RE} (lowercase ASCII kebab-case, no leading/trailing dash)`
    );
  }
}

const SAFE_LANG_RE = /^[a-z](?:[a-z-]*[a-z])?$/;

function assertSafeLang(lang, sourcePath) {
  if (typeof lang !== 'string' || !SAFE_LANG_RE.test(lang)) {
    throw new Error(
      `${sourcePath}: invalid locale code ${JSON.stringify(lang)} — must be lowercase ASCII (e.g. de, en, el, zh-tw)`
    );
  }
}

// ---------- Blog ----------

/**
 * Walks `content/blog/<slug-folder>/{de,en,...}.md` and returns one
 * BlogPost-shaped object per locale file. Folder name is the
 * cross-locale identifier; per-locale `slug` in frontmatter overrides
 * the URL slug for that locale (so `liegestuetze-fehler/en.md` can set
 * `slug: pushup-mistakes`). Every post carries `alternateSlugs` — the
 * map of every sibling locale's slug (including this post's own) —
 * mirroring `scanMarkdownBlogPosts` in `generate-sitemap.js` so the
 * runtime SEO service can emit a full hreflang set, not just a
 * single bilingual pairing.
 */
export function loadBlogPosts(contentRoot) {
  const blogRoot = join(contentRoot, 'blog');
  // Sort folder + file listings so the generated output is deterministic
  // across filesystems (macOS HFS, Linux ext4, Windows NTFS each return
  // readdir in different orders).
  const folders = listDirEntries(blogRoot)
    .filter((entry) => {
      const path = join(blogRoot, entry);
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();

  const posts = [];
  for (const folder of folders) {
    const perLocale = {};
    // Discover all locale files in this folder (any `<lang>.md`).
    const files = listDirEntries(join(blogRoot, folder))
      .filter((f) => f.endsWith('.md'))
      .sort();
    for (const file of files) {
      const lang = file.slice(0, -3); // strip `.md`
      const path = join(blogRoot, folder, file);
      assertSafeLang(lang, path);
      const source = readFileIfExists(path);
      if (source == null) continue;
      let parsed;
      try {
        parsed = parseFrontmatter(source);
      } catch (err) {
        throw new Error(`${path}: ${err.message}`, { cause: err });
      }
      perLocale[lang] = { path, ...parsed };
    }

    const langs = Object.keys(perLocale);
    for (const lang of langs) {
      const entry = perLocale[lang];
      const data = entry.data;
      const slug = data.slug ?? folder;
      assertSafeSlug(slug, entry.path);
      const post = {
        slug,
        lang,
        title: requireStr(data, 'title', entry.path),
        description: requireStr(data, 'description', entry.path),
        publishedAt: requireStr(data, 'publishedAt', entry.path),
        content: marked.parse(entry.body).trim(),
        keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
      };
      if (data.updatedAt) post.updatedAt = String(data.updatedAt);
      post.alternateSlugs = Object.fromEntries(
        langs.map((l) => [l, perLocale[l].data.slug ?? folder])
      );
      if (data.heroImage) post.heroImage = String(data.heroImage);
      if (data.heroImageAlt) post.heroImageAlt = String(data.heroImageAlt);
      if (data.heroImageCredit) {
        post.heroImageCredit = String(data.heroImageCredit);
      }
      posts.push(post);
    }
  }
  // Stable order: newest first, then by slug for determinism.
  posts.sort((a, b) => {
    const byDate = b.publishedAt.localeCompare(a.publishedAt);
    return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug);
  });
  return posts;
}

function requireStr(data, key, path) {
  const value = data[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path}: frontmatter field \`${key}\` is required`);
  }
  return value;
}

// ---------- Wiki / push-up types ----------

/**
 * Walks `content/wiki/pushup-types/<id>.<lang>.md` (any lowercase locale
 * code) and returns a `Record<id, Record<lang, PushupTypeContent>>` map.
 * Only the translatable text fields live in markdown; structural
 * metadata (slug, entryLabel, difficulty, keywords) stays in
 * `pushup-type.models.ts`. File listings are sorted so the generated
 * output is byte-stable across filesystems.
 */
export function loadPushupTypeContent(contentRoot) {
  const dir = join(contentRoot, 'wiki', 'pushup-types');
  const files = listDirEntries(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  const out = {};
  for (const file of files) {
    const match = /^(.+)\.([a-z][a-z-]*)\.md$/.exec(file);
    if (!match) {
      throw new Error(
        `${join(dir, file)}: filename must be <id>.<lang>.md (lowercase locale code)`
      );
    }
    const [, id, lang] = match;
    const path = join(dir, file);
    assertSafeSlug(id, path);
    assertSafeLang(lang, path);
    const source = readFileSync(path, 'utf-8');
    let parsed;
    try {
      parsed = parseFrontmatter(source);
    } catch (err) {
      throw new Error(`${path}: ${err.message}`, { cause: err });
    }
    const data = parsed.data;
    out[id] ??= {};
    const article = optionalArticle(parsed.body);
    out[id][lang] = {
      name: requireStr(data, 'name', path),
      summary: requireStr(data, 'summary', path),
      instructions: requireStrArray(data, 'instructions', path),
      tips: data.tips == null ? [] : requireStrArray(data, 'tips', path),
      ...(article === undefined ? {} : { article }),
    };
  }
  // Sort top-level keys (push-up type ids) and per-id locale keys so
  // the emitted JSON object key order is stable across runs.
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((id) => [
        id,
        Object.fromEntries(
          Object.keys(out[id])
            .sort()
            .map((lang) => [lang, out[id][lang]])
        ),
      ])
  );
}

/**
 * Long-form body of a wiki entry, rendered to HTML. Empty when the file
 * carries frontmatter only.
 *
 * Presence of this field is what makes a wiki detail page indexable: the
 * components drop `noindex` and the sitemap generator emits the URL only
 * for entries that have one. Frontmatter-only entries stay excluded —
 * ~60-100 words read as thin content and once cost the site an AdSense
 * review. Keeping the gate here means content and indexability can never
 * drift apart.
 */
function optionalArticle(body) {
  const html = marked.parse(body).trim();
  return html === '' ? undefined : html;
}

function requireStrArray(data, key, path) {
  const value = data[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `${path}: frontmatter field \`${key}\` must be a non-empty list`
    );
  }
  return value.map((item, idx) => {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(
        `${path}: frontmatter field \`${key}\` item at index ${idx} must be a non-empty string (got ${typeof item}). This usually means an unquoted scalar like "Word: rest" was parsed as a YAML map; wrap the item in single or double quotes.`
      );
    }
    return item;
  });
}

// ---------- Code emission ----------

const HEADER = `// AUTO-GENERATED by tools/src/generate-content.mjs — do not edit directly.
// Source files: content/blog/<folder>/<lang>.md and content/wiki/pushup-types/<id>.<lang>.md
// (any lowercase locale code is accepted, not just de/en).
// Run \`pnpm nx run tools:generate-content\` to regenerate (also runs automatically
// before \`pnpm nx run web:build\`).
`;

/** Emits one TS module per post. Each exports a single `POST` constant. */
function emitPerPostModule(post) {
  return `${HEADER}
import type { BlogPost } from '../blog-posts.types';

export const POST: BlogPost = ${JSON.stringify(post, null, 2)};
`;
}

/**
 * Emits the barrel `index.ts` that collects all per-post modules into
 * `GENERATED_BLOG_POSTS`. Consumers import this array the same way as
 * before; only the internal structure changes.
 */
function emitBlogBarrel(posts) {
  const imports = posts
    .map((p, i) => `import { POST as p${i} } from './${p.slug}.${p.lang}';`)
    .join('\n');
  const items = posts.map((_, i) => `  p${i}`).join(',\n');
  return `${HEADER}
import type { BlogPost } from '../blog-posts.types';

${imports}

export const GENERATED_BLOG_POSTS: ReadonlyArray<BlogPost> = [
${items},
];
`;
}

function emitPushupTypeModule(content) {
  return `${HEADER}
export interface PushupTypeContent {
  readonly name: string;
  readonly summary: string;
  readonly instructions: ReadonlyArray<string>;
  readonly tips: ReadonlyArray<string>;
  /** Long-form body as HTML. Absent for frontmatter-only entries, which stay noindexed. */
  readonly article?: string;
}

/**
 * Translatable wiki copy for push-up types. Keys are PushupTypeId
 * strings; values are per-locale content blocks. Types not represented
 * here fall back to the legacy parallel \`*En\` fields on PUSHUP_TYPES.
 */
export const PUSHUP_TYPE_CONTENT: Readonly<
  Record<string, Readonly<Record<string, PushupTypeContent>>>
> = ${JSON.stringify(content, null, 2)};
`;
}

function emitExerciseWikiModule(content) {
  return `${HEADER}
export interface ExerciseWikiContent {
  readonly name: string;
  readonly summary: string;
  readonly instructions: ReadonlyArray<string>;
  readonly tips: ReadonlyArray<string>;
  /** Long-form body as HTML. Absent for frontmatter-only entries, which stay noindexed. */
  readonly article?: string;
}

/**
 * Translatable wiki copy for non-pushup exercises. Keys are the
 * \`ExerciseDefinition.id\` (dotted segments like \`abs.situps\`); values
 * are per-locale content blocks. Locales without a translation fall
 * back through \`en\` → \`de\` in \`localizeExerciseWiki\`.
 */
export const EXERCISE_WIKI_CONTENT: Readonly<
  Record<string, Readonly<Record<string, ExerciseWikiContent>>>
> = ${JSON.stringify(content, null, 2)};
`;
}

/**
 * Walks `content/wiki/exercises/<id>.<lang>.md` (any lowercase locale
 * code) and returns a `Record<id, Record<lang, ExerciseWikiContent>>` map.
 * Mirrors `loadPushupTypeContent` but accepts dotted ids (e.g.
 * `abs.situps`) so the wiki entry id can match `ExerciseDefinition.id`
 * exactly.
 */
export function loadExerciseWikiContent(contentRoot) {
  const dir = join(contentRoot, 'wiki', 'exercises');
  const files = listDirEntries(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  const out = {};
  for (const file of files) {
    // Match `<id>.<lang>.md` where id may itself contain dots
    // (e.g. `abs.situps.de.md`). Locale must be the LAST dotted
    // segment before `.md` so the id captures the rest unambiguously.
    const match = /^(.+)\.([a-z][a-z-]*)\.md$/.exec(file);
    if (!match) {
      throw new Error(
        `${join(dir, file)}: filename must be <id>.<lang>.md (lowercase locale code)`
      );
    }
    const [, id, lang] = match;
    const path = join(dir, file);
    if (!SAFE_EXERCISE_ID_RE.test(id)) {
      throw new Error(
        `${path}: invalid exercise id ${JSON.stringify(id)} — must match ${SAFE_EXERCISE_ID_RE}`
      );
    }
    assertSafeLang(lang, path);
    const source = readFileSync(path, 'utf-8');
    let parsed;
    try {
      parsed = parseFrontmatter(source);
    } catch (err) {
      throw new Error(`${path}: ${err.message}`, { cause: err });
    }
    const data = parsed.data;
    out[id] ??= {};
    const article = optionalArticle(parsed.body);
    out[id][lang] = {
      name: requireStr(data, 'name', path),
      summary: requireStr(data, 'summary', path),
      instructions: requireStrArray(data, 'instructions', path),
      tips: data.tips == null ? [] : requireStrArray(data, 'tips', path),
      ...(article === undefined ? {} : { article }),
    };
  }
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((id) => [
        id,
        Object.fromEntries(
          Object.keys(out[id])
            .sort()
            .map((lang) => [lang, out[id][lang]])
        ),
      ])
  );
}

// ---------- Training plans ----------

/**
 * Walks `content/training-plans/<slug>.<lang>.md` and returns a
 * `Record<slug, Record<lang, html>>` map. Unlike blog and wiki these
 * files carry no frontmatter — the whole file is the markdown body
 * (structural plan data lives in `training-plan.catalog.ts`; the
 * markdown is purely the editorial long-form description).
 *
 * `validSlugs`, when provided, must contain every catalog slug: a
 * content file for an unknown slug fails the build instead of silently
 * shipping orphaned copy that no detail page ever renders.
 */
export function loadTrainingPlanContent(contentRoot, validSlugs) {
  const dir = join(contentRoot, 'training-plans');
  const files = listDirEntries(dir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  const out = {};
  for (const file of files) {
    const match = /^(.+)\.([a-z][a-z-]*)\.md$/.exec(file);
    if (!match) {
      throw new Error(
        `${join(dir, file)}: filename must be <slug>.<lang>.md (lowercase locale code)`
      );
    }
    const [, slug, lang] = match;
    const path = join(dir, file);
    assertSafeSlug(slug, path);
    assertSafeLang(lang, path);
    if (validSlugs && !validSlugs.includes(slug)) {
      throw new Error(
        `${path}: unknown training plan slug ${JSON.stringify(slug)} — not in training-plan.catalog.ts (${validSlugs.join(', ')})`
      );
    }
    const body = readFileSync(path, 'utf-8').trim();
    if (body.length === 0) {
      throw new Error(`${path}: file is empty`);
    }
    out[slug] ??= {};
    out[slug][lang] = marked.parse(body).trim();
  }
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((slug) => [
        slug,
        Object.fromEntries(
          Object.keys(out[slug])
            .sort()
            .map((lang) => [lang, out[slug][lang]])
        ),
      ])
  );
}

function emitTrainingPlanModule(content) {
  return `${HEADER}
/**
 * Long-form editorial copy for training plan detail pages, rendered
 * from \`content/training-plans/<slug>.<lang>.md\`. Keys are catalog
 * \`slug\`s; values are per-locale HTML bodies. Locales without a
 * translation fall back \`en\` → \`de\` in \`localizeTrainingPlanContent\`.
 */
export const TRAINING_PLAN_CONTENT: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = ${JSON.stringify(content, null, 2)};
`;
}

/** Reads the catalog slugs so content files can be validated against them. */
function readCatalogSlugs() {
  const source = readFileSync(
    resolve(ROOT, 'libs/stats/src/lib/models/training-plan.catalog.ts'),
    'utf-8'
  );
  const slugs = [];
  // Same pairing as `extractTrainingPlanSlugs` in generate-sitemap.js:
  // `id:` immediately followed by `slug:` scopes matches to catalog entries.
  const blockRegex = /\bid:\s*'[^']+',\s*\n\s*slug:\s*'([^']+)'/g;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    slugs.push(match[1]);
  }
  return slugs;
}

function main() {
  const contentRoot = resolve(ROOT, 'content');
  const posts = loadBlogPosts(contentRoot);
  const pushupContent = loadPushupTypeContent(contentRoot);
  const exerciseWikiContent = loadExerciseWikiContent(contentRoot);
  const trainingPlanContent = loadTrainingPlanContent(
    contentRoot,
    readCatalogSlugs()
  );

  // Per-post generated files + barrel. Track written filenames so two
  // posts colliding on `<slug>.<lang>` (e.g. accidental duplicate slug
  // across folders) fail loudly instead of silently overwriting.
  const generatedDir = resolve(ROOT, GENERATED_CONTENT_PATHS.blogDir);
  mkdirSync(generatedDir, { recursive: true });
  const writtenKeys = new Set();
  for (const post of posts) {
    const key = `${post.slug}.${post.lang}`;
    if (writtenKeys.has(key)) {
      throw new Error(
        `Duplicate generated filename ${key}.ts — two blog posts resolved to the same (slug, lang). Check frontmatter \`slug:\` fields under content/blog/.`
      );
    }
    writtenKeys.add(key);
    const filePath = resolve(generatedDir, `${key}.ts`);
    writeFileSync(filePath, emitPerPostModule(post), 'utf-8');
  }
  const barrelPath = resolve(generatedDir, 'index.ts');
  writeFileSync(barrelPath, emitBlogBarrel(posts), 'utf-8');

  const wikiPath = resolve(ROOT, GENERATED_CONTENT_PATHS.pushupTypes);
  writeFileSync(wikiPath, emitPushupTypeModule(pushupContent), 'utf-8');

  const exerciseWikiPath = resolve(ROOT, GENERATED_CONTENT_PATHS.exerciseWiki);
  writeFileSync(
    exerciseWikiPath,
    emitExerciseWikiModule(exerciseWikiContent),
    'utf-8'
  );

  const trainingPlanPath = resolve(ROOT, GENERATED_CONTENT_PATHS.trainingPlans);
  writeFileSync(
    trainingPlanPath,
    emitTrainingPlanModule(trainingPlanContent),
    'utf-8'
  );

  console.log(
    `generated ${posts.length} blog post(s) → web/src/app/blog/generated/`
  );
  console.log(
    `generated ${Object.keys(pushupContent).length} push-up type override(s)`
  );
  console.log(
    `generated ${Object.keys(exerciseWikiContent).length} exercise wiki override(s)`
  );
  console.log(
    `generated ${Object.keys(trainingPlanContent).length} training plan description(s)`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
