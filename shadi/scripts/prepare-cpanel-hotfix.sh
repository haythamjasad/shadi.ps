#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
CPANEL_API_URL="${CPANEL_API_URL:-https://shadi.ps/api/v0}"
DEFAULT_OUTPUT_BASE="${ROOT_DIR}/cpanel-hotfix"
FALLBACK_OUTPUT_BASE="${ROOT_DIR}/cpanel-hotfix-builds"
OUTPUT_BASE="${CPANEL_OUTPUT_DIR:-}"

if [[ -z "${OUTPUT_BASE}" ]]; then
  if [[ -d "${DEFAULT_OUTPUT_BASE}" && ! -w "${DEFAULT_OUTPUT_BASE}" ]]; then
    OUTPUT_BASE="${FALLBACK_OUTPUT_BASE}"
  else
    OUTPUT_BASE="${DEFAULT_OUTPUT_BASE}"
  fi
fi

OUT_DIR="${OUTPUT_BASE}/${STAMP}"
ZIP_PATH="${OUTPUT_BASE}/${STAMP}.zip"

validate_domain_api_url() {
  local url="$1"

  if [[ ! "$url" =~ ^https?:// ]]; then
    printf 'Error: CPANEL_API_URL must start with http:// or https://\n' >&2
    exit 1
  fi

  if [[ "$url" =~ localhost|127\.0\.0\.1|::1 ]]; then
    printf 'Error: CPANEL_API_URL must use a public domain, not localhost.\n' >&2
    exit 1
  fi

  if [[ "$url" =~ ^https?://([0-9]{1,3}\.){3}[0-9]{1,3}(:|/|$) ]]; then
    printf 'Error: CPANEL_API_URL must use a domain name, not a local/private IP.\n' >&2
    exit 1
  fi
}

validate_domain_api_url "${CPANEL_API_URL}"

mkdir -p "${OUT_DIR}/public_html-hotfix"

printf 'Building shadi frontend hotfix in %s\n' "${OUT_DIR}"
printf 'Using backend API URL: %s\n' "${CPANEL_API_URL}"

(cd "${ROOT_DIR}/frontend" && VITE_BASE_PATH=./ VITE_CPANEL_HOTFIX=1 VITE_API_URL="${CPANEL_API_URL}" npm run build)

cp -a "${ROOT_DIR}/frontend/dist/." "${OUT_DIR}/public_html-hotfix/"

rm -f "${ZIP_PATH}"
(cd "${OUTPUT_BASE}" && zip -qr "${ZIP_PATH}" "${STAMP}")

printf 'Done. Hotfix folder: %s\n' "${OUT_DIR}/public_html-hotfix"
printf 'Done. Hotfix zip: %s\n' "${ZIP_PATH}"
