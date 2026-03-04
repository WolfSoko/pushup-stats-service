# Copilot Instructions for pushup-stats-service

This is an **Nx monorepo** for tracking push-up statistics. The primary frontend is an Angular SSR app with a NestJS API, backed by Firebase (Firestore + Auth). The default UI language is German.

## Repository Structure

```
web/          Angular SSR app (i18n: de + en)
api/          NestJS REST API  (GET /api/stats)
libs/
  auth/               Firebase Auth providers
  data-access/        Firestore data-access providers
  stats-models/       Shared TypeScript types/models
data-store/   Firebase emulator config & Firestore rules
reverse-proxy/ Express front-proxy (language routing)
tools/        Custom Nx executors and scripts
docs/         Architecture and environment documentation
```

## Development Commands

```bash
# Install dependencies
npm install

# Serve locally (starts Firebase emulators + web dev server)
npx nx run web:serve-local

# Serve individual apps
npx nx serve api
npx nx serve web

# Build all projects
npx nx run-many -t build

# Run all tests
npx nx run-many -t test

# Run affected tests only
npx nx affected -t test

# Lint
npx nx run-many -t lint
npx nx run-many -t lint --fix

# Build with coverage
npx nx run web:test --codeCoverage
```

Always prefix `nx` commands with `npx` (or the package manager) to avoid relying on a globally installed CLI.

## Build & Test Before Committing

Run this to verify your changes before committing:

```bash
npx nx affected -t lint test build
```

## Coding Standards

### Angular (web + libs)

- Use **standalone components** with an `imports` array — no `NgModule` declarations.
- Use **`loadComponent`** with dynamic imports for lazy-loaded routes.
- Use **Angular Signals** and `inject()` for dependency injection — never instantiate services with `new`.
- Mark translatable strings with `i18n="@@your.id"` (elements) or `$localize`:@@your.id:German text`` (programmatic).

### Testing

- **Always use `TestBed` or `@testing-library/angular`** (`render`) for Angular services, guards, and components — never instantiate with `new`.
- Write **Given-When-Then** style tests.
- Guards must be tested in a real Angular router/TestBed context.
- Mock providers via Angular DI (`{ provide: ..., useValue: ... }`).
- **Never** use `require()` or dynamic `import()` for mocks.
- Aim for maximum test coverage on new/changed code.
- Follow **TDD**: write a failing test (RED) before implementation (GREEN), then refactor.

### General

- Follow existing file structure and naming conventions.
- Prefer Nx generators/schematics for scaffolding new code.
- Keep Firestore security rules strict: only the authenticated owner (`auth.uid`) may read/write their own documents.

## i18n Workflow

Default locale: **`de`** (German). English translations live in `web/src/locale/messages.en.xlf`.

1. Mark strings in templates: `i18n="@@your.id"` or `$localize`:@@your.id:Deutschertext``.
2. Extract: `npx nx run web:extract-i18n`
3. Add English `<target>` entries in `web/src/locale/messages.en.xlf`.
4. Verify: `npx nx build web` — must complete with **no** `[WARNING] No translation found` lines.

## Firebase / Emulators

Local development uses Firebase Auth + Firestore emulators via the `data-store:serve` Nx target (started automatically by `web:serve-local`).

The `web` app switches between real Firebase and emulators via Nx `fileReplacements` in the `development-emulator` build configuration (`web/src/env/firebase-runtime.ts` → `firebase-runtime.emulator.ts`).

## Development Flow

1. Create/triage issue → add to **PUS Roadmap** project → Status = **Todo**.
2. When work starts: set Status = **In Progress**.
3. Open PR and link the issue with `Fixes #ID` / `Closes #ID`.
4. Add the PR to the project, set Status = **Review**.
5. On merge: issue auto-closes → set Status = **Done**.
