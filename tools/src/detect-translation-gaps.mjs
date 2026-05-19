#!/usr/bin/env node
/**
 * Scan the repo for translation gaps and write a Copilot-ready prompt.
 *
 * Three gap types are detected:
 *   1. XLIFF units in `messages.<lang>.xlf` with `state="initial"` and
 *      `<target>` == `<source>` — i.e. seeded fallbacks produced by
 *      `sync-xliff-locales.mjs` that no human or agent has translated.
 *   2. Missing `<lang>.md` files in every `content/blog/<folder>/`.
 *   3. Missing `<id>.<lang>.md` files in `content/wiki/pushup-types/`.
 *
 * Output:
 *   - `--report <path>` writes a Markdown brief describing each gap and
 *     instructing Copilot how to fix it (verbatim Angular/XLIFF + content
 *     workflow rules). Designed to be consumed by the Copilot coding
 *     agent.
 *   - `--summary <path>` writes a one-line `key=value` env file consumed
 *     by GitHub Actions (`has_gaps`, `gap_count`, `xliff_count`,
 *     `blog_count`, `wiki_count`).
 *   - `--json <path>` writes the raw gap inventory for tooling/tests.
 *
 * Source of truth for the locale list is
 * `web/src/server-locale-redirect.ts` (`SUPPORTED_LOCALES`). The source
 * locale (`de`) is filtered out automatically.
 */
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const LOCALE_DIR = join(REPO_ROOT, 'web', 'src', 'locale');
const BLOG_DIR = join(REPO_ROOT, 'content', 'blog');
const WIKI_DIR = join(REPO_ROOT, 'content', 'wiki', 'pushup-types');
const LOCALE_CONST_FILE = join(
  REPO_ROOT,
  'web',
  'src',
  'server-locale-redirect.ts'
);
const SOURCE_LOCALE = 'de';

function parseArgs(argv) {
  const out = { locales: '', report: '', summary: '', json: '' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--locales' && value) {
      out.locales = value;
      i++;
    } else if (flag === '--report' && value) {
      out.report = value;
      i++;
    } else if (flag === '--summary' && value) {
      out.summary = value;
      i++;
    } else if (flag === '--json' && value) {
      out.json = value;
      i++;
    }
  }
  return out;
}

async function readSupportedLocales() {
  const src = await fs.readFile(LOCALE_CONST_FILE, 'utf-8');
  const match = /export const SUPPORTED_LOCALES\s*=\s*\[([^\]]+)\]/.exec(src);
  if (!match) {
    throw new Error(
      `SUPPORTED_LOCALES not found in ${LOCALE_CONST_FILE}; cannot detect gaps without a locale list.`
    );
  }
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/['"`]/g, ''))
    .filter(Boolean);
}

function extractUnits(xml) {
  const map = new Map();
  const re = /<unit id="([^"]+)">[\s\S]*?<\/unit>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    map.set(m[1], m[0]);
  }
  return map;
}

function extractTagText(unitXml, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(unitXml);
  return m ? m[1] : '';
}

async function detectXliffGaps(targetLocales) {
  const gaps = [];
  for (const locale of targetLocales) {
    const path = join(LOCALE_DIR, `messages.${locale}.xlf`);
    if (!existsSync(path)) {
      gaps.push({
        locale,
        kind: 'xliff-file-missing',
        path: relative(REPO_ROOT, path),
        unitId: null,
        source: null,
      });
      continue;
    }
    const xml = await fs.readFile(path, 'utf-8');
    for (const [id, unit] of extractUnits(xml)) {
      const isInitial = /state="initial"/.test(unit);
      if (!isInitial) continue;
      const source = extractTagText(unit, 'source').trim();
      const target = extractTagText(unit, 'target').trim();
      // Missing target tag counts as a gap too.
      if (!target || target === source) {
        gaps.push({
          locale,
          kind: 'xliff-unit',
          path: relative(REPO_ROOT, path),
          unitId: id,
          source,
        });
      }
    }
  }
  return gaps;
}

async function detectBlogGaps(targetLocales) {
  if (!existsSync(BLOG_DIR)) return [];
  const folders = (await fs.readdir(BLOG_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const gaps = [];
  for (const folder of folders) {
    const folderPath = join(BLOG_DIR, folder);
    const sourcePath = join(folderPath, `${SOURCE_LOCALE}.md`);
    const hasSource = existsSync(sourcePath);
    for (const locale of targetLocales) {
      const candidate = join(folderPath, `${locale}.md`);
      if (!existsSync(candidate)) {
        gaps.push({
          locale,
          kind: 'blog',
          folder,
          path: relative(REPO_ROOT, candidate),
          sourcePath: hasSource ? relative(REPO_ROOT, sourcePath) : null,
        });
      }
    }
  }
  return gaps;
}

async function detectWikiGaps(targetLocales) {
  if (!existsSync(WIKI_DIR)) return [];
  const files = await fs.readdir(WIKI_DIR);
  const ids = new Set(
    files
      .map((f) => /^(.+)\.([a-z]{2})\.md$/.exec(f))
      .filter(Boolean)
      .map((m) => m[1])
  );
  const gaps = [];
  for (const id of ids) {
    const sourcePath = join(WIKI_DIR, `${id}.${SOURCE_LOCALE}.md`);
    const hasSource = existsSync(sourcePath);
    for (const locale of targetLocales) {
      const candidate = join(WIKI_DIR, `${id}.${locale}.md`);
      if (!existsSync(candidate)) {
        gaps.push({
          locale,
          kind: 'wiki',
          id,
          path: relative(REPO_ROOT, candidate),
          sourcePath: hasSource ? relative(REPO_ROOT, sourcePath) : null,
        });
      }
    }
  }
  return gaps;
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function renderReport(allGaps, locales) {
  const total = allGaps.length;
  const xliffGaps = allGaps.filter((g) => g.kind.startsWith('xliff'));
  const blogGaps = allGaps.filter((g) => g.kind === 'blog');
  const wikiGaps = allGaps.filter((g) => g.kind === 'wiki');

  const lines = [];
  lines.push('# Translation gaps — fill in missing locales');
  lines.push('');
  lines.push(
    `Auto-generated by \`tools/src/detect-translation-gaps.mjs\`. ${total} gap(s) across ${locales.length} target locale(s) (${locales.join(', ')}).`
  );
  lines.push('');
  lines.push(`- XLIFF units needing translation: **${xliffGaps.length}**`);
  lines.push(`- Missing blog post locale files: **${blogGaps.length}**`);
  lines.push(`- Missing wiki entry locale files: **${wikiGaps.length}**`);
  lines.push('');
  lines.push('## Task for Copilot');
  lines.push('');
  lines.push(
    'Translate each item listed below from the **German** source (or, where the German is unavailable, the **English** sibling) into the target locale. Source locale is `de`; English (`en`) is the canonical secondary. Keep meaning, tone, brevity, and any HTML/placeholders intact.'
  );
  lines.push('');
  lines.push('### Hard rules');
  lines.push('');
  lines.push(
    '1. **Never edit `web/src/locale/messages.xlf`** — that file is auto-generated by `pnpm nx run web:extract-i18n`. Only edit `messages.<lang>.xlf` files.'
  );
  lines.push(
    '2. **Preserve XLIFF placeholders verbatim** (`<ph id="…"/>`, `<pc …>`, `INTERPOLATION`, `START_BLOCK_IF`, etc.) and keep them in the right order. Only the human-readable text between placeholders changes.'
  );
  lines.push(
    '3. **Flip XLIFF unit state from `initial` to `translated`** once you have written a real target. Leave `initial` only on units you could not translate — note them in the PR description.'
  );
  lines.push(
    "4. **Markdown frontmatter quoting.** Single-quoted YAML scalars require `''` to escape an apostrophe (`s'entraîner` → `'s''entraîner'`) or use double quotes. **List items containing `: ` must be quoted** (`- 'Word: rest of sentence'`) or YAML will parse them as a map and `loadPushupTypeContent` will reject the file. See `docs/gotchas/i18n.md` (\"Machine-translated frontmatter pitfalls\") for both rules in detail."
  );
  lines.push(
    '5. **After any content/markdown change**, run `pnpm nx run tools:generate-content` and commit the regenerated TS modules in the same PR.'
  );
  lines.push(
    '6. **Run `node tools/src/fix-translated-yaml.mjs`** before committing — it repairs the most common apostrophe error class automatically.'
  );
  lines.push(
    '7. **Do not invent push-up type ids, blog slugs, or XLIFF unit ids.** Only translate strings that already exist in the lists below.'
  );
  lines.push(
    '8. **Pre-push checks:** `pnpm nx affected -t=lint,test,build -c=production --parallel=3` must pass before opening the PR.'
  );
  lines.push('');
  lines.push('### Output expectations');
  lines.push('');
  lines.push(
    '- One PR titled `chore(i18n): fill missing translations (<count> items)` against `main`.'
  );
  lines.push(
    '- PR body lists each touched locale with a per-locale gap count and links back to this task.'
  );
  lines.push(
    '- If you cannot translate an item (e.g. context unclear), leave it as is and call it out under a "Skipped" section in the PR body — do **not** invent content.'
  );
  lines.push('');

  if (xliffGaps.length > 0) {
    lines.push('## XLIFF units');
    lines.push('');
    lines.push(
      'For each unit, edit `web/src/locale/messages.<lang>.xlf` and replace the seeded `<target>` (currently equal to `<source>`) with the locale translation. Flip the segment state to `translated`.'
    );
    lines.push('');
    const byLocale = groupBy(xliffGaps, 'locale');
    for (const [locale, items] of [...byLocale].sort()) {
      lines.push(`### \`${locale}\` — ${items.length} unit(s)`);
      lines.push('');
      const fileMissing = items.find((g) => g.kind === 'xliff-file-missing');
      if (fileMissing) {
        lines.push(
          `> Locale file \`${fileMissing.path}\` does **not exist**. Seed it first by copying \`messages.en.xlf\` and changing \`trgLang="en"\` to \`trgLang="${locale}"\`, then translate.`
        );
        lines.push('');
        continue;
      }
      lines.push('| Unit id | German source |');
      lines.push('| --- | --- |');
      for (const g of items.slice(0, 200)) {
        const src = g.source
          .replace(/\|/g, '\\|')
          .replace(/\n/g, ' ')
          .slice(0, 200);
        lines.push(`| \`${g.unitId}\` | ${src} |`);
      }
      if (items.length > 200) {
        lines.push(
          `| … | _${items.length - 200} more — see \`messages.${locale}.xlf\`_ |`
        );
      }
      lines.push('');
    }
  }

  if (blogGaps.length > 0) {
    lines.push('## Blog posts');
    lines.push('');
    lines.push(
      'Create one markdown file per gap. Use the German sibling (`de.md`) as the source of truth; if missing, fall back to the English sibling (`en.md`). Translate frontmatter values (title, description, keywords, hero image alt/credit, slug) **and** the body. The `slug:` frontmatter field is per-locale and must be a URL-safe translation, not the German slug. See `docs/content-workflow.md` for the full frontmatter schema.'
    );
    lines.push('');
    const byLocale = groupBy(blogGaps, 'locale');
    for (const [locale, items] of [...byLocale].sort()) {
      lines.push(`### \`${locale}\` — ${items.length} post(s) to create`);
      lines.push('');
      for (const g of items) {
        const src = g.sourcePath ?? `content/blog/${g.folder}/en.md`;
        lines.push(
          `- Create \`${g.path}\` from \`${src}\` (folder: \`${g.folder}\`)`
        );
      }
      lines.push('');
    }
  }

  if (wikiGaps.length > 0) {
    lines.push('## Wiki push-up types');
    lines.push('');
    lines.push(
      'Wiki entries are frontmatter-only — translate `name`, `summary`, every item in `instructions`, and every item in `tips`. Keep numeric/code values (`3×8`, `Tempo 3-1-1`) unchanged.'
    );
    lines.push('');
    const byLocale = groupBy(wikiGaps, 'locale');
    for (const [locale, items] of [...byLocale].sort()) {
      lines.push(`### \`${locale}\` — ${items.length} entry/entries to create`);
      lines.push('');
      for (const g of items) {
        const src = g.sourcePath ?? `content/wiki/pushup-types/${g.id}.en.md`;
        lines.push(`- Create \`${g.path}\` from \`${src}\` (id: \`${g.id}\`)`);
      }
      lines.push('');
    }
  }

  if (total === 0) {
    lines.push('## Status');
    lines.push('');
    lines.push('All target locales are fully translated. No action needed.');
    lines.push('');
  }

  return lines.join('\n');
}

function renderSummaryEnv(allGaps) {
  const xliffCount = allGaps.filter((g) => g.kind.startsWith('xliff')).length;
  const blogCount = allGaps.filter((g) => g.kind === 'blog').length;
  const wikiCount = allGaps.filter((g) => g.kind === 'wiki').length;
  const total = allGaps.length;
  return [
    `has_gaps=${total > 0 ? 'true' : 'false'}`,
    `gap_count=${total}`,
    `xliff_count=${xliffCount}`,
    `blog_count=${blogCount}`,
    `wiki_count=${wikiCount}`,
    '',
  ].join('\n');
}

export async function detectGaps({ locales } = {}) {
  const supported = await readSupportedLocales();
  const targets = (
    locales && locales.length > 0
      ? locales
      : supported.filter((l) => l !== SOURCE_LOCALE)
  ).filter((l) => l !== SOURCE_LOCALE);

  const [xliffGaps, blogGaps, wikiGaps] = await Promise.all([
    detectXliffGaps(targets),
    detectBlogGaps(targets),
    detectWikiGaps(targets),
  ]);
  return { locales: targets, gaps: [...xliffGaps, ...blogGaps, ...wikiGaps] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requested = args.locales
    ? args.locales
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const { locales, gaps } = await detectGaps({ locales: requested });

  const report = renderReport(gaps, locales);
  if (args.report) {
    await fs.writeFile(args.report, report);
  } else {
    process.stdout.write(report);
  }
  if (args.summary) {
    await fs.writeFile(args.summary, renderSummaryEnv(gaps));
  }
  if (args.json) {
    await fs.writeFile(args.json, JSON.stringify({ locales, gaps }, null, 2));
  }

  const xliffCount = gaps.filter((g) => g.kind.startsWith('xliff')).length;
  const blogCount = gaps.filter((g) => g.kind === 'blog').length;
  const wikiCount = gaps.filter((g) => g.kind === 'wiki').length;
  console.error(
    `Detected ${gaps.length} gap(s) — xliff:${xliffCount} blog:${blogCount} wiki:${wikiCount} across locales: ${locales.join(', ')}`
  );
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
