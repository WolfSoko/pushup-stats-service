#!/usr/bin/env bash
set -u

PID_FILE="data-store/.firebase-emulators.pid"
PATTERN="firebase emulators:start --project demo-pushup-stats --only auth,firestore"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm -f "$PID_FILE"
    echo "Firebase emulators stopped (pid $PID)."
    exit 0
  fi

  rm -f "$PID_FILE"
fi

if pkill -f "$PATTERN" 2>/dev/null; then
  echo "Firebase emulators stopped via pkill."
  exit 0
fi

echo "No matching emulator process found."
exit 0
