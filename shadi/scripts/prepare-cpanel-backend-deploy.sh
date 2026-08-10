#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${ROOT_DIR}/cpanel-backend/${STAMP}"
APP_DIR="${OUT_DIR}/backend-app"
ZIP_PATH="${ROOT_DIR}/cpanel-backend/${STAMP}.zip"

mkdir -p "${APP_DIR}"

printf 'Building shadi backend for cPanel in %s\n' "${APP_DIR}"

(cd "${ROOT_DIR}/backend" && npm run build)

cp -a "${ROOT_DIR}/backend/dist" "${APP_DIR}/dist"
cp "${ROOT_DIR}/backend/package.json" "${APP_DIR}/package.json"
cp "${ROOT_DIR}/backend/package-lock.json" "${APP_DIR}/package-lock.json"
cp "${ROOT_DIR}/backend/.env.example" "${APP_DIR}/.env.example"

cat > "${APP_DIR}/app.js" <<'EOF'
require('./dist/index.js')
EOF

rm -f "${ZIP_PATH}"
(cd "${ROOT_DIR}/cpanel-backend" && zip -qr "${ZIP_PATH}" "${STAMP}")

printf 'Done. Backend folder: %s\n' "${APP_DIR}"
printf 'Done. Backend zip: %s\n' "${ZIP_PATH}"
