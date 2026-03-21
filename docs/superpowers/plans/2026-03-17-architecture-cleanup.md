# Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the codebase so every service lives in its correct library boundary, ESLint module-boundary suppressions are gone, and cross-cutting modules (`ads`, `util/date`) are proper Nx libraries.

**Architecture:** Misplaced services (`UserContextService`, `LeaderboardService`, `SeoService`) are moved to the libraries that own them. The `ads/` folder becomes a proper Nx lib (`@pu-stats/ads`). The `util/date/` folder moves into `libs/stats/` and gains test coverage. All `eslint-disable @nx/enforce-module-boundaries` comments are removed.

**Tech Stack:** Angular 21, Nx 22, TypeScript 5.9, Jest 30, Firebase/Firestore, NgRx Signals, pnpm

---

## Context for Implementors

- **Monorepo root:** `/home/wolf/.openclaw/workspace/pushup-stats-service`
- **Path aliases in `tsconfig.base.json`:**
  - `@pu-stats/models` → `libs/stats/src/index.ts`
  - `@pu-stats/data-access` → `libs/data-access/src/index.ts`
  - `@pu-auth/auth` → `libs/auth/src/index.ts`
- **Run lint:** `npx nx run-many --target=lint --all`
- **Run tests:** `npx nx run-many --target=test --all`
- **Run build:** `npx nx run web:build`

Tasks are **logically independent** but two files are touched by multiple tasks — do not assign concurrent agents to the same file:

- `web/src/app/app.ts` — modified by Tasks 1, 4, and 5
- `web/src/app/stats/shell/stats-dashboard.component.ts` — modified by Tasks 1, 5, and 6

Recommended sequential order: 1 → 2 → 3 → 4 → 5 → 6. Each task ends with a commit.

---

## Task 1: Move `UserContextService` into `libs/auth/`

**Why:** `UserContextService` wraps `AuthStore` — it belongs in the auth lib, not the app root. This also eliminates the `eslint-disable` in its current location.

**Files:**

- Create: `libs/auth/src/lib/core/user-context.service.ts`
- Create: `libs/auth/src/lib/core/user-context.service.spec.ts`
- Modify: `libs/auth/src/index.ts` (add export)
- Delete: `web/src/app/user-context.service.ts`
- Delete: `web/src/app/user-context.service.spec.ts`
- Modify: `web/src/app/app.ts` (update import)
- Modify: `web/src/app/app.spec.ts` (update import)
- Modify: `web/src/app/stats/shell/settings-page.component.ts` (update import + remove eslint-disable for `AuthStore`)
- Modify: `web/src/app/stats/shell/stats-dashboard.component.ts` (update import)
- Modify: `web/src/app/stats/shell/stats-dashboard.component.spec.ts` (update import)
- Modify: `web/src/app/stats/components/stats-table/stats-table.component.ts` (update import)
- Modify: `web/src/app/stats/components/stats-table/stats-table.component.spec.ts` (update import)

- [ ] **Step 1: Create `libs/auth/src/lib/core/user-context.service.ts`**

```typescript
import { computed, inject, Injectable } from '@angular/core';
import { AuthStore } from './state/auth.store';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly authStore = inject(AuthStore);

  readonly userNameSafe = computed(() => {
    const user = this.authStore.user();
    return user?.displayName || user?.email || $localize`:@@user.guestName:Gast`;
  });

  readonly userIdSafe = computed(() => this.authStore.user()?.uid ?? '');
}
```

> Note: The import path for `AuthStore` uses a relative path since we are now inside the same lib. Remove the `eslint-disable` — it is no longer needed.

- [ ] **Step 2: Move the spec file**

Copy `web/src/app/user-context.service.spec.ts` to `libs/auth/src/lib/core/user-context.service.spec.ts`. Update the import path from `'./user-context.service'` to `'./user-context.service'` (same filename, different relative position — check the actual import in the spec and adjust accordingly).

- [ ] **Step 3: Export from `libs/auth/src/index.ts`**

Add this line to `libs/auth/src/index.ts`:

```typescript
export * from './lib/core/user-context.service';
```

- [ ] **Step 4: Update all callers — change import path**

In every file listed below, replace:

```typescript
import { UserContextService } from '../../user-context.service';
// or any relative path pointing to user-context.service
```

with:

```typescript
import { UserContextService } from '@pu-auth/auth';
```

Files to update:

- `web/src/app/app.ts`
- `web/src/app/app.spec.ts`
- `web/src/app/stats/shell/settings-page.component.ts`
- `web/src/app/stats/shell/stats-dashboard.component.ts`
- `web/src/app/stats/shell/stats-dashboard.component.spec.ts`
- `web/src/app/stats/components/stats-table/stats-table.component.ts`
- `web/src/app/stats/components/stats-table/stats-table.component.spec.ts`

- [ ] **Step 5: Remove `eslint-disable` from `settings-page.component.ts`**

In `web/src/app/stats/shell/settings-page.component.ts`, the `AuthStore` import currently has a suppression:

```typescript
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore } from '@pu-auth/auth';
```

Remove the `eslint-disable-next-line` comment. The import from `@pu-auth/auth` (the lib's public API) is valid per the current `depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]` in `eslint.config.mjs`.

- [ ] **Step 6: Delete the original files**

```bash
rm web/src/app/user-context.service.ts
rm web/src/app/user-context.service.spec.ts
```

- [ ] **Step 7: Verify lint and tests pass**

```bash
npx nx run-many --target=lint --all
npx nx run-many --target=test --all
```

Expected: no errors or failures.

- [ ] **Step 8: Commit**

```bash
git add libs/auth/src/lib/core/user-context.service.ts \
        libs/auth/src/lib/core/user-context.service.spec.ts \
        libs/auth/src/index.ts \
        web/src/app/app.ts \
        web/src/app/app.spec.ts \
        web/src/app/stats/shell/settings-page.component.ts \
        web/src/app/stats/shell/stats-dashboard.component.ts \
        web/src/app/stats/shell/stats-dashboard.component.spec.ts \
        web/src/app/stats/components/stats-table/stats-table.component.ts \
        web/src/app/stats/components/stats-table/stats-table.component.spec.ts
git rm web/src/app/user-context.service.ts web/src/app/user-context.service.spec.ts
git commit -m "refactor(auth): move UserContextService into libs/auth"
```

---

## Task 2: Move `LeaderboardService` into `libs/data-access/`

**Why:** `LeaderboardService` queries Firestore — data-access is exactly the right home. It also brings its types (`LeaderboardPeriod`, `LeaderboardEntry`, `LeaderboardBucket`, `LeaderboardData`) into the public lib API.

**Files:**

- Create: `libs/data-access/src/lib/api/leaderboard.service.ts`
- Modify: `libs/data-access/src/index.ts` (add export)
- Delete: `web/src/app/leaderboard.service.ts`
- Modify: `web/src/app/leaderboard/shell/leaderboard-page.component.ts` (update import)
- Modify: `web/src/app/marketing/shell/landing-page.component.ts` (update import)

> **Note:** `web/src/app/leaderboard.service.spec.ts` does not exist — no spec file needs to be moved.

- [ ] **Step 1: Create `libs/data-access/src/lib/api/leaderboard.service.ts`**

Copy the full content of `web/src/app/leaderboard.service.ts` verbatim into the new location. No changes needed to the code itself — its dependencies (`@angular/fire/auth`, `@angular/fire/firestore`) are already available in the data-access lib.

- [ ] **Step 2: Export from `libs/data-access/src/index.ts`**

Add this line:

```typescript
export * from './lib/api/leaderboard.service';
```

- [ ] **Step 3: Update callers**

In `web/src/app/leaderboard/shell/leaderboard-page.component.ts` and `web/src/app/marketing/shell/landing-page.component.ts`, replace:

```typescript
import { LeaderboardService, ... } from '../../leaderboard.service';
// or whatever relative path they use
```

with:

```typescript
import { LeaderboardService, LeaderboardData, LeaderboardEntry, LeaderboardBucket, LeaderboardPeriod } from '@pu-stats/data-access';
```

(Import only the names actually used in each file.)

- [ ] **Step 4: Delete the original**

```bash
git rm web/src/app/leaderboard.service.ts
```

- [ ] **Step 5: Verify**

```bash
npx nx run-many --target=lint --all
npx nx run-many --target=test --all
```

- [ ] **Step 6: Commit**

```bash
git add libs/data-access/src/lib/api/leaderboard.service.ts \
        libs/data-access/src/index.ts \
        web/src/app/leaderboard/shell/leaderboard-page.component.ts \
        web/src/app/marketing/shell/landing-page.component.ts
git rm web/src/app/leaderboard.service.ts
git commit -m "refactor(data-access): move LeaderboardService into libs/data-access"
```

---

## Task 3: Move `SeoService` to `web/src/app/core/`

**Why:** `SeoService` uses only Angular's `Title`, `Meta`, and `DOCUMENT` — it has no lib dependencies and is used only within the web app. It doesn't belong at the root of `app/`; a `core/` folder is the Angular convention for app-wide singleton utilities.

**Files:**

- Create: `web/src/app/core/seo.service.ts`
- Delete: `web/src/app/seo.service.ts`
- Modify: `web/src/app/app.ts` (update import)

- [ ] **Step 1: Create `web/src/app/core/seo.service.ts`**

Copy the full content of `web/src/app/seo.service.ts` verbatim.

- [ ] **Step 2: Update import in `web/src/app/app.ts`**

Replace:

```typescript
import { SeoService } from './seo.service';
```

with:

```typescript
import { SeoService } from './core/seo.service';
```

- [ ] **Step 3: Delete original**

```bash
git rm web/src/app/seo.service.ts
```

- [ ] **Step 4: Verify**

```bash
npx nx run-many --target=lint --all
npx nx run-build web:build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/core/seo.service.ts web/src/app/app.ts
git rm web/src/app/seo.service.ts
git commit -m "refactor(web): move SeoService to app/core"
```

---

## Task 4: Remove remaining `eslint-disable @nx/enforce-module-boundaries` comments

**Why:** The current `depConstraints` in `eslint.config.mjs` uses `{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }` which allows any project to import from any other. The disable comments predate this config and are now incorrect noise.

**Files:**

- Modify: `web/src/app/app.routes.ts` (remove lines 2-3)
- Modify: `web/src/app/app.ts` (remove the disable comment for `AuthStore` import)

- [ ] **Step 1: Remove from `app.routes.ts`**

Delete these two lines:

```typescript
// eslint-disable-next-line @nx/enforce-module-boundaries
```

(the one before `import { authGuard, publicOnlyGuard } from '@pu-auth/auth';`)

- [ ] **Step 2: Remove from `app.ts`**

Delete the `// eslint-disable-next-line @nx/enforce-module-boundaries` comment line before the `AuthStore` and `UserMenuComponent` import from `@pu-auth/auth`.

- [ ] **Step 3: Verify lint passes without the suppressions**

```bash
npx nx run-many --target=lint --all
```

Expected: no `@nx/enforce-module-boundaries` errors. If any appear, the `depConstraints` in `eslint.config.mjs` needs updating, not the disable comment.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/app.routes.ts web/src/app/app.ts
git commit -m "chore: remove unnecessary eslint-disable module-boundary comments"
```

---

## Task 5: Create `libs/ads/` Nx library and migrate ads module

**Why:** The ads module is used across feature boundaries (`stats-dashboard`, `landing-page`). Moving it to a proper lib gives it a clean public API, removes direct cross-feature imports, and places it at the same architectural level as `@pu-auth/auth` and `@pu-stats/data-access`.

**New path alias:** `@pu-stats/ads` → `libs/ads/src/index.ts`

**Component selector change:** `app-ad-slot` → `lib-ad-slot` (Nx lib prefix convention; only 2 template files need updating).

**Files to create (boilerplate):**

- `libs/ads/project.json`
- `libs/ads/README.md`
- `libs/ads/eslint.config.mjs`
- `libs/ads/jest.config.cts`
- `libs/ads/tsconfig.json`
- `libs/ads/tsconfig.lib.json`
- `libs/ads/tsconfig.spec.json`
- `libs/ads/src/test-setup.ts`
- `libs/ads/src/index.ts`

**Files to move:**

- `web/src/app/ads/ad-consent.service.ts` → `libs/ads/src/lib/ad-consent.service.ts`
- `web/src/app/ads/ad-consent.service.spec.ts` → `libs/ads/src/lib/ad-consent.service.spec.ts`
- `web/src/app/ads/ads-consent-state.service.ts` → `libs/ads/src/lib/ads-consent-state.service.ts`
- `web/src/app/ads/ads-config.service.ts` → `libs/ads/src/lib/ads-config.service.ts`
- `web/src/app/ads/google-ads.service.ts` → `libs/ads/src/lib/google-ads.service.ts`
- `web/src/app/ads/ad-slot.component.ts` → `libs/ads/src/lib/ad-slot.component.ts`
- `web/src/app/ads/ad-slot.component.spec.ts` → `libs/ads/src/lib/ad-slot.component.spec.ts`

**Files to delete:** entire `web/src/app/ads/` directory

**Files to modify:**

- `tsconfig.base.json` (add `@pu-stats/ads` path)
- `web/src/app/app.browser.config.ts` (update import)
- `web/src/app/app.ts` (update import for `AdsConsentStateService`)
- `web/src/app/stats/shell/stats-dashboard.component.ts` (update import)
- `web/src/app/stats/shell/stats-dashboard.component.spec.ts` (update import)
- `web/src/app/marketing/shell/landing-page.component.ts` (update import)
- `web/src/app/marketing/shell/landing-page.component.spec.ts` (update import)
- `web/src/app/stats/shell/stats-dashboard.component.html` (rename selector)
- `web/src/app/marketing/shell/landing-page.component.html` (rename selector)

- [ ] **Step 1: Create `libs/ads/project.json`**

```json
{
  "name": "stats-ads",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/ads/src",
  "prefix": "lib",
  "projectType": "library",
  "tags": [],
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/ads/jest.config.cts",
        "tsConfig": "libs/ads/tsconfig.spec.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

- [ ] **Step 2: Create `libs/ads/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "isolatedModules": true,
    "target": "es2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "emitDecoratorMetadata": false,
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  },
  "files": [],
  "include": [],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
```

- [ ] **Step 3: Create `libs/ads/tsconfig.lib.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts", "jest.config.ts", "jest.config.cts", "src/test-setup.ts"]
}
```

- [ ] **Step 4: Create `libs/ads/tsconfig.spec.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "commonjs",
    "target": "es2016",
    "types": ["jest", "node"],
    "moduleResolution": "node10"
  },
  "files": ["src/test-setup.ts"],
  "include": ["jest.config.ts", "src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

- [ ] **Step 5: Create `libs/ads/jest.config.cts`**

```javascript
module.exports = {
  displayName: 'stats-ads',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/libs/ads',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  snapshotSerializers: ['jest-preset-angular/build/serializers/no-ng-attributes', 'jest-preset-angular/build/serializers/ng-snapshot', 'jest-preset-angular/build/serializers/html-comment'],
  coverageReporters: ['text-summary', 'html', 'json-summary'],
};
```

- [ ] **Step 6: Create `libs/ads/eslint.config.mjs`**

```javascript
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'lib', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'lib', style: 'kebab-case' }],
    },
  },
  {
    files: ['**/*.html'],
    rules: {},
  },
];
```

- [ ] **Step 7: Create `libs/ads/src/test-setup.ts`**

```typescript
import 'jest-preset-angular/setup-jest';
```

- [ ] **Step 8: Move source files into `libs/ads/src/lib/`**

Copy each of these files verbatim (adjust intra-module relative imports only — all imports within the ads module remain relative to each other):

- `web/src/app/ads/ad-consent.service.ts` → `libs/ads/src/lib/ad-consent.service.ts`
- `web/src/app/ads/ad-consent.service.spec.ts` → `libs/ads/src/lib/ad-consent.service.spec.ts`
- `web/src/app/ads/ads-consent-state.service.ts` → `libs/ads/src/lib/ads-consent-state.service.ts`
- `web/src/app/ads/ads-config.service.ts` → `libs/ads/src/lib/ads-config.service.ts`
- `web/src/app/ads/google-ads.service.ts` → `libs/ads/src/lib/google-ads.service.ts`
- `web/src/app/ads/ad-slot.component.spec.ts` → `libs/ads/src/lib/ad-slot.component.spec.ts`

For `ad-slot.component.ts` → `libs/ads/src/lib/ad-slot.component.ts`, update the selector from `app-ad-slot` to `lib-ad-slot`:

```typescript
// Change this:
selector: 'app-ad-slot',
// To this:
selector: 'lib-ad-slot',
```

- [ ] **Step 9: Create `libs/ads/src/index.ts`**

```typescript
export * from './lib/ad-consent.service';
export * from './lib/ads-consent-state.service';
export * from './lib/ads-config.service';
export * from './lib/google-ads.service';
export * from './lib/ad-slot.component';
```

- [ ] **Step 10: Create `libs/ads/README.md`**

```markdown
# @pu-stats/ads

Google Ads integration for pushup-stats-service. Handles consent state, remote-config-driven enable/disable, and the ad-slot component.
```

- [ ] **Step 11: Add path alias to `tsconfig.base.json`**

In the `"paths"` section, add:

```json
"@pu-stats/ads": ["libs/ads/src/index.ts"]
```

> **Note:** This project has no root-level `tsconfig.json` with project references — Nx 22 auto-discovers `libs/ads/` via `project.json`. No additional tsconfig registration is needed.

- [ ] **Step 12: Update all callers to use `@pu-stats/ads`**

Replace any `import { ... } from '../../ads/...'` or `from '../ads/...'` in:

- `web/src/app/app.browser.config.ts`
- `web/src/app/app.ts`
- `web/src/app/stats/shell/stats-dashboard.component.ts`
- `web/src/app/stats/shell/stats-dashboard.component.spec.ts`
- `web/src/app/marketing/shell/landing-page.component.ts`
- `web/src/app/marketing/shell/landing-page.component.spec.ts`

with:

```typescript
import { AdSlotComponent, AdsConfigService, AdConsentService, AdsConsentStateService, GoogleAdsService } from '@pu-stats/ads';
```

(Import only the symbols each file actually uses.)

- [ ] **Step 13: Rename selector in templates**

In `web/src/app/stats/shell/stats-dashboard.component.html` and `web/src/app/marketing/shell/landing-page.component.html`, replace all occurrences of:

```html
<app-ad-slot
```

and

```html
</app-ad-slot>
```

with `lib-ad-slot`.

- [ ] **Step 14: Delete the original `web/src/app/ads/` directory**

```bash
git rm -r web/src/app/ads/
```

- [ ] **Step 15: Verify**

```bash
npx nx run-many --target=lint --all
npx nx run-many --target=test --all
```

- [ ] **Step 16: Commit**

```bash
git add libs/ads/ tsconfig.base.json \
        web/src/app/app.ts web/src/app/app.browser.config.ts \
        web/src/app/stats/shell/stats-dashboard.component.ts \
        web/src/app/stats/shell/stats-dashboard.component.html \
        web/src/app/stats/shell/stats-dashboard.component.spec.ts \
        web/src/app/marketing/shell/landing-page.component.ts \
        web/src/app/marketing/shell/landing-page.component.html \
        web/src/app/marketing/shell/landing-page.component.spec.ts
git rm -r web/src/app/ads/
git commit -m "refactor(ads): extract ads module into libs/ads (@pu-stats/ads)"
```

---

## Task 6: Move `util/date/` into `libs/stats/` and add unit tests

**Why:** Date utilities used by the stats feature belong in the stats lib. Currently they have no tests; adding tests here is required to meet the lib's 100% statement coverage threshold.

**Files:**

- Create: `libs/stats/src/lib/date/parse-iso-date.ts` (move)
- Create: `libs/stats/src/lib/date/to-local-iso-date.ts` (move)
- Create: `libs/stats/src/lib/date/create-week-range.ts` (move)
- Create: `libs/stats/src/lib/date/infer-range-mode.ts` (move)
- Create: `libs/stats/src/lib/date/range-modes.type.ts` (move)
- Create: `libs/stats/src/lib/date/parse-iso-date.spec.ts` (new tests)
- Create: `libs/stats/src/lib/date/to-local-iso-date.spec.ts` (new tests)
- Create: `libs/stats/src/lib/date/create-week-range.spec.ts` (new tests)
- Create: `libs/stats/src/lib/date/infer-range-mode.spec.ts` (new tests)
- Modify: `libs/stats/src/index.ts` (add exports)
- Delete: `web/src/app/util/` directory
- Modify: `web/src/app/stats/shell/stats-dashboard.component.ts` (update imports)
- Modify: `web/src/app/stats/components/filter-bar/filter-bar.component.ts` (update imports)

- [ ] **Step 1: Write failing tests for `parseIsoDate`**

Create `libs/stats/src/lib/date/parse-iso-date.spec.ts`:

```typescript
import { parseIsoDate } from './parse-iso-date';

describe('parseIsoDate', () => {
  it('returns a Date for a valid ISO date string', () => {
    const result = parseIsoDate('2024-03-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2024);
    expect(result?.getMonth()).toBe(2); // 0-indexed
    expect(result?.getDate()).toBe(15);
  });

  it('returns null for an empty string', () => {
    expect(parseIsoDate('')).toBeNull();
  });

  it('returns null when a segment is missing', () => {
    expect(parseIsoDate('2024-03')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx nx run stats-models:test --testFile=src/lib/date/parse-iso-date.spec.ts
```

Expected: `Cannot find module './parse-iso-date'`

- [ ] **Step 3: Copy `parse-iso-date.ts` to `libs/stats/src/lib/date/`**

```typescript
export function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx nx run stats-models:test --testFile=src/lib/date/parse-iso-date.spec.ts
```

Expected: PASS

- [ ] **Step 5: Write failing tests for `toLocalIsoDate`**

Create `libs/stats/src/lib/date/to-local-iso-date.spec.ts`:

```typescript
import { toLocalIsoDate } from './to-local-iso-date';

describe('toLocalIsoDate', () => {
  it('formats a date as YYYY-MM-DD using local time', () => {
    const date = new Date(2024, 2, 5); // March 5, 2024 (local)
    expect(toLocalIsoDate(date)).toBe('2024-03-05');
  });

  it('pads single-digit month and day with zero', () => {
    const date = new Date(2024, 0, 1); // January 1
    expect(toLocalIsoDate(date)).toBe('2024-01-01');
  });
});
```

- [ ] **Step 6: Copy `to-local-iso-date.ts` to `libs/stats/src/lib/date/`**

> **Cleanup:** The original file has a dead statement `date.toLocaleDateString()` whose return value is never used. Remove it during the move.

```typescript
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 7: Write failing tests for `createWeekRange`**

Create `libs/stats/src/lib/date/create-week-range.spec.ts`:

```typescript
import { createWeekRange } from './create-week-range';

describe('createWeekRange', () => {
  it('returns a range where to equals today in local ISO format', () => {
    const { from, to } = createWeekRange();
    const todayIso = to; // we trust the function for the date; check structure
    expect(todayIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a 7-day range (from is 6 days before to)', () => {
    const { from, to } = createWeekRange();
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    expect(diffDays).toBe(6);
  });
});
```

- [ ] **Step 8: Copy `create-week-range.ts` to `libs/stats/src/lib/date/`**

```typescript
import { toLocalIsoDate } from './to-local-iso-date';

export function createWeekRange(): { from: string; to: string } {
  const now = new Date();
  const to = toLocalIsoDate(now);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 6);
  const from = toLocalIsoDate(fromDate);
  return { from, to };
}
```

- [ ] **Step 9: Write failing tests for `inferRangeMode`**

Create `libs/stats/src/lib/date/infer-range-mode.spec.ts`:

```typescript
import { inferRangeMode } from './infer-range-mode';

describe('inferRangeMode', () => {
  it('returns "day" when from and to are the same date', () => {
    expect(inferRangeMode('2024-03-15', '2024-03-15')).toBe('day');
  });

  it('returns "week" for a 7-day range starting on Monday', () => {
    // 2024-03-11 is a Monday
    expect(inferRangeMode('2024-03-11', '2024-03-17')).toBe('week');
  });

  it('returns "month" for a full calendar month', () => {
    expect(inferRangeMode('2024-03-01', '2024-03-31')).toBe('month');
  });

  it('returns "custom" for an arbitrary range', () => {
    expect(inferRangeMode('2024-03-05', '2024-03-20')).toBe('custom');
  });

  it('returns "week" (default) for empty input', () => {
    expect(inferRangeMode('', '')).toBe('week');
  });
});
```

- [ ] **Step 10: Copy `infer-range-mode.ts` and `range-modes.type.ts` to `libs/stats/src/lib/date/`**

Verbatim copies. The relative imports within these files (`import { parseIsoDate } from './parse-iso-date'`) remain valid.

- [ ] **Step 11: Run all date tests**

```bash
npx nx run stats-models:test
```

Expected: all pass.

- [ ] **Step 12: Export from `libs/stats/src/index.ts`**

Add:

```typescript
export * from './lib/date/parse-iso-date';
export * from './lib/date/to-local-iso-date';
export * from './lib/date/create-week-range';
export * from './lib/date/infer-range-mode';
export * from './lib/date/range-modes.type';
```

- [ ] **Step 13: Update callers to use `@pu-stats/models`**

In `web/src/app/stats/shell/stats-dashboard.component.ts` and `web/src/app/stats/components/filter-bar/filter-bar.component.ts`, replace:

```typescript
import { createWeekRange } from '../../../util/date/create-week-range';
import { inferRangeMode } from '../../../util/date/infer-range-mode';
// etc — all util/date imports
```

with:

```typescript
import { createWeekRange, inferRangeMode, RangeModes } from '@pu-stats/models';
// (use only what each file needs)
```

- [ ] **Step 14: Delete `web/src/app/util/`**

```bash
git rm -r web/src/app/util/
```

- [ ] **Step 15: Verify**

```bash
npx nx run-many --target=lint --all
npx nx run-many --target=test --all
```

- [ ] **Step 16: Commit**

```bash
git add libs/stats/src/lib/date/ libs/stats/src/index.ts \
        web/src/app/stats/shell/stats-dashboard.component.ts \
        web/src/app/stats/components/filter-bar/filter-bar.component.ts
git rm -r web/src/app/util/
git commit -m "refactor(stats): move util/date into libs/stats, add unit tests"
```

---

## Final Verification

After all 6 tasks are complete:

- [ ] Run full lint: `npx nx run-many --target=lint --all`
- [ ] Run full test suite: `npx nx run-many --target=test --all`
- [ ] Run production build: `npx nx run web:build`
- [ ] Confirm zero `eslint-disable @nx/enforce-module-boundaries` comments remain in the codebase:
  ```bash
  grep -r "eslint-disable.*module-boundaries" web/src/ libs/
  ```
  Expected: no output.

---

## Summary of Architecture After Cleanup

| Library             | Path alias              | Contents                                                 |
| ------------------- | ----------------------- | -------------------------------------------------------- |
| `libs/stats`        | `@pu-stats/models`      | Models, types, date utilities                            |
| `libs/auth`         | `@pu-auth/auth`         | Auth service, guards, stores, UI, **UserContextService** |
| `libs/data-access`  | `@pu-stats/data-access` | Firestore API services, **LeaderboardService**           |
| `libs/ads`          | `@pu-stats/ads`         | Google Ads consent, config, AdSlotComponent              |
| `web/src/app/core/` | (app-internal)          | **SeoService** (app-level singleton)                     |
