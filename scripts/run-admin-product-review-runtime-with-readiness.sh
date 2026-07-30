#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${1:-tmp/admin-product-review-runtime}"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.109.1}"

strip_quotes() {
  local value="$1"
  value="${value#\"}"
  value="${value%\"}"
  printf '%s' "${value}"
}

api_url=""
anon_key=""

while IFS='=' read -r raw_name raw_value; do
  name="${raw_name#export }"
  value="$(strip_quotes "${raw_value:-}")"
  case "${name}" in
    API_URL) api_url="${value}" ;;
    ANON_KEY) anon_key="${value}" ;;
  esac
done < <(npx --yes "supabase@${SUPABASE_CLI_VERSION}" status -o env --workdir "${WORKDIR}")

if [[ -z "${api_url}" || -z "${anon_key}" ]]; then
  printf '%s\n' "admin product review readiness failed: local Supabase environment unavailable" >&2
  exit 1
fi

ready=false
for _attempt in $(seq 1 60); do
  status="$(curl --silent --show-error \
    --connect-timeout 2 \
    --max-time 3 \
    --output /dev/null \
    --write-out '%{http_code}' \
    "${api_url}/auth/v1/health" \
    --header "apikey: ${anon_key}" || true)"

  if [[ "${status}" == "200" ]]; then
    ready=true
    break
  fi

  sleep 2
done

if [[ "${ready}" != "true" ]]; then
  printf '%s\n' "admin product review readiness failed: Auth API did not become healthy" >&2
  exit 1
fi

exec bash scripts/verify-admin-product-review-runtime.sh "${WORKDIR}"
