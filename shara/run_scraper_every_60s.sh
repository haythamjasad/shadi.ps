#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/haytham/Desktop/shadi-ps-github/Sharah"
VENV_PY="$ROOT_DIR/.venv/bin/python"
SCRAPER="$ROOT_DIR/sync_public_facebook_reels.py"
INTERVAL_SECONDS=60

while true; do
  "$VENV_PY" "$SCRAPER" --max-reels 20
  sleep "$INTERVAL_SECONDS"
done
