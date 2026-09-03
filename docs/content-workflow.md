# Translatable Content Workflow (Blog & Wiki)

Long-form content lives in markdown files with YAML frontmatter under `content/`, one file per locale. A build-time generator (`tools/src/generate-content.mjs`, Nx target `tools:generate-content`) renders markdown bodies to HTML and emits:

- `web/src/app/blog/generated/<slug>.<lang>.ts` — one TS module per blog post per locale, each exporting a single `POST: BlogPost` constant. Per-post files give reviewers a focused diff when a single post changes.
- `web/src/app/blog/generated/index.ts` — barrel re-exporting every per-post module as `GENERATED_BLOG_POSTS`.
- `libs/stats/src/lib/models/pushup-type-content.generated.ts` — single map of all push-up wiki content (small cross-cutting object, preferred over many tiny files).

All generated modules are checked in so reviewers see the diff and the build is hermetic. The generator runs automatically as a `dependsOn` of `web:build` and `tools:generate-sitemap`.

**Supported locales** (also drives sitemap hreflang): `de`, `en`, `fr`, `es`, `it`, `nl`, `el`, `no`, `zh`. Source language is German; English is the canonical secondary; the others are translations of the English version. Adding a new locale across all content = drop in one `<lang>.md` per folder/wiki entry — the generator and sitemap pick them up automatically. **Adding a new locale code itself touches 7 places** — see [`gotchas/i18n.md`](gotchas/i18n.md#adding-a-new-locale).

## How to add a new blog post

1. **Pick the folder name.** Use the German URL slug as the folder name (cross-locale identifier). It is purely an identifier — the actual URL slug per locale comes from frontmatter.

   ```
   content/blog/<german-slug>/de.md   ← required (source locale)
   content/blog/<german-slug>/en.md   ← strongly recommended (canonical translation)
   content/blog/<german-slug>/fr.md   ← optional, one per additional locale
   …
   ```

2. **Write the frontmatter.** Required fields: `title`, `description`, `publishedAt` (ISO date string, single-quoted), `slug` (URL slug for THIS locale). Optional: `keywords[]`, `updatedAt`, `heroImage`, `heroImageAlt`, `heroImageCredit` (HTML allowed in `heroImageCredit`).

   ```markdown
   ---
   slug: pushup-mistakes
   publishedAt: '2026-04-30'
   title: The 7 most common push-up mistakes — and how to fix each one
   description: Bad form costs you reps, progress, and sometimes your shoulder.
   keywords:
     - push-up form
     - push-up technique
   heroImage: https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&q=80
   heroImageAlt: Athlete in plank position on a training mat.
   heroImageCredit: 'Photo: <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>'
   ---

   ## Why clean form beats 100 sloppy reps

   Push-ups are an underrated full-body exercise…
   ```

3. **Write the body** in GitHub-flavored markdown. Raw HTML passes through `marked` unchanged — use it for callouts (`<aside class="plan-cta">…</aside>`), figure layouts, or any styling the typography defaults don't cover.

4. **Images.** External hero images (Unsplash) work as before. Self-hosted illustrations and infographics live in `web/public/assets/blog/` and are referenced as `<figure class="article-figure"><img src="/assets/blog/<name>.svg" alt="…" width="…" height="…" loading="lazy" /><figcaption>…</figcaption></figure>` — `alt` is mandatory. A `heroImage` that points at a self-hosted file must be an absolute URL (`https://pushup-stats.com/assets/blog/<name>.jpg`) because it doubles as `og:image`; use JPEG/PNG there, social crawlers ignore SVG. Data tables go inside `<div class="table-scroll"><table>…</table></div>` so they scroll instead of widening the page. `tools/src/blog-image-assets.spec.js` fails CI when a referenced asset is missing or an image has no `alt`. Figures with baked-in German labels are shared across locales as-is; if a translation needs localised labels, add a `<name>.<lang>.svg` and point the translated post at it.

   > **Why both forms resolve at the domain root.** The localized build emits one asset copy per locale under `<locale>/assets/` and stamps `<base href="/<locale>/">` into every document — but neither a root-absolute `src="/assets/…"` nor an absolute `heroImage` is rewritten by `<base>`. Those paths only work because `web/src/server.ts` mounts `/assets` onto the `/de/` build output; without it every self-hosted blog image 404s in production while looking fine under `nx serve` (no locale prefix there, so no `<base href>`). `web/web-e2e/blog-images.spec.ts` guards it. Note the flip side: because heroes carry the absolute production origin, staging and e2e always load them from `pushup-stats.com`, never from the build under test.

5. **Use translated slugs in cross-links.** Internal links use the same locale as the post: a French post links to `/fr/blog/<french-slug>` (not `/en/blog/<english-slug>`). The other-locale slug map is implicit from the sibling files in the folder — read them when in doubt.

6. **Write the same post in every additional locale.** Drop in `<folder>/<lang>.md` for each locale you want a translation in. Per-locale `slug:` differs across files; everything else translates. Untranslated locales fall back to the locale picker on the frontend (no auto-translation).

7. **Run the generator.** `pnpm nx run tools:generate-content` rebuilds the per-post TS modules + barrel + wiki content; `pnpm nx run tools:generate-sitemap` (auto-chained) refreshes `sitemap.xml`. Commit the regenerated TS modules and `sitemap.xml` alongside the markdown.

8. **YAML quoting gotchas.** Single-quoted YAML scalars require `''` to escape an apostrophe (`s'entraîner` → `'s''entraîner'`) or use double quotes. The fixer at `tools/src/fix-translated-yaml.mjs` repairs the most common error class but it is safer to write the YAML correctly the first time.

## Blog Translation Policy

Locale coverage rules for `content/blog/<folder>/<lang>.md` files.

- **Required for every post:** `de.md` (source) and `en.md` (canonical). A post that ships only one of these must not merge — the sitemap would emit a hreflang cluster of one and Google treats it as a thin locale graph.
- **Recommended:** every other supported locale (`fr`, `es`, `it`, `nl`, `el`, `no`, `zh`). Full 9-locale coverage is the target; short-term gaps are tolerated but should be tracked as follow-up issues, not left silent.
- **Current state:** all blog folders ship in all 9 supported locales. Adopting a new post means matching that invariant — drop in all 9 `<lang>.md` files in the same PR, or open a tracking issue for the missing translations before merge.
- **Intentionally-untranslated posts** (e.g. a DE-only local event recap) have no formal mechanism today. If the need arises we will add a `localesIntentionallyAbsent: ['it', 'no']` frontmatter field so the sitemap can skip those locales without flagging them as gaps. Until then: don't ship such posts. If you must, call it out in the PR description so reviewers know the partial coverage is deliberate.
- **Sitemap consequence:** `scanMarkdownBlogPosts` in `tools/src/generate-sitemap.js` emits a per-locale `<loc>` only for `.md` files that actually exist on disk. Missing locales are silently omitted from the post's hreflang cluster — Google reads that as "this post only exists in these locales". That behaviour is intentional: emitting a hreflang to a locale where the runtime would 404 is worse than a smaller cluster.

## How to add a new wiki push-up type

The wiki catalog has two parts: **structural metadata** (referenced by code) lives in TypeScript, **translatable copy** (name, summary, instructions, tips) lives in markdown. Keep them in sync.

1. **Add the structural entry** in `libs/stats/src/lib/models/pushup-type.models.ts`:
   - Append a new entry to `PUSHUP_TYPES` with: `id`, `slug`, `entryLabel`, `difficulty`, `keywordsDe[]`, `keywordsEn[]`. (The `name`/`nameEn`/`summary`/`summaryEn`/`instructions*`/`tips*` fields are now legacy duplicates of the markdown content — leave them populated until a follow-up cleanup removes them from `PushupTypeInfo`.)
   - Extend the `PushupTypeId` union with the new `id` literal.
   - **Do NOT rename `id` of an existing entry** — `PushupRecord.type` stores the kebab-case catalog `id` in Firestore (and read paths still tolerate the legacy English `entryLabel` from older docs). Renaming `id` would orphan existing rows. `entryLabel` is now read-path-only legacy and only kept so old docs keep resolving via `findPushupTypeByStoredValue` / `canonicalizePushupType` / `displayPushupType`.

2. **Add one markdown file per locale**:

   ```
   content/wiki/pushup-types/<id>.de.md   ← required (source locale)
   content/wiki/pushup-types/<id>.en.md
   content/wiki/pushup-types/<id>.fr.md   ← optional
   …
   ```

   File stem must equal the `id` from `PushupTypeInfo`. Suffix is the locale code.

3. **Frontmatter shape** (the body below it is optional — see step 5):

   ```markdown
   ---
   name: Standard push-up
   summary: Classic push-up with shoulder-width hand position and a straight body line.
   instructions:
     - Hands shoulder-width apart, directly under the shoulders, fingers pointing forward.
     - Body forms a straight line from head to heels — brace abs and glutes.
     - Elbows at roughly 45° to the torso, not flared out wide.
     - Lower the chest under control until it nearly touches the floor.
     - Press back up powerfully, do not lock the elbows at the top.
   tips:
     - Look slightly forward at the floor — do not crane the neck.
     - Breathing: inhale on the way down, exhale on the press up.
   ---
   ```

   `name` and `summary` are required strings. `instructions` is required, must be a non-empty list. `tips` is optional.

4. **Run the generator** (`pnpm nx run tools:generate-content`) and commit the regenerated `pushup-type-content.generated.ts`.

5. **Optional: a long-form body makes the page indexable.** Anything written below the closing `---` is rendered to HTML into the `article` field and shown under the instructions card. Its presence is the _only_ switch for indexability: with a body the detail page drops `noindex` and `generate-sitemap.js` lists its URL; without one it stays excluded from both, because ~60–100 words of frontmatter read as thin content and once cost the site an AdSense review. There is no code change involved either way — add the text, run the generator, done.

   Use the same raw-HTML conventions as the blog (`<h2>`, `<p>`, `<ul>`, `<strong>`); aim for roughly 250 words upward of genuinely specific content — execution detail, typical mistakes, how to program the exercise — not padding.

   The gate is per **locale**: a translated file without a body stays noindexed rather than inheriting the German text. Write German only. `detect-translation-gaps.mjs` reports the others as `wiki-article` gaps and the daily translations routine fills them.

## How to add a training-plan description

Long-form editorial copy for a training plan detail page (`/​<lang>/training-plans/<slug>`). Purpose: unique substance per plan — Google parked near-identical plan pages as "crawled, currently not indexed" (thin content, same weakness that caused the AdSense rejection).

1. **One file per locale**, no frontmatter — the whole file is the markdown body:

   ```
   content/training-plans/<slug>.de.md   ← required (source locale)
   content/training-plans/<slug>.en.md   ← canonical translation
   ```

   `<slug>` must match a `slug` in `training-plan.catalog.ts` — the generator fails on unknown slugs so orphaned copy can't ship silently.

2. **Suggested structure** (keep each plan's content genuinely distinct): Für wen? / Wie ist die Progression aufgebaut? / Häufige Fehler / Was du am Ende kannst. Internal links use the same locale as the file.

3. **Run the generator** and commit the regenerated `training-plan-content.generated.ts`. The detail page renders the section automatically; locales without a translation fall back `en` → `de` (`localizeTrainingPlanContent`), plans without any markdown simply omit the section.

Not every plan has content yet — coverage is being rolled out plan by plan. The translation-gap detector does not scan this directory yet; additional locales are hand-dropped `<slug>.<lang>.md` files for now.

## How edits propagate

- Edit a markdown file → run `pnpm nx run tools:generate-content` → commit both the markdown change AND the regenerated TS modules. The generator is deterministic and idempotent; reviewers should see diffs only in the files you intentionally touched.
- The web build (`pnpm nx run web:build`) auto-runs the generator first via `dependsOn`, so you cannot ship stale generated TS modules — but committing the regenerated output keeps PR diffs honest.
- The sitemap auto-discovers any `<lang>.md` file in `content/blog/<folder>/` and emits one hreflang alternate per locale present. No manual sitemap maintenance needed.

**Migration status.** All 22 blog posts and all 13 push-up types are markdown-sourced. `web/src/app/blog/blog-posts.data.ts` is a thin wrapper re-exporting `GENERATED_BLOG_POSTS` as `BLOG_POSTS`. The sitemap generator reads markdown frontmatter directly via the `yaml` package — no dependency on the generated TS modules.
