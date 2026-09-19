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

## Writing tests

- Accounts come from `createAccount()` in `support/emulator.ts`, which
  creates them through the Admin SDK against the Auth emulator. Every
  account gets a unique e-mail, so specs never collide over emulator
  state and nothing has to be wiped between them. The `test` fixture in
  `support/test-fixtures.ts` only hands out page objects.
- Sign in through the UI (`loginPage.signIn(...)`) rather than injecting
  a token: the login path is one of the things under test, and the app
  only runs its post-auth hooks on a real sign-in.
- Assert on `data-testid` attributes where they exist; they are part of
  the app's markup and survive copy changes.
