#!/bin/bash
# Upload source maps to Sentry and create a release with commit tracking.
# Requires SENTRY_AUTH_TOKEN env var. Org/project read from .sentryclirc.
# Usage: pnpm sentry:sourcemaps
set -e

RELEASE=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "Sentry release -- version: $RELEASE"

# --- Release lifecycle ---
# Create a new release (idempotent — safe to re-run).
npx sentry-cli releases new "$RELEASE"

# Link commits so Sentry can identify suspect commits for errors.
npx sentry-cli releases set-commits "$RELEASE" --auto

# --- Source maps ---
# Inject SENTRY_RELEASE into browser HTML so the SDK picks it up at runtime.
# Production build outputs localized dirs (de/, en/) each with index.html
# and possibly index.csr.html (prerendered client-side fallback pages).
find dist/web/browser \( -name "index.html" -o -name "index.csr.html" \) \
  -exec sed -i "s|</head>|<script>globalThis.SENTRY_RELEASE=\"${RELEASE}\";</script></head>|" {} \;

# Inject debug IDs into JS bundles and their .map files.
# This lets Sentry match errors to source maps without relying on release alone.
npx sentry-cli sourcemaps inject dist/web

# Upload source maps (browser + server) with release association.
npx sentry-cli sourcemaps upload \
  --release="$RELEASE" \
  dist/web

# Delete .map files so they are not shipped to production.
find dist/web -name "*.map" -delete 2>/dev/null || true

# --- Finalize release ---
# Marks the release as complete. Enables release health tracking
# (crash-free sessions/users) in Sentry.
npx sentry-cli releases finalize "$RELEASE"

echo "Release $RELEASE created, source maps uploaded, and cleaned up."
