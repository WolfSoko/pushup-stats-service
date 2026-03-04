# Copilot Instructions for pushup-stats-service

Be as concise as possible; sacrifice grammar for the sake of conciseness.

Nx monorepo: Angular SSR frontend, NestJS API, Firebase (Firestore + Auth). Default UI language: German.

## Coding Standards

### Angular (web + libs)

- Use **standalone components** with an `imports` array — no `NgModule` declarations.
- Use **`loadComponent`** with dynamic imports for lazy-loaded routes.
- Use **Angular Signals** and `inject()` for dependency injection — never instantiate services with `new`.
- Mark translatable strings with `i18n="@@your.id"` (elements) or `$localize`:@@your.id:German text`` (programmatic).

### Testing

- **Always do Red Green Refactor 
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

## Development Flow

1. Create/triage issue → add to **PUS Roadmap** project → Status = **Todo**.
2. When work starts: set Status = **In Progress**.
3. Open PR and link the issue with `Fixes #ID` / `Closes #ID`.
4. Add the PR to the project, set Status = **Review**.
5. On merge: issue auto-closes → set Status = **Done**.
