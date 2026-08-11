#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${ROOT_DIR}/cpanel-deploy/${STAMP}"
ZIP_PATH="${ROOT_DIR}/cpanel-deploy/${STAMP}.zip"

FRONTEND_API_BASE_URL="${FRONTEND_API_BASE_URL:-${REACT_APP_API_BASE_URL:-}}"
ADMIN_API_BASE_URL="${ADMIN_API_BASE_URL:-${VITE_API_BASE_URL:-${FRONTEND_API_BASE_URL:-}}}"
ADMIN_BASE_PATH="${ADMIN_BASE_PATH:-${VITE_BASE_PATH:-/}}"

mkdir -p "${OUT_DIR}"

printf 'Preparing cPanel bundle in %s\n' "${OUT_DIR}"

if [ -n "${FRONTEND_API_BASE_URL}" ]; then
  printf 'Building storefront with REACT_APP_API_BASE_URL=%s\n' "${FRONTEND_API_BASE_URL}"
  (cd "${ROOT_DIR}/frontend" && REACT_APP_API_BASE_URL="${FRONTEND_API_BASE_URL}" npm run build)
else
  (cd "${ROOT_DIR}/frontend" && npm run build)
fi

if [ -n "${ADMIN_API_BASE_URL}" ] || [ "${ADMIN_BASE_PATH}" != "/" ]; then
  printf 'Building admin with VITE_API_BASE_URL=%s VITE_BASE_PATH=%s\n' "${ADMIN_API_BASE_URL}" "${ADMIN_BASE_PATH}"
  (cd "${ROOT_DIR}/admin" && VITE_API_BASE_URL="${ADMIN_API_BASE_URL}" VITE_BASE_PATH="${ADMIN_BASE_PATH}" npm run build)
else
  (cd "${ROOT_DIR}/admin" && npm run build)
fi

(cd "${ROOT_DIR}/backend" && npm run build)

mkdir -p "${OUT_DIR}/backend-app" "${OUT_DIR}/storefront-public" "${OUT_DIR}/admin-public"

cp -a "${ROOT_DIR}/backend/dist" "${OUT_DIR}/backend-app/dist"
cp -a "${ROOT_DIR}/backend/package.json" "${OUT_DIR}/backend-app/package.json"
cp -a "${ROOT_DIR}/backend/package-lock.json" "${OUT_DIR}/backend-app/package-lock.json"
cp -a "${ROOT_DIR}/backend/start.cjs" "${OUT_DIR}/backend-app/start.cjs"
cp -a "${ROOT_DIR}/backend/.env.cpanel.example" "${OUT_DIR}/backend-app/.env.example"

if [ -d "${ROOT_DIR}/backend/uploads" ]; then
  cp -a "${ROOT_DIR}/backend/uploads" "${OUT_DIR}/backend-app/uploads"
fi

if [ -d "${ROOT_DIR}/backend/email-assets" ]; then
  cp -a "${ROOT_DIR}/backend/email-assets" "${OUT_DIR}/backend-app/email-assets"
fi

if [ -d "${ROOT_DIR}/backend/sql" ]; then
  cp -a "${ROOT_DIR}/backend/sql" "${OUT_DIR}/backend-app/sql"
fi

cp -a "${ROOT_DIR}/frontend/build/." "${OUT_DIR}/storefront-public/"
cp -a "${ROOT_DIR}/admin/dist/." "${OUT_DIR}/admin-public/"
cp -a "${ROOT_DIR}/CPANEL_DEPLOY.md" "${OUT_DIR}/README.txt"
cp -a "${ROOT_DIR}/cpanel-root-htaccess.example" "${OUT_DIR}/root-htaccess.example"

if [ -f "${OUT_DIR}/storefront-public/.htaccess" ]; then
  mv "${OUT_DIR}/storefront-public/.htaccess" "${OUT_DIR}/storefront-public/.htaccess.react-only.example"
fi

rm -f "${ZIP_PATH}"
(cd "${ROOT_DIR}/cpanel-deploy" && zip -qr "${ZIP_PATH}" "${STAMP}")

printf 'Done. Bundle ready at %s\n' "${OUT_DIR}"
printf 'Zip ready at %s\n' "${ZIP_PATH}"
