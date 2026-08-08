#!/usr/bin/env bash
# Download and extract the pre-built web artifact for the commit being deployed.
#
# App Hosting's builder (~8 GB RAM) cannot reliably run the full production
# web build (9-locale prerender + sourcemaps) and — separately — could never
# get the Nx Cloud remote cache to restore web:build:production either, so
# every deploy either deadlocked in esbuild or hung until the Cloud Build
# timeout. See docs/gotchas/build-and-tooling.md and docs/ci-cd.md.
#
# Structural fix: CI (.github/workflows/ci.yml publish-release job) builds
# web:build:production exactly once on a plain GitHub Actions runner and
# publishes it as a GitHub Release asset, tagged deterministically from the
# commit SHA. This script just downloads and extracts that asset — no Nx,
# no Angular build, no Node heap tuning needed here at all.
set -euo pipefail

REPO="WolfSoko/pushup-stats-service"
SHA=$(git rev-parse --short=7 HEAD)
TAG="deploy-0.0.0-${SHA}"
URL="https://github.com/${REPO}/releases/download/${TAG}/dist-web.tar.gz"

echo "[deploy] fetching build artifact for commit ${SHA} (tag ${TAG})"

if ! curl -fL "$URL" -o /tmp/dist-web.tar.gz; then
  echo "[deploy] ERROR: no release artifact found for commit ${SHA} (tag ${TAG})." >&2
  echo "[deploy] CI must publish a release before this commit can deploy — see the" >&2
  echo "[deploy] publish-release job in .github/workflows/ci.yml." >&2
  exit 1
fi

mkdir -p dist/web
tar -xzf /tmp/dist-web.tar.gz -C dist/web
rm -f /tmp/dist-web.tar.gz

echo "[deploy] extracted dist/web from ${TAG}"
