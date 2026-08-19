#!/usr/bin/env bash
# Enable the Firestore TTL policies this project relies on. Idempotent — safe
# to run multiple times.
#
# WHY THIS EXISTS:
# `archiveDeletedExerciseEntry` copies every deleted `exerciseEntries` document
# into `deletedExerciseEntries` for traceability. The retention limit on that
# bin is a Firestore TTL policy on the `expiresAt` field, not a scheduled
# function — Firestore drops expired documents itself, at no invocation cost.
#
# TTL policies are project state, NOT part of `firestore.rules` /
# `firestore.indexes.json`, so `firebase deploy` does not create them. Without
# this script the archive grows forever and nothing enforces the 365 days.
#
# Note: expiry is not exact. Firestore deletes expired documents typically
# within 24 hours of `expiresAt`, and they remain readable/queryable until
# then. That slack is irrelevant for a year-long retention window.
#
# Prerequisites:
#   - gcloud CLI authenticated with Owner / datastore.indexAdmin on the project
#
# Usage:
#   ./infra/setup-firestore-ttl.sh                       # prod
#   ./infra/setup-firestore-ttl.sh --project my-staging  # another environment
#   ./infra/setup-firestore-ttl.sh --dry-run             # print, do not apply

set -euo pipefail

PROJECT="pushup-stats"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# collection-group:field pairs that must carry a TTL policy.
TTL_FIELDS=(
  "deletedExerciseEntries:expiresAt"
)

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "DRY-RUN: $*"
  else
    "$@"
  fi
}

echo "Enabling Firestore TTL policies on project '$PROJECT'"

for pair in "${TTL_FIELDS[@]}"; do
  collection="${pair%%:*}"
  field="${pair##*:}"
  echo "  - ${collection}.${field}"
  run gcloud firestore fields ttls update "$field" \
    --collection-group="$collection" \
    --project="$PROJECT" \
    --enable-ttl \
    --quiet
done

echo "Done. Verify with:"
for pair in "${TTL_FIELDS[@]}"; do
  collection="${pair%%:*}"
  echo "  gcloud firestore fields ttls list --collection-group=${collection} --project=${PROJECT}"
done
