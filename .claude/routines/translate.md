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

Detect every missing translation in the repo and translate it. Keep **exactly
one** open translation PR alive at any time, backed by a single long-lived
branch `claude/translations` (no date suffix). If that PR is already open,
**update it in place** — never open a second one. The PR is titled
`chore(i18n): fill missing translations (<count> items)`, has `Closes` set to
nothing (no backing issue), and a body that lists each touched locale with a
per-locale gap count.

Exit decision after gap detection:

- **No gaps and no open translation PR** → exit cleanly with a short status
  message; do **not** open a PR.
- **No new gaps but a translation PR is already open** → don't open a second
  PR or add an empty commit; just keep the branch current — re-push the step-2
  merge only if `main` advanced — so the open PR stays mergeable, then exit
  cleanly.
- **Gaps to fill** → translate them, then create the PR (none open) or push to
  `claude/translations` so the already-open PR updates.

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

1. **Find the existing translation PR — there must only ever be one.** Look
   for an **open** PR whose head branch is `claude/translations` (e.g.
   `list_pull_requests` filtered to `head: claude/translations`, state
   `open`), and check whether the branch exists on the remote:

   ```bash
   git fetch origin
   git ls-remote --heads origin claude/translations
   ```

   Note whether you are **reusing** an open PR/branch or **creating** a fresh
   one — later steps depend on it. If you ever find more than one open
   `chore(i18n): fill missing translations …` PR, keep the lowest-numbered one,
   close the rest with a comment pointing at the survivor, and converge back to
   a single PR.

2. **Check out the single working branch `claude/translations`:**

   - **Reusing** (branch exists) — check it out and bring it up to date with
     `main` by **merging** (never rebase or reset — a merge keeps every commit
     already on the PR, including human review corrections). If the merge
     conflicts, abort it and **stop and report** the conflict rather than
     discarding history; a human resolves it on the PR:

     ```bash
     git checkout -B claude/translations origin/claude/translations
     git merge --no-edit origin/main \
       || { git merge --abort; echo "merge conflict on claude/translations — stop and report, do NOT discard the branch"; exit 1; }
     ```

   - **Creating** (no branch yet) — start it from the tip of `main`:

     ```bash
     git checkout -B claude/translations origin/main
     ```

   Running the detector on this branch (not on `main`) means units already
   translated on the open PR keep `state="translated"` and are **not**
   re-flagged — only genuinely new gaps get picked up, and human corrections
   already pushed to the PR are preserved.

3. **Refresh the i18n surface** so the detector sees the current state, not a
   stale snapshot:

   ```bash
   pnpm install --frozen-lockfile
   pnpm nx run web:extract-i18n
   node tools/src/sync-xliff-locales.mjs
   ```

4. **Detect gaps**:

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

   Apply the exit decision from **Goal** using `summary.env`:

   - `has_gaps=false` **and no open translation PR** → post a one-line status
     and exit without opening a PR.
   - `has_gaps=false` **and a translation PR is already open** → do **not**
     open a second PR and do **not** create an empty translation commit. But
     if the step-2 merge moved `claude/translations` past its remote tip (i.e.
     `main` advanced), push the refreshed branch so the open PR is re-validated
     against `main` and stays mergeable — otherwise do nothing:

     ```bash
     git fetch origin claude/translations
     if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/claude/translations)" ]; then
       git push origin claude/translations
     fi
     ```

     Then exit. When the branch already matches its remote tip (`main` did not
     move) this is a no-op and the run costs nothing.
   - `has_gaps=true` → continue.

5. **Translate** from the German source (or, where missing, the English
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

6. **Pre-push checks** (from `AGENTS.md` → Pre-Push Checklist):

   ```bash
   pnpm nx affected -t=lint,test,build -c=production --parallel=3
   ```

   If anything fails, attempt a targeted fix once. If it still fails, do
   not push — write a status comment summarising the failure and stop. A
   broken `main` is worse than a delayed translation.

7. **Commit and push** to the single `claude/translations` branch:

   ```bash
   git add web/src/locale/messages.*.xlf \
           content/blog content/wiki \
           web/src/content # regenerated by generate-content, if applicable
   git commit -m "chore(i18n): fill missing translations (<count> items)"
   git push -u origin claude/translations
   ```

   Stage files by name — never `git add -A` or `git add .`. The detector's
   artefacts under `.claude-translations/` are throwaway and must not be
   committed. A plain push suffices: step 2 only ever **merges** into the
   branch (it never rewrites history), so your local tip stays ahead of the
   remote. If the push is rejected as non-fast-forward, another run pushed
   concurrently — stop and report instead of force-pushing.

8. **Open or update the single PR** against `main` — never create a second one:

   - **No PR open** → create it. Title `chore(i18n): fill missing translations
     (<count> items)`, where `<count>` is the number of translation items this
     branch adds over `main` (XLIFF units flipped to `translated` + new
     blog/wiki files).
   - **PR already open** → update the existing PR's title and body in place
     (e.g. `update_pull_request`) so the count and per-locale breakdown reflect
     the new state.

   The body (new or updated) must include:

   - One bullet per touched locale: `- <locale>: <n> unit(s), <n> blog
     post(s), <n> wiki entry/entries`.
   - A "Skipped" section listing any item you could not translate, with
     a one-line reason each. **Never invent content** to avoid an empty
     skipped list.
   - The exact `detect-translation-gaps.mjs` summary line for traceability.

9. **Subscribe to the PR's activity** via `subscribe_pr_activity` (only when
   you just created it) so CI failures and review comments are picked up
   automatically — per `AGENTS.md` → Pull Requests. When the PR finally merges,
   let it **delete** the `claude/translations` branch (squash + delete branch)
   so the next run starts clean from `main`.

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
   **Allow unrestricted branch pushes** off — the routine only ever pushes to
   the single `claude/translations` branch (plain fast-forward pushes; it
   merges `main` in rather than rewriting history, so no force-push is needed).
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
