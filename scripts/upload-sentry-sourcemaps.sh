#!/usr/bin/env bash
# Upload source maps to Sentry and create a release with commit tracking.
#
# Per the Sentry Wizard guidance for Angular (sentry-cli ≥ 2.30):
#   1. inject debug IDs into JS bundles + source maps
#   2. upload them with the release tag
#   3. delete .map files so they don't ship to production
#
# Idempotent and safe to run anywhere:
#   - skips silently if SENTRY_AUTH_TOKEN is unset (so local builds + App Hosting
#     builds without secrets configured don't break)
#   - skips silently if dist/web doesn't exist (run before web build)
#
# Used by:
#   - GitHub Actions deploy (Firebase Hosting + Functions): pnpm sentry:sourcemaps
#   - Firebase App Hosting build (apphosting.yaml scripts.buildCommand)
#
# Org/project read from .sentryclirc.

set -euo pipefail

# --- Preconditions ---
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "[sentry] SENTRY_AUTH_TOKEN not set — skipping source map upload."
  exit 0
fi

if [ ! -d "dist/web" ]; then
  echo "[sentry] dist/web not found — run web build first. Skipping."
  exit 0
fi

# --- Resolve sentry-cli binary ---
# Prefer the pinned @sentry/cli devDep over `npx` (deterministic, no re-download).
if command -v pnpm >/dev/null 2>&1 && pnpm exec sentry-cli --version >/dev/null 2>&1; then
  SENTRY_CLI=(pnpm exec sentry-cli)
else
  SENTRY_CLI=(npx --yes @sentry/cli)
fi

RELEASE="${SENTRY_RELEASE:-$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")}"
export SENTRY_LOG_LEVEL="${SENTRY_LOG_LEVEL:-info}"

echo "[sentry] release: $RELEASE"
echo "[sentry] cli:     ${SENTRY_CLI[*]}"

# --- Release lifecycle ---
"${SENTRY_CLI[@]}" releases new "$RELEASE"

# Link commits for the "Suspect Commits" feature. --ignore-missing prevents the
# step from failing when the GitHub integration isn't configured in Sentry org
# settings (otherwise the deploy would fail on a non-critical link step).
"${SENTRY_CLI[@]}" releases set-commits "$RELEASE" --auto --ignore-missing

# --- Web (browser + SSR server) ---
# Inject runtime release ID into every HTML so main.ts can set Sentry.init({ release }).
# Both index.html and index.csr.html are touched: prerendered routes use index.html;
# SSR-only routes use index.csr.html as the SPA-shell template.
find dist/web/browser \( -name "index.html" -o -name "index.csr.html" \) \
  -exec sed -i "s|</head>|<script>globalThis.SENTRY_RELEASE=\"${RELEASE}\";</script></head>|" {} \;

# Inject debug IDs into JS bundles + .map files (matches errors to maps regardless of URL).
"${SENTRY_CLI[@]}" sourcemaps inject dist/web

# --strict: fail loudly if zero files are matched (silent skips were the historical bug).
"${SENTRY_CLI[@]}" sourcemaps upload \
  --release="$RELEASE" \
  --strict \
  dist/web

# --- Cloud Functions (optional, only if previously built) ---
if [ -d "data-store/functions-dist" ]; then
  "${SENTRY_CLI[@]}" sourcemaps inject data-store/functions-dist
  "${SENTRY_CLI[@]}" sourcemaps upload \
    --release="$RELEASE" \
    --strict \
    data-store/functions-dist

  # Strip .map files from the deploy bundle (functions don't need them at runtime).
  find data-store/functions-dist -name "*.map" -delete 2>/dev/null || true

  # Surface the release to runtime so Sentry.init() in functions can tag events.
  echo "SENTRY_RELEASE=$RELEASE" >> data-store/functions-dist/.env
  echo "[sentry] cloud functions: source maps uploaded, .map files stripped"
fi

# --- Cleanup ---
# Keep .map files out of the deployed web artifact (debug IDs are already injected
# into the JS, so Sentry no longer needs the maps to be reachable via URL).
find dist/web -name "*.map" -delete 2>/dev/null || true

# --- Finalize ---
"${SENTRY_CLI[@]}" releases finalize "$RELEASE"

echo "[sentry] release $RELEASE finalized"
