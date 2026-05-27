# Routine: Fill translation gaps

> Replacement for the deleted `.github/workflows/copilot-translations.yml`.
>
> This file is the **prompt body** for a Claude Code on the web routine. It is
> not executed by any CI runner — it lives in the repo so the configuration is
> reviewable and reproducible. See **Setup** at the bottom for how to wire it
> into [claude.ai/code/routines](https://claude.ai/code/routines).

---

## Prompt (paste verbatim into the routine form)

You are running as an autonomous Claude Code routine. There is no human in the
loop during the run; the only deliverable that matters is a pull request
against `main` that fills missing translations correctly. Stop and report (do
not merge, do not push half-work) if any pre-push check fails after a
reasonable fix attempt.

### Goal

Detect every missing translation in the repo and translate it. Open one pull
request titled `chore(i18n): fill missing translations (<count> items)` from a
`claude/translations-<run-date>` branch with `Closes` set to nothing (no
backing issue) and a body that lists each touched locale with a per-locale
gap count.

If the detector reports zero gaps, exit cleanly with a short status message
and do **not** open a PR.

### Source of truth

`tools/src/detect-translation-gaps.mjs` defines what counts as a gap. Do not
re-implement gap detection — run the script.

Three gap types exist:

1. **XLIFF units** in `web/src/locale/messages.<lang>.xlf` with
   `state="initial"` and `<target>` equal to `<source>` (seeded fallbacks
   from `tools/src/sync-xliff-locales.mjs`).
2. **Missing `<lang>.md`** files in `content/blog/<folder>/`.
3. **Missing `<id>.<lang>.md`** files in `content/wiki/pushup-types/`.

The source locale is `de` (German). Target locales come from
`SUPPORTED_LOCALES` in `web/src/server-locale-redirect.ts` (the detector
reads this directly — do not hardcode the list).

### Steps

1. **Refresh i18n surface** so the detector sees the current state, not a
   stale snapshot:

   ```bash
   pnpm install --frozen-lockfile
   pnpm nx run web:extract-i18n
   node tools/src/sync-xliff-locales.mjs
   ```

2. **Detect gaps**:

   ```bash
   mkdir -p .claude-translations
   node tools/src/detect-translation-gaps.mjs \
     --report .claude-translations/prompt.md \
     --summary .claude-translations/summary.env \
     --json   .claude-translations/gaps.json
   ```

   Read `.claude-translations/prompt.md` — it contains the full per-gap
   inventory and the hard rules. Treat that report as authoritative for the
   list of items to translate.

   If `summary.env` shows `has_gaps=false`, post a one-line status and exit
   without opening a PR.

3. **Translate** from the German source (or, where missing, the English
   sibling). Keep meaning, tone, brevity, and any HTML/placeholders intact.

   Hard rules — copied verbatim from the report so they bind even when this
   prompt is run standalone:

   1. **Never edit `web/src/locale/messages.xlf`** — that file is
      auto-generated. Only edit `messages.<lang>.xlf` files.
   2. **Preserve XLIFF placeholders verbatim** (`<ph id="…"/>`, `<pc …>`,
      `INTERPOLATION`, `START_BLOCK_IF`, etc.) and keep them in the right
      order. Only the human-readable text between placeholders changes.
   3. **Flip XLIFF unit `state` from `initial` to `translated`** once you
      have written a real target. Leave `initial` only on units you could
      not translate — note them in the PR description.
   4. **Markdown frontmatter quoting.** Single-quoted YAML scalars require
      `''` to escape an apostrophe (`s'entraîner` → `'s''entraîner'`) or
      use double quotes. **List items containing `: ` must be quoted**
      (`- 'Word: rest of sentence'`) or YAML will parse them as a map and
      `loadPushupTypeContent` will reject the file. See
      `docs/gotchas/i18n.md` for both rules in detail.
   5. **After any content/markdown change**, run
      `pnpm nx run tools:generate-content` and commit the regenerated TS
      modules in the same PR.
   6. **Run `node tools/src/fix-translated-yaml.mjs`** before committing —
      it repairs the most common apostrophe error class automatically.
   7. **Do not invent push-up type ids, blog slugs, or XLIFF unit ids.**
      Only translate strings that already exist in the gap inventory.
   8. The blog `slug:` frontmatter field is per-locale and must be a
      URL-safe translation, not the German slug.
   9. Wiki entries are frontmatter-only — translate `name`, `summary`,
      every item in `instructions`, and every item in `tips`. Keep
      numeric/code values (`3×8`, `Tempo 3-1-1`) unchanged.

4. **Pre-push checks** (from `AGENTS.md` → Pre-Push Checklist):

   ```bash
   pnpm nx affected -t=lint,test,build -c=production --parallel=3
   ```

   If anything fails, attempt a targeted fix once. If it still fails, do
   not push — write a status comment summarising the failure and stop. A
   broken `main` is worse than a delayed translation.

5. **Commit and push** to `claude/translations-<YYYY-MM-DD>`:

   ```bash
   git checkout -b claude/translations-$(date -u +%F)
   git add web/src/locale/messages.*.xlf \
           content/blog content/wiki \
           web/src/content # regenerated by generate-content, if applicable
   git commit -m "chore(i18n): fill missing translations (<count> items)"
   git push -u origin "claude/translations-$(date -u +%F)"
   ```

   Stage files by name — never `git add -A` or `git add .`. The detector's
   artefacts under `.claude-translations/` are throwaway and must not be
   committed.

6. **Open a PR** against `main`. Body must include:

   - One bullet per touched locale: `- <locale>: <n> unit(s), <n> blog
     post(s), <n> wiki entry/entries`.
   - A "Skipped" section listing any item you could not translate, with
     a one-line reason each. **Never invent content** to avoid an empty
     skipped list.
   - The exact `detect-translation-gaps.mjs` summary line for traceability.

7. **Subscribe to the PR's activity** via `subscribe_pr_activity` so CI
   failures and review comments are picked up automatically — per
   `AGENTS.md` → Pull Requests.

### Skipped section format

If you cannot translate an item (context unclear, locale conventions
ambiguous, etc.), emit it under a `## Skipped` heading in the PR body:

```
## Skipped
- `fr` / `messages.fr.xlf` unit `app.legal.gdpr.clause-3`: term of art with
  no settled French equivalent in this product domain — leaving `initial`.
```

### Failure modes to surface explicitly

Do not silently continue past these. Each warrants an early stop with a
status comment:

- `pnpm install --frozen-lockfile` fails (lockfile drift): stop, report.
- `web:extract-i18n` fails: stop, report. Do not edit `messages.xlf` to
  work around it.
- More than 500 XLIFF units are seeded as gaps: likely a detector misfire
  or upstream regression. Translate the first 100, push, and call out the
  truncation in the PR body — do not attempt all 500 in one session.

---

## Setup

This file is the prompt only. To wire it up:

1. Open https://claude.ai/code/routines → **New routine** → **Remote**.
2. **Name:** `Translate XLIFF / content gaps`.
3. **Prompt:** paste the section above (everything from `You are running
   as an autonomous Claude Code routine` down to the trailing
   `---`).
4. **Repository:** `WolfSoko/pushup-stats-service`. Leave
   **Allow unrestricted branch pushes** off — the routine pushes to
   `claude/translations-<date>` only.
5. **Environment:** Default (Trusted) is enough. No extra secrets needed —
   no service account, no PAT, no Copilot dispatch token (that's the whole
   point of replacing the workflow).
6. **Connectors:** keep only the GitHub connector. Remove the rest — the
   routine should not need Slack, Drive, Calendar, etc.
7. **Trigger:** combined — _both_ of the following so the routine fires
   on schedule **and** reacts to fresh source strings:
   - **Schedule:** daily at **06:00 UTC** (matches the old cron
     `0 6 * * *`). Use `/schedule update` afterwards if a finer cron is
     needed; one-hour minimum applies.
   - **GitHub event:** push to `main` when any of these paths change —
     `web/src/locale/messages.xlf`, `content/blog/**`,
     `content/wiki/pushup-types/**`. This catches new German source
     content within minutes instead of waiting up to a day.

   The routine is idempotent (it exits without a PR when the detector
   reports zero gaps), so back-to-back runs on the same green state cost
   nothing.
8. **Run now** once after saving to confirm a green session against a
   known-empty gap state (should exit without opening a PR).

### Why not GitHub Actions any more?

The old workflow's only job was to detect gaps and hand them to the
GitHub Copilot coding agent. That indirection cost us a PAT
(`DEPLOY_PUSH_TOKEN`), a `replaceActorsForAssignable` GraphQL dance, and
an extra issue per run. A Claude routine just does the translation work
itself in the same session, so the dispatch hop is gone.

The detector (`tools/src/detect-translation-gaps.mjs`) and the seeder
(`tools/src/sync-xliff-locales.mjs`) are unchanged — they remain the
single source of truth for "what counts as a gap". Only the *driver* moved
from `.github/workflows/copilot-translations.yml` to this routine.
