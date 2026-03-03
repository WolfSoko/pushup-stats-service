# Firebase environments (toggle)

## Runtime modes

- **Real Firebase (default / Durchstich):**
  - `nx run web:serve-live`
  - `nx serve web -c development`
  - `nx build web -c production`
- **Local emulator mode (one command):**
  - `nx run web:serve-local`
  - (optional direct) `nx serve web -c development-emulator`

`web:serve-local` startet über NX automatisch die Emulatoren (`data-store:serve`) als Dependency.

## Emulator control

- Start emulator manually: `nx run data-store:emulate`
- Smoke test: `nx run data-store:emulate:smoke`
- Stop running emulator stack: `nx run data-store:emulate:stop`

`emulate:stop` beendet den laufenden Emulator-Prozess über PID-Datei (`data-store/.firebase-emulators.pid`) und hat einen `pkill`-Fallback.

## Runtime toggle implementation

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
