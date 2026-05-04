# Leaderboard Rework — PR Plan

**Goal:** Drop anonymous leaderboard rows entirely and harden the leaderboard
against cheating and nonsense entries.

**Branch convention:** Each slice ships from its own branch into `main`. Slices
are ordered so each one is independently mergeable and produces user-visible
value on its own. Earlier slices unblock later ones but do not require them.

---

## Open product questions (decided during PR #281)

These thresholds drove validation rules. **Final values shipped in PR #281
are bolded; original suggestions kept in italics for traceability.**

- **Per-entry cap:** **500 reps** _(originally suggested 200 — raised to
  match the existing `QUICK_LOG_REPS_MAX = 500` so notification quick-log
  keeps working unchanged)_. Higher = more cheat surface, lower = false
  rejects. PR 6's daily cap is the real anti-cheat backstop.
- **Daily cap:** **2 000 reps** _(unchanged from suggestion)_ — well above
  realistic top-tier daily volume, still blocks "1 000 000 reps" griefing.
- **Min account age for leaderboard:** **not gated** _(originally suggested
  24h)_ — dropped together with the verified-email gate. Daily cap +
  display-name + admin shadow-ban cover the cheat surface; account-age
  gating can be added later if needed without schema changes.
- **Email-verified required for leaderboard:** **no** _(originally
  suggested yes)_ — explicitly dropped per the user's call. The full
  publicProfile opt-in (PR 4) plus admin shadow-ban (PR 5) was deemed
  enough; verified-email gating remains a future option.
- **Display-name policy:** **length 2–30 (after `.trim()`), charset
  `\p{L}\p{N} _.\-`** _(unchanged from suggestion)_. Profanity wordlist
  was deferred to follow-up issue #285.

Anything we'd want to revise: bump these values via a follow-up PR — the
constants live in `libs/stats/src/lib/models/{pushup,user-config}.models.ts`
and `data-store/functions/src/leaderboard/logic.ts` (daily cap), with
the Firestore rule mirroring them.

---

## PR 1 — Drop anonymous rows from the leaderboard

**Why first:** smallest, fully reversible behaviour change. Visible win on
day 1 (no more `anonym` clutter) and unblocks the rest of the work because the
leaderboard becomes a pure subset of opted-in, named users.

**Changes**

- `data-store/functions/src/leaderboard/logic.ts`
  - `rankEntries()`: skip users where `isLeaderboardNameAllowed(profile)` is
    `false` **or** `displayName` is missing/empty after trim.
  - Drop the `toAnonymousLabel` import and fallback — every returned entry
    now has a real alias.
- `data-store/functions/src/leaderboard/logic.spec.ts`
  - Replace existing "uses anonymous label for users without profiles" cases
    with "filters out users without profiles / opted out".
  - Keep the privacy-regression test (UID never on an anonymous-aliased row)
    but reframe: assert the row is **absent**, not anonymised.
- `web/src/app/leaderboard/shell/leaderboard-page.component.html`
  - Replace the explainer ("either anonymous or the user opted out…") with
    "Nur User mit öffentlichem Profilnamen erscheinen hier. In den
    Einstellungen aktivierbar." (i18n IDs reused; XLIFF gets a translation
    update).
- `web/src/app/leaderboard/shell/leaderboard-page.component.spec.ts`
  - Drop the `alias === 'anonym'` cases; add a "no entries shown" empty-state
    test if the list ends up empty.
- `web/src/locale/messages.xlf` + `messages.en.xlf`
  - Update copy strings.
- Optional: settings page hint — defer to PR 4 where verified-email also
  surfaces.

**Tests**: unit (logic), component (page), XLIFF lint. No new e2e needed.

**Migration**: none — the leaderboard rebuild Cloud Function picks the new
logic up on the next scheduled run.

---

## PR 2 — Server-side rep validation (per-entry plausibility)

**Why second:** stops new garbage from entering the system. Pure defense
layer, no UI change.

**Changes**

- `data-store/firestore.rules` — `match /pushups/{pushupId}` create + update:
  - `request.resource.data.reps is int`
  - `request.resource.data.reps > 0`
  - `request.resource.data.reps <= 200`
  - `request.resource.data.timestamp is timestamp`
  - `request.resource.data.timestamp <= request.time + duration.value(5, 'm')`
    (kein "in 3025 reps eintragen")
- Rules tests: add `data-store/firestore.rules.spec.ts` (or extend existing)
  using `@firebase/rules-unit-testing` — happy path + every reject path.
- Frontend `libs/data-access/src/lib/...pushup writes...`
  - Surface a friendly toast/snack-bar error on rule reject ("Maximal 200
    Reps pro Eintrag — bitte aufteilen.").
  - No new model fields.

**Tests**: rules-unit-testing matrix; one e2e/smoke that adds an entry > 200
and asserts the UI rejects gracefully.

**Migration**: existing data untouched. Outliers stay in history but new
ones are blocked.

---

## PR 3 — Display-name hygiene

**Why third:** with anonymous gone (PR 1), `displayName` is the only thing
the public sees on the leaderboard. It needs guardrails.

**Changes**

- `data-store/firestore.rules` — `match /userConfigs/{userId}` update:
  - When `displayName` is present: `is string`, `size() >= 2`, `size() <= 30`.
  - Charset check via `matches('^[\\p{L}\\p{N} _\\.\\-]+$')`.
- `data-store/functions/src/profile/` — new `displayNameValidator.ts`:
  - Same length/charset checks (rules can't easily do wordlists).
  - Starter profanity wordlist (DE + EN), externalised to a JSON so we can
    extend without code change.
  - Exposed as a callable `validateDisplayName` and called from a Firestore
    `onWrite` trigger on `userConfigs` — if the persisted value fails
    server-side validation (rule bypass via Admin SDK or wordlist hit), the
    trigger clears the field and writes a `userConfigs/{uid}.flags.nameReset`
    audit field.
- `web/src/app/settings/...` (find the right component during impl)
  - Inline validation before save, mirroring the rules + wordlist (call the
    callable for the wordlist part, debounce 300 ms).
- Admin UI (`web/src/app/admin/user-details-dialog.component.ts`)
  - "Display-Name zurücksetzen" button → calls a new admin Cloud Function
    `adminResetDisplayName` (custom-claim gated like the existing
    `adminDeleteUser`).

**Tests**: rules unit, validator unit (wordlist boundaries), trigger
integration (Jest + emulator), admin function unit.

**Migration**: one-shot script `scripts/reset-invalid-display-names.ts` to
sweep existing `userConfigs` and clear names that violate the new rules.
Document the invocation in `docs/gotchas/build-and-tooling.md`.

---

## PR 4 — Verified-email + min-account-age gate

**Why fourth:** raises the cost of throw-away cheat accounts. Builds on
PR 1's "real users only" stance.

**Changes**

- `data-store/functions/src/leaderboard/logic.ts`
  - `rankEntries()` accepts an additional per-user predicate
    (e.g. `isLeaderboardEligible(profile, authMeta)`).
- `data-store/functions/src/leaderboard/index.ts` (rebuild orchestrator)
  - Fetch `auth().getUsers([...uids])` in batches; pass `emailVerified` and
    `metadata.creationTime` into the predicate.
  - Filter out users where `emailVerified !== true`
    or `now - creationTime < 24h`.
- `web/src/app/settings/...`
  - New banner: "Verifiziere deine Email, um im Leaderboard zu erscheinen."
    Link triggers `sendEmailVerification()`.
  - Hide the banner once verified.
- i18n strings updated.

**Tests**: logic unit (predicate), index integration with mocked
`auth().getUsers`, component test for banner visibility.

**Migration**: next scheduled rebuild applies the filter automatically.
Communicate change in release notes since some users will silently drop off.

---

## PR 5 — Admin shadow-ban / leaderboard exclusion

**Why fifth:** the manual escape hatch. Reversible, no data loss. Becomes
necessary as soon as PR 1–4 are live and a determined cheater shows up.

**Changes**

- `libs/auth/...` or `libs/stats/...` model: extend `userConfigs` with
  optional top-level `leaderboardExcluded?: boolean` — admin-only.
- `data-store/firestore.rules`
  - Block client writes to `leaderboardExcluded` (mirror the existing
    `role` carve-out on `userConfigs`).
- `data-store/functions/src/admin/` — new callable
  `adminSetLeaderboardExclusion({ uid, excluded })` (custom-claim gated).
- `data-store/functions/src/leaderboard/logic.ts`
  - `rankEntries()` filters users with `leaderboardExcluded === true`.
- `web/src/app/admin/user-details-dialog.component.ts`
  - Toggle "Vom Leaderboard ausschließen" + reason text field; reason logged
    to a `moderationLog` collection (write-only via Admin SDK).

**Tests**: rules (write-block), admin function unit, logic unit, component
test.

---

## PR 6 — Daily cap (defense-in-depth)

**Why last:** PR 2 already blocks single-entry abuse; this catches the
"199 + 199 + 199 + …" attack. Cheaper to land after `userStats` aggregation
is in place (already is, per `data-store/functions/src/...userStats`).

**Changes**

- `data-store/functions/src/pushup/onCreate.ts` (new or extend existing
  trigger): on each new entry, read today's running total from
  `userStats/{uid}` (or recompute from `pushups` for the day). If the new
  entry would push it over **2 000**, mark the entry with
  `flags.dailyCapExceeded = true` and exclude it from leaderboard
  aggregation.
- Alternative (simpler): keep entry, but `rankEntries()` caps each user's
  daily contribution at 2 000 before slicing top N. Less surgical but no
  trigger needed. **Decide during implementation**, default to the simpler
  version.
- `data-store/functions/src/leaderboard/logic.ts` — apply the cap if we go
  with the simpler variant.

**Tests**: logic unit (cap is applied per user per day), trigger unit if we
take the trigger path.

---

## Roll-out order recap

```text
PR 1 (drop anonymous)
  └── PR 2 (per-entry cap)
        └── PR 3 (name hygiene)
              └── PR 4 (verified email gate)
                    └── PR 5 (admin exclusion)
                          └── PR 6 (daily cap)
```

Each PR is shippable on its own, but the chain reflects priority. PR 1–3 give
the biggest win for the smallest risk and could ship in one week.

## Cross-cutting concerns

- **i18n:** every user-facing string change updates `messages.xlf` and
  `messages.en.xlf` (see `docs/gotchas/i18n.md`).
- **Firestore rules:** every rules change ships with rules-unit-testing
  coverage (see `docs/ci-cd.md` for the rules test job).
- **Pre-push:** run
  `pnpm nx affected -t=lint,test,build -c=production --parallel=3` before
  every push.
- **Issue tracking:** create one issue per PR, add to **PUS Roadmap**, link
  via `Fixes #ID` in the PR body.
- **Docs:** if any PR introduces a non-obvious gotcha (rules quirks, trigger
  ordering, wordlist maintenance), capture it under `docs/gotchas/`.
