#!/bin/bash
# Upload source maps to Sentry after production build.
# Usage: SENTRY_AUTH_TOKEN=xxx bash scripts/upload-sentry-sourcemaps.sh
set -e

ORG="wolfram-sokollek-k4"
PROJECT="pushup-stats-service"
VERSION=$(node -p "require('./package.json').version")
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
RELEASE="${VERSION}-${GIT_SHA}"

echo "Uploading source maps for release $RELEASE..."

npx @sentry/cli releases new "$RELEASE" --org "$ORG" --project "$PROJECT"

# Browser source maps
npx @sentry/cli releases files "$RELEASE" upload-sourcemaps \
  dist/web/browser \
  --org "$ORG" --project "$PROJECT" \
  --url-prefix "~/" --rewrite

# SSR/Server source maps
if [ -d "dist/web/server" ]; then
  npx @sentry/cli releases files "$RELEASE" upload-sourcemaps \
    dist/web/server \
    --org "$ORG" --project "$PROJECT" \
    --url-prefix "~/" --rewrite
fi

npx @sentry/cli releases finalize "$RELEASE" --org "$ORG" --project "$PROJECT"

# Remove source maps from deploy artifact to prevent leaking
find dist/web/browser -name "*.map" -delete 2>/dev/null || true
find dist/web/server -name "*.map" -delete 2>/dev/null || true
echo "Source maps uploaded and removed from dist."
