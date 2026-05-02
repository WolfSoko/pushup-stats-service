#!/usr/bin/env node
// Build-time generator: scans `content/blog/**/{de,en}.md` and
// `content/wiki/pushup-types/<id>.{de,en}.md`, parses YAML frontmatter
// and renders the markdown body to HTML, then writes:
//
//   web/src/app/blog/blog-posts.generated.ts
//   libs/stats/src/lib/models/pushup-type-content.generated.ts
//
// Authors translate by editing the markdown files; consumers keep
// reading the generated TS modules. See AGENTS.md ("Translatable
// content workflow") for the full workflow.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const SUPPORTED_LANGS = ['de', 'en'];

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

// ---------- Blog ----------

/**
 * Walks `content/blog/<slug-folder>/{de,en}.md` and returns one
 * BlogPost-shaped object per locale file. Folder name is the
 * cross-locale identifier; per-locale `slug` in frontmatter overrides
 * the URL slug for that locale (so `liegestuetze-fehler/en.md` can set
 * `slug: pushup-mistakes`). The other locale's slug becomes
 * `translationSlug` automatically — no manual cross-reference needed.
 */
export function loadBlogPosts(contentRoot) {
  const blogRoot = join(contentRoot, 'blog');
  const folders = listDirEntries(blogRoot).filter((entry) => {
    const path = join(blogRoot, entry);
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  });

  const posts = [];
  for (const folder of folders) {
    const perLocale = {};
    for (const lang of SUPPORTED_LANGS) {
      const path = join(blogRoot, folder, `${lang}.md`);
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

    for (const lang of SUPPORTED_LANGS) {
      const entry = perLocale[lang];
      if (!entry) continue;
      const otherLang = lang === 'de' ? 'en' : 'de';
      const otherEntry = perLocale[otherLang];
      const data = entry.data;
      const slug = data.slug ?? folder;
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
      if (otherEntry) {
        post.translationSlug = otherEntry.data.slug ?? folder;
      }
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
 * Walks `content/wiki/pushup-types/<id>.{de,en}.md` and returns a
 * `Record<id, Record<lang, PushupTypeContent>>` map. Only the
 * translatable text fields live in markdown; the structural metadata
 * (slug, entryLabel, difficulty, keywords) stays in `pushup-type.models.ts`.
 */
export function loadPushupTypeContent(contentRoot) {
  const dir = join(contentRoot, 'wiki', 'pushup-types');
  const files = listDirEntries(dir).filter((f) => f.endsWith('.md'));
  const out = {};
  for (const file of files) {
    const match = /^(.+)\.(de|en)\.md$/.exec(file);
    if (!match) {
      throw new Error(
        `${join(dir, file)}: filename must be <id>.<lang>.md (lang=de|en)`
      );
    }
    const [, id, lang] = match;
    const path = join(dir, file);
    const source = readFileSync(path, 'utf-8');
    let parsed;
    try {
      parsed = parseFrontmatter(source);
    } catch (err) {
      throw new Error(`${path}: ${err.message}`, { cause: err });
    }
    const data = parsed.data;
    out[id] ??= {};
    out[id][lang] = {
      name: requireStr(data, 'name', path),
      summary: requireStr(data, 'summary', path),
      instructions: requireStrArray(data, 'instructions', path),
      tips: Array.isArray(data.tips) ? data.tips.map(String) : [],
    };
  }
  return out;
}

function requireStrArray(data, key, path) {
  const value = data[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `${path}: frontmatter field \`${key}\` must be a non-empty list`
    );
  }
  return value.map(String);
}

// ---------- Code emission ----------

const HEADER = `// AUTO-GENERATED by tools/src/generate-content.mjs — do not edit directly.
// Source files: content/blog/**/{de,en}.md and content/wiki/pushup-types/<id>.{de,en}.md
// Run \`pnpm nx run tools:generate-content\` to regenerate (also runs automatically
// before \`pnpm nx run web:build\`).
`;

function emitBlogModule(posts) {
  const body = `${HEADER}
import type { BlogPost } from './blog-posts.types';

export const GENERATED_BLOG_POSTS: ReadonlyArray<BlogPost> = ${JSON.stringify(
    posts,
    null,
    2
  )};
`;
  return body;
}

function emitPushupTypeModule(content) {
  return `${HEADER}
export interface PushupTypeContent {
  readonly name: string;
  readonly summary: string;
  readonly instructions: ReadonlyArray<string>;
  readonly tips: ReadonlyArray<string>;
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

function main() {
  const contentRoot = resolve(ROOT, 'content');
  const posts = loadBlogPosts(contentRoot);
  const pushupContent = loadPushupTypeContent(contentRoot);

  const blogPath = resolve(ROOT, 'web/src/app/blog/blog-posts.generated.ts');
  writeFileSync(blogPath, emitBlogModule(posts), 'utf-8');

  const wikiPath = resolve(
    ROOT,
    'libs/stats/src/lib/models/pushup-type-content.generated.ts'
  );
  writeFileSync(wikiPath, emitPushupTypeModule(pushupContent), 'utf-8');

  console.log(
    `generated ${posts.length} blog post(s) and ${
      Object.keys(pushupContent).length
    } push-up type override(s)`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
