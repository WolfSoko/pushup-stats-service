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
# Idempotent: strip any prior SENTRY_RELEASE script tag before inserting the new one,
# so re-running the script doesn't accumulate duplicate tags in the same HTML.
find dist/web/browser \( -name "index.html" -o -name "index.csr.html" \) \
  -exec sed -i \
    -e 's|<script>globalThis\.SENTRY_RELEASE="[^"]*";</script>||g' \
    -e "s|</head>|<script>globalThis.SENTRY_RELEASE=\"${RELEASE}\";</script></head>|" \
    {} \;

# Skip inject/upload if no .map files remain in dist/web (e.g. a second run in the
# same workspace where cleanup already deleted them). With --strict the upload
# would otherwise abort the build for a no-op situation.
WEB_MAP_COUNT=$(find dist/web -name "*.map" -type f 2>/dev/null | wc -l)
if [ "$WEB_MAP_COUNT" -eq 0 ]; then
  echo "[sentry] dist/web has no .map files — already uploaded? skipping web upload."
else
  # Inject debug IDs into JS bundles + .map files (matches errors to maps regardless of URL).
  "${SENTRY_CLI[@]}" sourcemaps inject dist/web

  # --strict: fail loudly if zero files are matched (silent skips were the historical bug).
  "${SENTRY_CLI[@]}" sourcemaps upload \
    --release="$RELEASE" \
    --strict \
    dist/web
fi

# --- Cloud Functions (optional, only if previously built) ---
if [ -d "data-store/functions-dist" ]; then
  CF_MAP_COUNT=$(find data-store/functions-dist -name "*.map" -type f 2>/dev/null | wc -l)
  if [ "$CF_MAP_COUNT" -eq 0 ]; then
    echo "[sentry] data-store/functions-dist has no .map files — skipping CF upload."
  else
    "${SENTRY_CLI[@]}" sourcemaps inject data-store/functions-dist
    "${SENTRY_CLI[@]}" sourcemaps upload \
      --release="$RELEASE" \
      --strict \
      data-store/functions-dist

    # Strip .map files from the deploy bundle (functions don't need them at runtime).
    find data-store/functions-dist -name "*.map" -delete 2>/dev/null || true
    echo "[sentry] cloud functions: source maps uploaded, .map files stripped"
  fi

  # Surface the release to runtime so Sentry.init() in functions can tag events.
  # Replace any existing SENTRY_RELEASE line instead of appending — avoids
  # duplicate keys in .env if the script runs more than once on the same dist.
  ENV_FILE="data-store/functions-dist/.env"
  touch "$ENV_FILE"
  if grep -q '^SENTRY_RELEASE=' "$ENV_FILE"; then
    sed -i "s|^SENTRY_RELEASE=.*|SENTRY_RELEASE=$RELEASE|" "$ENV_FILE"
  else
    echo "SENTRY_RELEASE=$RELEASE" >> "$ENV_FILE"
  fi
fi

# --- Cleanup ---
# Keep .map files out of the deployed web artifact (debug IDs are already injected
# into the JS, so Sentry no longer needs the maps to be reachable via URL).
find dist/web -name "*.map" -delete 2>/dev/null || true

# --- Finalize ---
"${SENTRY_CLI[@]}" releases finalize "$RELEASE"

echo "[sentry] release $RELEASE finalized"
