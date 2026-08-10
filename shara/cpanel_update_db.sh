#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="$ROOT_DIR/.venv/bin/python"

cd "$ROOT_DIR"

if [[ ! -x "$VENV_PY" ]]; then
  echo "Missing virtualenv at $VENV_PY" >&2
  exit 1
fi

"$VENV_PY" "$ROOT_DIR/sync_public_facebook_reels.py" --max-reels 20
exec "$VENV_PY" "$ROOT_DIR/tag_reels_with_topics.py" --only-empty
