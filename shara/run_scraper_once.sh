#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PY="${VIRTUAL_ENV:-$ROOT_DIR/.venv}/bin/python"

exec "$VENV_PY" "$ROOT_DIR/sync_public_facebook_reels_nobrowser.py" --max-reels 20
