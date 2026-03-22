#!/bin/bash
# Upload source maps to Sentry after production build.
# Usage: SENTRY_AUTH_TOKEN=xxx bash scripts/upload-sentry-sourcemaps.sh
set -e

ORG="wolfram-sokollek-k4"
PROJECT="pushup-stats-service"
VERSION=$(node -p "require('./package.json').version")

echo "Uploading source maps for version $VERSION..."

npx @sentry/cli releases new "$VERSION" --org "$ORG" --project "$PROJECT"

npx @sentry/cli releases files "$VERSION" upload-sourcemaps \
  dist/web/browser \
  --org "$ORG" --project "$PROJECT" \
  --url-prefix "~/" --rewrite

npx @sentry/cli releases finalize "$VERSION" --org "$ORG" --project "$PROJECT"

# Remove source maps from deploy artifact to prevent leaking
find dist/web/browser -name "*.map" -delete
echo "Source maps uploaded and removed from dist."
