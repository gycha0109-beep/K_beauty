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
service_role_key=""

while IFS='=' read -r raw_name raw_value; do
  name="${raw_name#export }"
  value="$(strip_quotes "${raw_value:-}")"
  case "${name}" in
    API_URL) api_url="${value}" ;;
    ANON_KEY) anon_key="${value}" ;;
    SERVICE_ROLE_KEY) service_role_key="${value}" ;;
  esac
done < <(npx --yes "supabase@${SUPABASE_CLI_VERSION}" status -o env --workdir "${WORKDIR}")

if [[ -z "${api_url}" || -z "${anon_key}" || -z "${service_role_key}" ]]; then
  printf '%s\n' "admin product review readiness failed: local Supabase environment unavailable" >&2
  exit 1
fi

health_ready=false
for _attempt in $(seq 1 60); do
  status="$(curl --silent \
    --connect-timeout 2 \
    --max-time 3 \
    --output /dev/null \
    --write-out '%{http_code}' \
    "${api_url}/auth/v1/health" \
    --header "apikey: ${anon_key}" || true)"

  if [[ "${status}" == "200" ]]; then
    health_ready=true
    break
  fi

  sleep 2
done

if [[ "${health_ready}" != "true" ]]; then
  printf '%s\n' "admin product review readiness failed: Auth health did not become ready" >&2
  exit 1
fi

sentinel_file="$(mktemp)"
sentinel_email="admin-product-review-readiness-$(date +%s)-${RANDOM}@example.test"
sentinel_payload="$(jq -cn \
  --arg email "${sentinel_email}" \
  '{email:$email,password:"Admin-product-review-readiness-42!",email_confirm:true}')"
write_ready=false
sentinel_id=""

for _attempt in $(seq 1 30); do
  status="$(curl --silent \
    --connect-timeout 2 \
    --max-time 8 \
    --output "${sentinel_file}" \
    --write-out '%{http_code}' \
    --request POST \
    "${api_url}/auth/v1/admin/users" \
    --header "apikey: ${service_role_key}" \
    --header "Authorization: Bearer ${service_role_key}" \
    --header 'Content-Type: application/json' \
    --data "${sentinel_payload}" || true)"

  if [[ "${status}" == "200" || "${status}" == "201" ]]; then
    sentinel_id="$(jq -r '.id // empty' "${sentinel_file}")"
    if [[ -n "${sentinel_id}" ]]; then
      write_ready=true
      break
    fi
  fi

  sleep 2
done

if [[ "${write_ready}" != "true" ]]; then
  rm -f "${sentinel_file}"
  printf '%s\n' "admin product review readiness failed: Auth admin write path did not become ready" >&2
  exit 1
fi

curl --silent \
  --connect-timeout 2 \
  --max-time 8 \
  --output /dev/null \
  --request DELETE \
  "${api_url}/auth/v1/admin/users/${sentinel_id}" \
  --header "apikey: ${service_role_key}" \
  --header "Authorization: Bearer ${service_role_key}" \
  || true
rm -f "${sentinel_file}"

exec bash scripts/verify-admin-product-review-runtime.sh "${WORKDIR}"
