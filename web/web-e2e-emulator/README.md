# web-e2e-emulator

End-to-end tests for the flows that decide whether the app is usable at
all: registering, signing in, adding a friend and answering the request,
and working through a training session.

They are a separate project from `web/web-e2e` because they need a
backend. `web/web-e2e` runs the production SSR bundle, which talks to the
live Firebase project — there is no account to create there and no
friendship to accept. This suite instead runs

- `data-store:serve-e2e` — Auth, Firestore and Functions emulators, with
  the repository's own `firestore.rules`, so a rule that would refuse a
  write in production refuses it here too, and
- `web:serve-e2e-emulator` — the app built with
  `build:development-emulator`, which swaps `firebase-runtime.ts` for the
  emulator variant, on port 4302.

Playwright starts both (`webServer`), and `@nx/playwright/plugin` turns
those commands into Nx task dependencies, so one emulator and one app
server are shared by the whole run.

## Running

```bash
pnpm nx run web-e2e-emulator:e2e
```

Java is required — the Firestore emulator is a JAR.

## The second target: staging

The same specs also run against the deployed PR preview and the real
staging Firebase project, from the `build_and_preview` job in
`.github/workflows/firebase-hosting-pull-request.yml` — right after that
job has deployed the rules, the functions and the hosting channel it is
about to test.

```bash
E2E_TARGET=staging E2E_BASE_URL=https://…web.app pnpm nx run web-e2e-emulator:e2e-staging
```

What it buys over the emulator run: deployed `firestore.rules` rather
than locally evaluated ones, real callables with real cold starts, and
real composite indexes — a query missing an index passes against the
emulator and fails in production.

Two things follow from staging being a real, shared project:

- **Everything is cleaned up again.** `support/cleanup.ts` deletes the
  accounts a run created and the documents hanging off them. Accounts are
  matched on the run id stamped into their address, so two pull requests
  running at once cannot delete each other's data; anything older than a
  day is swept as well, which recovers the residue of a run that died
  before its teardown.
- **No extra credentials.** The Admin SDK uses the keyless Workload
  Identity credential the deploy steps already exported, and the job is
  gated to same-repo pull requests, so forks skip it.

The project name says `emulator` because that is its default target and
what gates every PR in `ci.yml`; the staging run is the same specs
pointed elsewhere.

## Writing tests

- Accounts come from `createAccount()` in `support/backend.ts`, which
  creates them through the Admin SDK against the Auth emulator. Every
  account gets a unique e-mail, so specs never collide over emulator
  state and nothing has to be wiped between them. The `test` fixture in
  `support/test-fixtures.ts` only hands out page objects.
- Sign in through the UI (`loginPage.signIn(...)`) rather than injecting
  a token: the login path is one of the things under test, and the app
  only runs its post-auth hooks on a real sign-in.
- Assert on `data-testid` attributes where they exist; they are part of
  the app's markup and survive copy changes.
