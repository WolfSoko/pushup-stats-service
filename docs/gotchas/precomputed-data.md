# Gotchas: Precomputed Data & Period Keys

## Validate period keys before trusting precomputed values

When stores consume server-side precomputed data (e.g. `UserStats`), **always validate period keys** before trusting the values. The precomputed doc is only updated on writes, so it goes stale on period rollover without new entries.

| Field           | Validation                                 |
| --------------- | ------------------------------------------ |
| `dailyReps`     | `dailyKey === toBerlinIsoDate(new Date())` |
| `weeklyReps`    | `weeklyKey === currentIsoWeekKey()`        |
| `monthlyReps`   | `monthlyKey === currentMonthKey()`         |
| `currentStreak` | `lastEntryDate` is today or yesterday      |

Fall back to client-side computation when keys are stale.

## Timestamp format

Entry timestamps are stored as ISO strings:

- **New entries** include the browser's local timezone offset, e.g. `2026-04-05T22:50+02:00`.
- **Older entries** may lack the offset, e.g. `2026-04-05T22:50`.

The Cloud Function's `berlinParts()` handles both:

- Offset-less timestamps → treated as Berlin local time.
- Timestamps with explicit offsets → converted to Berlin via `Intl`.

Always use `appendLocalOffset()` when creating new timestamps from `<input type="datetime-local">` values.

## Period keys in rebuilt stats

UserStats rebuilds with `version: USERSTATS_VERSION` — the rebuild sets period keys for **TODAY**, not the last entry date. This ensures client-side period-key validation matches. Old stats (v1/v2) may have incorrect period keys; they auto-rebuild on next entry when version is detected as outdated. See [`cloud-functions.md`](cloud-functions.md) for the versioning system.
