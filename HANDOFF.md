# Handoff — Training-plan hero images (PR #420)

> **Delete this file before merging.** It is a working note for resuming the task in a fresh Claude Code session, not a permanent doc.

Branch: `claude/eager-cray-sshIT` · PR: **#420** (https://github.com/WolfSoko/pushup-stats-service/pull/420)

## Goal

Add topical hero images to training plans, shown:

- on the **overview** (`/training-plans`) as a 16:9 card-media header, and
- on the **detail page** (`/training-plans/:slug`) as a hero `<figure>` with a photo credit.

Images come from **Unsplash** (the same CDN the blog already uses), hotlinked as `https://images.unsplash.com/photo-…?auto=format&fit=crop&w=1600&q=80`.

## What is already DONE and pushed

Commits on the branch (newest first):

- `0109ba0` Merge `origin/main` (resolved XLIFF conflicts by regenerating i18n)
- `d1f1a5e` fix: make hero image-error fallback reactive under OnPush (signals)
- `dfe96dd` feat: add topical hero images to overview and detail

State: **feature works, all CI green on the pre-merge commit, conflicts resolved, merge-ready.** Every plan currently uses a **blog-vetted Unsplash photo** (guaranteed to load), mapped by closest topic. ~5 of them are only an *approximate* topic match.

### Files changed

| File | Role |
|------|------|
| `libs/stats/src/lib/models/training-plan.models.ts` | `TrainingPlan` interface — added `heroImage?: string` and `heroImageCredit?: string` |
| `libs/stats/src/lib/models/training-plan.catalog.ts` | Per-plan `heroImage` URL + shared `UNSPLASH_CREDIT` ($localize `@@plan.heroImageCredit`) assigned to each plan's `heroImageCredit` |
| `web/src/app/training-plans/training-plans-page.component.ts` | Overview: `.card-media` `<img>` per card; `failedImages = signal(new Set<string>())`; `localizedPlans` now includes `heroImage` |
| `web/src/app/training-plans/training-plan-detail.component.ts` | Detail: `.plan-hero` `<figure>` + `<figcaption [innerHTML]>` credit; `heroImageFailed = signal(false)` |
| `*.spec.ts` (both components) | Tests: image renders w/ src+alt, and error event hides image (OnPush regression) |
| `web/src/locale/messages*.xlf` | Extracted/synced `@@plan.heroImageCredit` across all 10 locales |

### Current image → plan mapping (blog-vetted, in `training-plan.catalog.ts`)

| Plan (slug) | Current `photo-…` id | Topic fit |
|-------------|----------------------|-----------|
| recruit-6w | 1598971457999-ca4ef48a9a71 | progression ✔ |
| challenge-30d | 1596079306903-9164c205f400 | 30-day challenge ✔ |
| over-40-4w | 1638820858482-800bd51f63f1 | over 40 ✔ |
| daily-100-30d | 1598971639058-fab3c3109a00 | daily ✔ |
| one-arm-12w | 1731341400836-baaa5535b8d5 | "variations" (approx) |
| push-pull-6w | 1571019613454-1cb2f99b2d8b | strength/form (approx) |
| full-body-6w | 1514512364185-4c2b0985be01 | cardio/full-body (approx) |
| core-4w | 1599058917765-a780eda07a3e | floor/core (approx) |
| hiit-4w | 1548690312-e3b507d8c110 | intense (approx) |
| mobility-2w | 1518611012118-696072aa579a | calm (approx) |

## REMAINING TASK ("approach A"): swap to topic-exact photos + per-photographer credit

The user wants better-fitting, hand-picked Unsplash photos, **with proper per-photographer attribution** (current credit is a generic shared "Foto: Unsplash").

### The blocker (why it wasn't finished)

This web sandbox could not reach Unsplash to fetch verified hotlink URLs / photographer data:

- `WebFetch` on `unsplash.com` (and its `/oembed`) → **403** (Unsplash blocks Anthropic's fetcher; the sandbox allowlist does not affect WebFetch).
- Sandbox `curl` → **"Host not in allowlist"** for `unsplash.com`, `api.unsplash.com`, `images.unsplash.com`, `plus.unsplash.com`. (`registry.npmjs.org` returns 200, so general egress works — only Unsplash is blocked.)
- The CDN numeric id (`photo-1571019…`) is **not derivable** from a photo-page slug id (`…-3HnxyD3J1Qg`), so search results alone don't yield usable URLs.

A network-policy edit was attempted mid-session but did **not** take effect — these containers read the policy **at creation**, hence this handoff to a fresh session.

### To unblock, BEFORE starting the new session

Add to the environment's network allowlist (then start the new session so the container picks it up):

- **`api.unsplash.com`** — preferred. Official API; one call returns the verified URL **and** photographer name/profile. Requires a free Unsplash **Access Key**.
- *(optional)* **`unsplash.com`** — keyless `/oembed` fallback (rate-limited).

Verify in the new session:

```bash
curl -sS -m 15 -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0" \
  "https://api.unsplash.com/?client_id=YOUR_ACCESS_KEY"   # expect 200, not "Host not in allowlist"
```

### How to fetch verified data (once api.unsplash.com is reachable)

Search and read photos via the API (replace `YOUR_KEY`):

```bash
# search
curl -sS -H "Authorization: Client-ID YOUR_KEY" \
  "https://api.unsplash.com/search/photos?query=one%20arm%20push%20up&per_page=10&orientation=landscape"
# single photo (gives urls.raw + user.name + user.links.html + links.download_location)
curl -sS -H "Authorization: Client-ID YOUR_KEY" "https://api.unsplash.com/photos/PHOTO_ID"
```

From each chosen photo use:
- `urls.raw` → append `&auto=format&fit=crop&w=1600&q=80` for `heroImage`.
- `user.name` + `user.links.html` → photographer credit.
- Per Unsplash API guidelines, also trigger the download endpoint once: `GET links.download_location` with the same auth header.

### Search intents per plan (for picking topic-exact photos)

recruit-6w → beginner man push-ups · challenge-30d → energetic group/training · over-40-4w → mature/older man exercise · daily-100-30d → push-ups on floor · **one-arm-12w → one-arm push-up (sparse on Unsplash — may need Pexels or keep current)** · push-pull-6w → pull-up bar / back row · full-body-6w → full-body bodyweight/outdoor · core-4w → plank position · hiit-4w → burpee/battle-ropes/box-jump · mobility-2w → stretching / mobility.

Candidate photo PAGES already found via WebSearch (still need API/oembed to resolve to CDN urls + photographer):
- recruit: `unsplash.com/photos/a-man-doing-push-ups-on-a-gym-floor--7Gd6up6SHA` (Ahmed Zalabany)
- daily: `unsplash.com/photos/a-man-is-doing-push-ups-on-a-dirt-road-lFR7N0TCR_E` (Ryan Bridges)
- push-pull: `unsplash.com/photos/a-shirtless-man-hanging-upside-down-on-a-pull-up-bar-3HnxyD3J1Qg` (Shoham Avisrur)
- mobility: `unsplash.com/photos/a-shirtless-man-is-sitting-on-the-floor-RMdMGeAKNV4` (GMB Fitness)
- hiit: `unsplash.com/photos/woman-exercising-with-battle-ropes-in-gym-0dUkfS8KOxg`

### Recommended data-model change for per-photographer credit

Current: single shared `UNSPLASH_CREDIT` constant → every plan's `heroImageCredit` is identical ("Foto: Unsplash").

For per-photographer credit, prefer **structured, locale-independent** photographer data + a single localized "Foto:" label in the template (avoids 10 near-duplicate $localize units):

1. In `training-plan.models.ts`, replace `heroImageCredit?: string` with:
   ```ts
   heroImagePhotographer?: { name: string; profileUrl: string };
   ```
2. In `training-plan.catalog.ts`, drop `UNSPLASH_CREDIT`; set per plan, e.g.:
   ```ts
   heroImagePhotographer: { name: 'Ahmed Zalabany', profileUrl: 'https://unsplash.com/@ahmedzalabany' },
   ```
   (append `?utm_source=pushup_stats&utm_medium=referral` to the profile URL per Unsplash guidelines).
3. In `training-plan-detail.component.ts`, render the figcaption from the structured data with one i18n label:
   ```html
   <figcaption>
     <span i18n="@@trainingPlans.photoCreditPrefix">Foto:</span>
     <a [href]="p.heroImagePhotographer.profileUrl" target="_blank" rel="noopener noreferrer">{{ p.heroImagePhotographer.name }}</a>
     /
     <a href="https://unsplash.com/?utm_source=pushup_stats&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>
   </figcaption>
   ```
   Then remove the old `@@plan.heroImageCredit` usage. The detail spec asserts the figcaption contains `unsplash.com` — keep that true.

(If you'd rather keep it simple, just overwrite each plan's `heroImage` URL and leave the shared credit — less ideal attribution but minimal change.)

## Validate before pushing (project gates)

```bash
pnpm install --frozen-lockfile                      # node_modules is not committed
# after any $localize change:
pnpm exec nx run web:extract-i18n --tui=false --tuiAutoExit=true
node tools/src/sync-xliff-locales.mjs
# tests + lint:
pnpm exec nx test web --include="web/src/app/training-plans/**/*.spec.ts" --tui=false --tuiAutoExit=true
pnpm exec nx test stats-models --tui=false --tuiAutoExit=true
pnpm exec nx lint web --tui=false --tuiAutoExit=true
# i18n gate (all 10 locales) — slow (~4 min):
pnpm exec nx run web:build -c production --tui=false --tuiAutoExit=true
```

### Gotchas

- **Generated-file churn:** the production build rewrites `libs/stats/src/lib/models/exercise-wiki-content.generated.ts` with reordered keys. It is unrelated — revert it before committing:
  `git checkout -- libs/stats/src/lib/models/exercise-wiki-content.generated.ts`
- **Zoneless + OnPush:** both components are OnPush in a zoneless app. Any new error/UI state mutated from a template event must be a **signal** (already done for `heroImageFailed` / `failedImages`).
- **Project nx names:** the models lib is `stats-models`; the app is `web` (not `stats`).
- **i18n source is German.** `messages.xlf` is auto-generated — never hand-edit; run extract + `sync-xliff-locales.mjs`.

## Finishing up

- Push to `claude/eager-cray-sshIT` (updates PR #420). Pre-commit (husky/lint-staged) reformats staged files.
- Subscribe to PR activity, get CI green, resolve any CodeRabbit threads, then **squash-merge** (AGENTS.md).
- **Delete `HANDOFF.md`** as part of the final change.
