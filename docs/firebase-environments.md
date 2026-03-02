# Firebase environments (toggle)

## Runtime modes

- **Real Firebase (default):**
  - `nx serve web -c development`
  - `nx build web -c production`
- **Local emulator mode:**
  - `nx serve web -c development-emulator`
  - `nx run data-store:emulate`

The toggle is implemented via file replacement of:

- `web/src/env/firebase-runtime.ts` (real)
- `web/src/env/firebase-runtime.emulator.ts` (emulator)

## Dedicated test/staging Firebase project

Use `staging` build config (for branches/PRs):

- `nx build web -c staging`
- `nx serve web -c staging`

`staging` replaces:

- `web/src/env/fire.config.ts` -> `web/src/env/fire.config.staging.ts`

> Set real staging Firebase credentials in `fire.config.staging.ts`.

## Suggested PR preview workflow

1. Create dedicated Firebase project (e.g. `pushup-stats-staging`).
2. Put staging credentials into `fire.config.staging.ts`.
3. Build with `nx build web -c staging` in CI.
4. Deploy to Firebase Hosting preview channels per PR:
   - `firebase hosting:channel:deploy pr-<number> --project <staging-project-id>`
