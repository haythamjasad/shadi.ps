#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="${DEPLOY_STAMP:-$(date +%Y%m%d-%H%M%S)}"
OUT_BASE="${CPANEL_OUT_BASE:-${ROOT_DIR}/cpanel-deploy}"
OUT_DIR="${OUT_BASE}/${STAMP}"
ZIP_PATH="${OUT_BASE}/${STAMP}.zip"
STORE_BUILD_DIR="${OUT_DIR}/.build-store"
ADMIN_BUILD_DIR="${OUT_DIR}/.build-admin"
BACKEND_BUILD_DIR="${OUT_DIR}/.build-backend"

STORE_API_BASE_URL="${STORE_API_BASE_URL:-https://store.shadi.ps/api/v01}"
STORE_PUBLIC_BASE_URL="${STORE_PUBLIC_BASE_URL:-https://store.shadi.ps}"
ADMIN_API_BASE_URL="${ADMIN_API_BASE_URL:-${STORE_API_BASE_URL}}"
ADMIN_PUBLIC_BASE_URL="${ADMIN_PUBLIC_BASE_URL:-${STORE_PUBLIC_BASE_URL}}"
ADMIN_BASE_PATH="${ADMIN_BASE_PATH:-/}"

mkdir -p "${OUT_DIR}"
rm -rf "${STORE_BUILD_DIR}" "${ADMIN_BUILD_DIR}" "${BACKEND_BUILD_DIR}"

printf 'Preparing cPanel deploy bundle: %s\n' "${OUT_DIR}"
printf 'Store API: %s\n' "${STORE_API_BASE_URL}"
printf 'Admin API: %s\n' "${ADMIN_API_BASE_URL}"

printf '\n[1/4] Building store frontend...\n'
(
  cd "${ROOT_DIR}/store/frontend"
  CI=false \
  BUILD_PATH="${STORE_BUILD_DIR}" \
  REACT_APP_API_BASE_URL="${STORE_API_BASE_URL}" \
  REACT_APP_PUBLIC_BASE_URL="${STORE_PUBLIC_BASE_URL}" \
  npm run build
)

printf '\n[2/4] Building admin frontend...\n'
(
  cd "${ROOT_DIR}/admin/frontend"
  VITE_API_BASE_URL="${ADMIN_API_BASE_URL}" \
  VITE_PUBLIC_BASE_URL="${ADMIN_PUBLIC_BASE_URL}" \
  VITE_BASE_PATH="${ADMIN_BASE_PATH}" \
  npm run build -- --outDir "${ADMIN_BUILD_DIR}" --emptyOutDir
)

printf '\n[3/4] Building backend...\n'
(
  cd "${ROOT_DIR}/store/backend"
  mkdir -p "${BACKEND_BUILD_DIR}"
  npx esbuild src/index.js --bundle --platform=node --format=cjs --outfile="${BACKEND_BUILD_DIR}/index.js"
  node -e "require('fs').writeFileSync(process.argv[1], JSON.stringify({type:'commonjs'}))" "${BACKEND_BUILD_DIR}/package.json"
)

printf '\n[4/4] Packing cPanel folders...\n'
mkdir -p "${OUT_DIR}/backend-app" "${OUT_DIR}/storefront-public" "${OUT_DIR}/admin-public"

cp -a "${BACKEND_BUILD_DIR}" "${OUT_DIR}/backend-app/dist"
cp -a "${ROOT_DIR}/store/backend/package.json" "${OUT_DIR}/backend-app/package.json"
cp -a "${ROOT_DIR}/store/backend/package-lock.json" "${OUT_DIR}/backend-app/package-lock.json"
cp -a "${ROOT_DIR}/store/backend/start.cjs" "${OUT_DIR}/backend-app/start.cjs"
cp -a "${ROOT_DIR}/store/backend/.env.cpanel.example" "${OUT_DIR}/backend-app/.env.example"
cp -a "${ROOT_DIR}/store/backend/src" "${OUT_DIR}/backend-app/src"
cp -a "${ROOT_DIR}/store/backend/scripts" "${OUT_DIR}/backend-app/scripts"

for optional_dir in uploads email-assets sql pdf vendor; do
  if [ -d "${ROOT_DIR}/store/backend/${optional_dir}" ]; then
    cp -a "${ROOT_DIR}/store/backend/${optional_dir}" "${OUT_DIR}/backend-app/${optional_dir}"
  fi
done

for optional_file in composer.json composer.lock; do
  if [ -f "${ROOT_DIR}/store/backend/${optional_file}" ]; then
    cp -a "${ROOT_DIR}/store/backend/${optional_file}" "${OUT_DIR}/backend-app/${optional_file}"
  fi
done

cp -a "${STORE_BUILD_DIR}/." "${OUT_DIR}/storefront-public/"
cp -a "${ADMIN_BUILD_DIR}/." "${OUT_DIR}/admin-public/"
cp -a "${ROOT_DIR}/store/cpanel-root-htaccess.example" "${OUT_DIR}/root-htaccess.example"

cat > "${OUT_DIR}/README-cpanel.txt" <<EOF
cPanel deploy bundle
Created: ${STAMP}

Upload targets:
- storefront-public/ -> store.shadi.ps document root (public_html or store subdomain root)
- admin-public/ -> admin.shadi.ps document root
- backend-app/ -> cPanel Node.js application root

Recommended cPanel Node.js settings:
- Application mode: Production
- Application root: backend-app
- Application URL / PassengerBaseURI: /api/v01
- Startup file: start.cjs

Backend setup after upload:
1. Create backend-app/.env from backend-app/.env.example.
2. Set NODE_ENV=production and API_PREFIX_PROD=/api/v01.
3. Set HOST_API_URL_PROD=${STORE_API_BASE_URL}.
4. Set BASE_URL_PROD=${STORE_PUBLIC_BASE_URL}.
5. Set CORS_ORIGIN=https://store.shadi.ps,https://admin.shadi.ps.
6. Run inside backend-app: npm install --omit=dev
7. Import backend-app/sql/update-existing-db.sql for an existing database, or schema.sql for a fresh database.
8. Restart the Node.js app in cPanel.

Important:
- Do not delete live backend-app/.env or backend-app/uploads during updates.
- Keep the cPanel Passenger block in the store document-root .htaccess.
- Use root-htaccess.example as a merge reference, not as a blind replacement.

Quick checks:
- https://store.shadi.ps/api/v01/health
- https://store.shadi.ps
- https://admin.shadi.ps
EOF

rm -f "${ZIP_PATH}"
rm -rf "${STORE_BUILD_DIR}" "${ADMIN_BUILD_DIR}" "${BACKEND_BUILD_DIR}"
(
  cd "${OUT_BASE}"
  zip -qr "${ZIP_PATH}" "${STAMP}"
)

printf '\nDone.\nFolder: %s\nZip: %s\n' "${OUT_DIR}" "${ZIP_PATH}"
