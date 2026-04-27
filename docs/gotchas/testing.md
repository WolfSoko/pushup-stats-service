# Gotchas: Testing

## Signal/mock isolation

- **Shared signal mocks:** When tests mutate shared `signal()` mocks (e.g. `authStoreMock.error.set(...)`), always reset them in `beforeEach`. Otherwise tests become order-dependent.
- **`window.location` spies:** `vitest.spyOn(window, 'location', 'get')` is NOT restored by `clearAllMocks()`. Add `afterEach(() => vitest.restoreAllMocks())` when using getter spies.

## Angular test patterns

- **`resource()` reload is async:** After calling `resource.reload()`, use `await fixture.whenStable()` before asserting on the reloaded data.
- **`MatDialog.open` spy:** Use `fixture.debugElement.injector.get(MatDialog)` (component injector) instead of `TestBed.inject(MatDialog)` to ensure you spy on the same instance the component uses.
- **Dialog components in `imports`:** Components only opened via `MatDialog.open()` do NOT belong in the host component's `imports` array (causes NG8113 warning). Keep them as TypeScript imports only.
- **Material disabled buttons + `user-event`:** Material adds `pointer-events: none` to disabled buttons, so `userEvent.click` throws. To assert "disabled button does not emit", set up the user once with the check disabled: `const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never })` and reuse `user` across the test.
- **`$localize` in Jest component tests:** Any Jest-test-runner lib whose components use `$localize` tagged templates needs `import '@angular/localize/init'` at the top of its `test-setup.ts`. Without it, all component specs in the lib crash. See `libs/auth/src/test-setup.ts` and `libs/quick-add/src/test-setup.ts`.

## Jest ↔ Firebase

- **`@angular/fire/firestore` import in Jest:** Importing the module at all triggers `fetch is not defined`. Always `jest.mock('@angular/fire/firestore', () => ({...}))` at the top of the file — see `pushup-firestore.service.spec.ts` for the pattern. Use `jest.mocked(getDoc)` instead of `jest.requireMock()` for type safety.
- **Cloud Function pure logic testing:** Extract business logic to separate modules (not in Cloud Function triggers) for testability. See `user-stats-delta.ts` pattern: pure functions tested separately via Jest without Firebase mocks; triggers are thin wrappers that call the logic. This enables testing calculation correctness without mocking Firestore.

## Versioned migrations

- **Version-based migrations:** When updating server-side calculation logic (e.g. UserStats), increment `USERSTATS_VERSION` constant. This triggers automatic rebuilds for affected users on their next entry. Tests must validate version is set correctly in rebuilt stats. See [`cloud-functions.md`](cloud-functions.md) for the versioning system.

## Vitest module mocks

- **`vi.mock` factories cannot close over module-scope variables.** Vitest hoists the factory above all imports, so any reference to outer `let`/`const` will be undefined at factory-eval time. To share a spy between the mocked module and the test, use `vi.hoisted`:
  ```ts
  const mocks = vi.hoisted(() => ({
    fooSpy: vi.fn<(arg: string) => unknown>(),
  }));
  vi.mock('some-pkg', () => ({
    foo: (arg: string) => mocks.fooSpy(arg),
  }));
  // Tests use mocks.fooSpy directly.
  ```
  Type the `vi.fn<Sig>()` explicitly — bare `vi.fn()` resolves to `Mock<Procedure | Constructable>`, which TS treats as not callable inside the mock factory.
- **`TestBed` providers do NOT reach a `createEnvironmentInjector` child.** When the SUT builds its own child env injector and resolves a service from it (e.g. to override a `providedIn: 'root'` service's options token at call-site), TestBed-level `{ provide: SomeService, useValue: ... }` is invisible. Mock the underlying module via `vi.mock` so the class instantiated inside the child injector is already the stub. Pattern in `goal-reached-dialog.component.spec.ts`.

## Nx test runner quirks

- **`web` test filter flags are not forwarded:** The `web:test` target uses the `@angular/build:unit-test` executor, which does NOT accept vitest CLI flags (`--testNamePattern`, `--testPathPattern`, `-t`). Running `pnpm exec vitest` directly inside `web/` also fails — it loses the Nx path aliases (`@pu-auth/auth`, `@pu-stats/models`, etc.) and every spec errors with `Cannot find package`. Either run the full `pnpm nx test web` suite, or move the spec into a library project whose test runner does accept filters. Use `--skip-nx-cache` to force a re-run when you just changed non-web code that a web spec depends on.
- **`tools/` Jest only transforms `.ts`/`.js`:** ESM `.mjs` scripts can be run by Nx targets but **cannot** be unit-tested by the shared Jest config. When a script needs coverage, write it as CommonJS `.js` with `module.exports = {...}`. See `tools/src/generate-sitemap.js` for the pattern.
