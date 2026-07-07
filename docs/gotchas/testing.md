# Gotchas: Testing

## The `web` runner shares one environment across every spec (`isolate: false`)

`@angular/build:unit-test` runs Vitest with **`isolate: false`** (a deliberate default, "to align with the Karma/Jasmine experience"). Every spec file in `web` therefore shares **one** module registry, one jsdom `document`, and one set of globals — there is no per-file reset beyond what Angular's TestBed cleanup hook does. Any module-level or global mutation a spec leaves behind bleeds into whatever spec runs next **in the same worker**, so the victim is order- and worker-distribution-dependent: the same code fails a _different, wandering_ set of tests each run, and adding/removing any unrelated spec can shift which one breaks. Isolated (single-file) runs are always green, which is the tell.

Consequences that have actually bitten us:

- **Un-restored global spies carry their call history into the next file.** `vi.spyOn(console, 'error')` that is never restored stays installed on the shared `console`. A _later_ `vi.spyOn(console, 'error')` in a different spec then returns **that same mock, call history included** — so an unrelated test sees a phantom `console.error` call it never made. Always pair a global spy (`console`, `window`, `document`, `navigator`) with `afterEach(() => spy.mockRestore())`. Real regression: `sentry.spec.ts`'s `initSentryLazily` block leaked its console spy and intermittently failed `DeferredSentryErrorHandler`.
- **`Functions` / Firebase DI split (`NG0201: No provider found for Functions`).** Never `vi.mock('@angular/fire/*')` in a `web` spec — see the dedicated note below. The admin surface injects the `CallableFunctionsService` seam instead.

The general rule: a `web` spec must leave the shared world exactly as it found it. Reset shared signal mocks in `beforeEach`, restore every global spy in `afterEach`, and never mutate a `providedIn: 'root'` singleton in place.

### The `web` setup file only runs if it is wired via `setupFiles`

`web/src/test-setup.ts` (canvas/`getContext` stub for ng2-charts, `IntersectionObserver` stub, locale registration, `process` polyfill) is listed in `tsconfig.spec.json` `files` **for type-checking only** — that does _not_ execute it at runtime. The `@angular/build:unit-test` builder runs a setup file only when it is named in the target's **`setupFiles`** option (`web/project.json` → `targets.test.options.setupFiles`). If a global stub "has no effect," check that wiring first: a `throw` added to `test-setup.ts` that does **not** fail the run proves the file is dead config.

## Signal/mock isolation

- **Shared signal mocks:** When tests mutate shared `signal()` mocks (e.g. `authStoreMock.error.set(...)`), always reset them in `beforeEach`. Otherwise tests become order-dependent.
- **`window.location` spies:** `vitest.spyOn(window, 'location', 'get')` is NOT restored by `clearAllMocks()`. Add `afterEach(() => vitest.restoreAllMocks())` when using getter spies.
- **`console`/global spies leak across files (`isolate: false`):** see the section above — an un-restored `vi.spyOn(console, …)` hands its call history to the next spec that spies on the same global. Always `mockRestore()` in `afterEach`.
- **ng2-charts jsdom noise:** `BaseChartDirective` calls `canvas.getContext('2d')` on construction; jsdom has no canvas backend and emits a "Not implemented: HTMLCanvasElement.prototype.getContext" error per chart. `test-setup.ts` stubs `getContext` to return `null` (the directive's `render()` already bails on a falsy context, so behaviour is unchanged) purely to keep that noise from drowning real failures in the log.

## Angular test patterns

- **`resource()` reload is async:** After calling `resource.reload()`, use `await fixture.whenStable()` before asserting on the reloaded data.
- **`MatDialog.open` spy:** Use `fixture.debugElement.injector.get(MatDialog)` (component injector) instead of `TestBed.inject(MatDialog)` to ensure you spy on the same instance the component uses.
- **Dialog components in `imports`:** Components only opened via `MatDialog.open()` do NOT belong in the host component's `imports` array (causes NG8113 warning). Keep them as TypeScript imports only.
- **Material disabled buttons + `user-event`:** Material adds `pointer-events: none` to disabled buttons, so `userEvent.click` throws. To assert "disabled button does not emit", set up the user once with the check disabled: `const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never })` and reuse `user` across the test.
- **`$localize` in Jest component tests:** Any Jest-test-runner lib whose components use `$localize` tagged templates needs `import '@angular/localize/init'` at the top of its `test-setup.ts`. Without it, all component specs in the lib crash. See `libs/auth/src/test-setup.ts` and `libs/quick-add/src/test-setup.ts`.

## Jest ↔ Firebase

- **`@angular/fire/firestore` import in Jest:** Importing the module at all triggers `fetch is not defined`. Always `jest.mock('@angular/fire/firestore', () => ({...}))` at the top of the file — see `pushup-firestore.service.spec.ts` for the pattern. Use `jest.mocked(getDoc)` instead of `jest.requireMock()` for type safety.
- **Don't reference module-level imports inside `jest.mock` factories.** `jest.mock(path, factory)` is hoisted above all imports, but the _factory body_ runs the first time the mocked module is `require()`'d. Anything that captures a same-file binding (e.g. `docData: jest.fn(() => of(undefined))` where `of` is imported from `rxjs` below) can evaluate before that import has been initialised under the CJS transform and crash the file. Either keep the factory bare and set the implementation in `beforeEach`:
  ```ts
  jest.mock('@angular/fire/firestore', () => ({
    Firestore: jest.fn(),
    docData: jest.fn(),
  }));
  // ...
  beforeEach(() => jest.mocked(docData).mockReturnValue(of(undefined) as never));
  ```
  …or `require()` the dependency inside the factory. Mirrors the Vitest `vi.hoisted` pattern below.
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

- **`vi.mock('@angular/fire/…')` is a landmine in the `web` build — DI-token identity splits with the spec-file set.** The esbuild unit-test bundler may inline a fire package into a shared chunk instead of leaving the bare import interceptable. The spec then gets the mocked module (e.g. a fake `Functions` class) while the component under test gets the real one from the chunk — DI fails with `NG0201: No provider found for Functions`, and _which_ spec breaks shifts whenever any spec file is added or removed anywhere in `web` (adding one unrelated empty spec broke 11 admin tests). Don't module-mock `@angular/fire/*` in `web` specs. Wrap the SDK call in a small injectable seam and fake that with a plain `useValue` provider — pattern: `CallableFunctionsService` (`web/src/app/admin/callable-functions.service.ts`) and the admin component specs.

- **`vi.mock` does NOT intercept workspace-internal library imports in the `web` esbuild unit-test build.** Only `node_modules` package mocks are intercepted by Vitest's module mock mechanism. If you `vi.mock('@pu-stats/…')` or any other `@pu-*/…` workspace path, the mock factory is registered but the real inlined import is used at runtime — the mocked function is never called. To unit-test a store or component path that resolves through a workspace-module function, introduce an Angular DI seam: an `InjectionToken` whose default factory returns the real function, then override it in `TestBed`. Real example: `TRAINING_PLAN_LOOKUP` token in `web/src/app/training-plans/training-plan.store.ts` (default factory `() => findPlanById`); tests override it with `{ provide: TRAINING_PLAN_LOOKUP, useValue: mockLookup }`.

## Nx test runner quirks

- **`web` test filter flags are not forwarded:** The `web:test` target uses the `@angular/build:unit-test` executor, which does NOT accept vitest CLI flags (`--testNamePattern`, `--testPathPattern`, `-t`). Running `pnpm exec vitest` directly inside `web/` also fails — it loses the Nx path aliases (`@pu-auth/auth`, `@pu-stats/models`, etc.) and every spec errors with `Cannot find package`. Either run the full `pnpm nx test web` suite, or move the spec into a library project whose test runner does accept filters. Use `--skip-nx-cache` to force a re-run when you just changed non-web code that a web spec depends on.
- **`tools/` Jest only transforms `.ts`/`.js`:** ESM `.mjs` scripts can be run by Nx targets but **cannot** be unit-tested by the shared Jest config. When a script needs coverage, write it as CommonJS `.js` with `module.exports = {...}`. See `tools/src/generate-sitemap.js` for the pattern.
