# Gotchas: Testing

## Signal/mock isolation

- **Shared signal mocks:** When tests mutate shared `signal()` mocks (e.g. `authStoreMock.error.set(...)`), always reset them in `beforeEach`. Otherwise tests become order-dependent.
- **`window.location` spies:** `vitest.spyOn(window, 'location', 'get')` is NOT restored by `clearAllMocks()`. Add `afterEach(() => vitest.restoreAllMocks())` when using getter spies.

## Angular test patterns

- **`resource()` reload is async:** After calling `resource.reload()`, use `await fixture.whenStable()` before asserting on the reloaded data.
- **`MatDialog.open` spy:** Use `fixture.debugElement.injector.get(MatDialog)` (component injector) instead of `TestBed.inject(MatDialog)` to ensure you spy on the same instance the component uses.
- **Dialog components in `imports`:** Components only opened via `MatDialog.open()` do NOT belong in the host component's `imports` array (causes NG8113 warning). Keep them as TypeScript imports only.

## Jest ↔ Firebase

- **`@angular/fire/firestore` import in Jest:** Importing the module at all triggers `fetch is not defined`. Always `jest.mock('@angular/fire/firestore', () => ({...}))` at the top of the file — see `pushup-firestore.service.spec.ts` for the pattern. Use `jest.mocked(getDoc)` instead of `jest.requireMock()` for type safety.
- **Cloud Function pure logic testing:** Extract business logic to separate modules (not in Cloud Function triggers) for testability. See `user-stats-delta.ts` pattern: pure functions tested separately via Jest without Firebase mocks; triggers are thin wrappers that call the logic. This enables testing calculation correctness without mocking Firestore.

## Versioned migrations

- **Version-based migrations:** When updating server-side calculation logic (e.g. UserStats), increment `USERSTATS_VERSION` constant. This triggers automatic rebuilds for affected users on their next entry. Tests must validate version is set correctly in rebuilt stats. See [`cloud-functions.md`](cloud-functions.md) for the versioning system.

## Nx test runner quirks

- **`web` test filter flags are not forwarded:** The `web:test` target uses the `@angular/build:unit-test` executor, which does NOT accept vitest CLI flags (`--testNamePattern`, `--testPathPattern`, `-t`). Running `pnpm exec vitest` directly inside `web/` also fails — it loses the Nx path aliases (`@pu-auth/auth`, `@pu-stats/models`, etc.) and every spec errors with `Cannot find package`. Either run the full `pnpm nx test web` suite, or move the spec into a library project whose test runner does accept filters. Use `--skip-nx-cache` to force a re-run when you just changed non-web code that a web spec depends on.
- **`tools/` Jest only transforms `.ts`/`.js`:** ESM `.mjs` scripts can be run by Nx targets but **cannot** be unit-tested by the shared Jest config. When a script needs coverage, write it as CommonJS `.js` with `module.exports = {...}`. See `tools/src/generate-sitemap.js` for the pattern.
