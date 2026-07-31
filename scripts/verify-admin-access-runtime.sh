#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${1:?usage: verify-admin-access-runtime.sh <isolated-supabase-workdir>}"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.109.1}"
TEMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

fail() {
  printf 'admin access runtime verification failed: %s\n' "$1" >&2
  exit 1
}

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

[[ -n "${api_url}" ]] || fail "missing API_URL"
[[ -n "${anon_key}" ]] || fail "missing ANON_KEY"
[[ -n "${service_role_key}" ]] || fail "missing SERVICE_ROLE_KEY"

request_status() {
  local output_file="$1"
  shift
  curl --silent --show-error \
    --connect-timeout 5 \
    --max-time 20 \
    --output "${output_file}" \
    --write-out '%{http_code}' \
    "$@"
}

assert_success() {
  local status="$1"
  local label="$2"
  case "${status}" in
    200|201|204) ;;
    *) fail "${label} returned HTTP ${status}" ;;
  esac
}

assert_denied() {
  local status="$1"
  local label="$2"
  case "${status}" in
    200|201|204) fail "${label} unexpectedly succeeded" ;;
    *) ;;
  esac
}

create_user() {
  local email="$1"
  local app_metadata_json="$2"
  local output_file="${TEMP_DIR}/create-${email//[^a-zA-Z0-9]/_}.json"
  local payload
  local status

  payload="$(jq -cn \
    --arg email "${email}" \
    --arg password 'Admin-runtime-test-42!' \
    --argjson app_metadata "${app_metadata_json}" \
    '{email:$email,password:$password,email_confirm:true,app_metadata:$app_metadata}')"

  status="$(request_status "${output_file}" \
    --request POST \
    "${api_url}/auth/v1/admin/users" \
    --header "apikey: ${service_role_key}" \
    --header "Authorization: Bearer ${service_role_key}" \
    --header 'Content-Type: application/json' \
    --data "${payload}")"
  assert_success "${status}" "create user ${email}"

  jq -er '.id' "${output_file}" || fail "create user ${email} returned no id"
}

login_user() {
  local email="$1"
  local output_file="${TEMP_DIR}/login-${email//[^a-zA-Z0-9]/_}.json"
  local payload
  local status

  payload="$(jq -cn \
    --arg email "${email}" \
    --arg password 'Admin-runtime-test-42!' \
    '{email:$email,password:$password}')"

  status="$(request_status "${output_file}" \
    --request POST \
    "${api_url}/auth/v1/token?grant_type=password" \
    --header "apikey: ${anon_key}" \
    --header 'Content-Type: application/json' \
    --data "${payload}")"
  assert_success "${status}" "login user ${email}"

  jq -er '.access_token' "${output_file}" || fail "login user ${email} returned no token"
}

rpc_call() {
  local token="$1"
  local function_name="$2"
  local payload="$3"
  local output_file="$4"

  request_status "${output_file}" \
    --request POST \
    "${api_url}/rest/v1/rpc/${function_name}" \
    --header "apikey: ${token}" \
    --header "Authorization: Bearer ${token}" \
    --header 'Content-Type: application/json' \
    --data "${payload}"
}

rest_call() {
  local token="$1"
  local method="$2"
  local path="$3"
  local payload="$4"
  local output_file="$5"

  local arguments=(
    --request "${method}"
    "${api_url}/rest/v1/${path}"
    --header "apikey: ${token}"
    --header "Authorization: Bearer ${token}"
    --header 'Content-Type: application/json'
  )

  if [[ -n "${payload}" ]]; then
    arguments+=(--data "${payload}")
  fi

  request_status "${output_file}" "${arguments[@]}"
}

owner_email="owner-admin-runtime@example.test"
viewer_email="viewer-admin-runtime@example.test"
premium_email="premium-admin-runtime@example.test"

owner_id="$(create_user "${owner_email}" '{}')"
viewer_id="$(create_user "${viewer_email}" '{}')"
premium_id="$(create_user \
  "${premium_email}" \
  '{"premium_entitlement":"admin_override","role":"admin","admin":true}')"

bootstrap_output="${TEMP_DIR}/bootstrap-owner.json"
bootstrap_status="$(rpc_call \
  "${service_role_key}" \
  "bootstrap_first_admin_owner" \
  "$(jq -cn --arg user_id "${owner_id}" '{p_user_id:$user_id}')" \
  "${bootstrap_output}")"
assert_success "${bootstrap_status}" "bootstrap first owner"
[[ "$(jq -r '.role' "${bootstrap_output}")" == "admin_owner" ]] || fail "bootstrap did not create admin_owner"

second_bootstrap_output="${TEMP_DIR}/bootstrap-second.json"
second_bootstrap_status="$(rpc_call \
  "${service_role_key}" \
  "bootstrap_first_admin_owner" \
  "$(jq -cn --arg user_id "${viewer_id}" '{p_user_id:$user_id}')" \
  "${second_bootstrap_output}")"
assert_denied "${second_bootstrap_status}" "second owner bootstrap"

viewer_membership_output="${TEMP_DIR}/viewer-membership.json"
viewer_membership_status="$(rest_call \
  "${service_role_key}" \
  POST \
  "admin_memberships" \
  "$(jq -cn --arg user_id "${viewer_id}" '{user_id:$user_id,role:"admin_viewer",is_active:true}')" \
  "${viewer_membership_output}")"
assert_success "${viewer_membership_status}" "create viewer membership"

owner_token="$(login_user "${owner_email}")"
viewer_token="$(login_user "${viewer_email}")"
premium_token="$(login_user "${premium_email}")"

owner_role_output="${TEMP_DIR}/owner-role.json"
owner_role_status="$(rpc_call "${owner_token}" get_current_admin_role '{}' "${owner_role_output}")"
assert_success "${owner_role_status}" "owner role lookup"
[[ "$(jq -r '.' "${owner_role_output}")" == "admin_owner" ]] || fail "owner role lookup mismatch"

viewer_role_output="${TEMP_DIR}/viewer-role.json"
viewer_role_status="$(rpc_call "${viewer_token}" get_current_admin_role '{}' "${viewer_role_output}")"
assert_success "${viewer_role_status}" "viewer role lookup"
[[ "$(jq -r '.' "${viewer_role_output}")" == "admin_viewer" ]] || fail "viewer role lookup mismatch"

premium_role_output="${TEMP_DIR}/premium-role.json"
premium_role_status="$(rpc_call "${premium_token}" get_current_admin_role '{}' "${premium_role_output}")"
assert_success "${premium_role_status}" "premium override role lookup"
[[ "$(jq -r '.' "${premium_role_output}")" == "null" ]] || fail "premium override was treated as admin membership"

check_capability() {
  local token="$1"
  local capability="$2"
  local expected="$3"
  local label="$4"
  local output_file="${TEMP_DIR}/capability-${label}.json"
  local status

  status="$(rpc_call \
    "${token}" \
    admin_has_capability \
    "$(jq -cn --arg capability "${capability}" '{p_capability:$capability}')" \
    "${output_file}")"
  assert_success "${status}" "capability ${label}"
  [[ "$(jq -r '.' "${output_file}")" == "${expected}" ]] || fail "capability ${label} mismatch"
}

check_capability "${owner_token}" "admin.roles.manage" true owner_roles_manage
check_capability "${viewer_token}" "admin.products.read" true viewer_products_read
check_capability "${viewer_token}" "admin.products.review" false viewer_products_review
check_capability "${premium_token}" "admin.dashboard.read" false premium_dashboard_read

assert_membership_rows() {
  local token="$1"
  local expected_count="$2"
  local expected_user_id="$3"
  local label="$4"
  local output_file="${TEMP_DIR}/memberships-${label}.json"
  local status

  status="$(rest_call \
    "${token}" \
    GET \
    'admin_memberships?select=user_id,role,is_active&order=user_id.asc' \
    '' \
    "${output_file}")"
  assert_success "${status}" "membership read ${label}"
  [[ "$(jq 'length' "${output_file}")" -eq "${expected_count}" ]] || fail "membership read ${label} count mismatch"

  if [[ "${expected_count}" -gt 0 ]]; then
    [[ "$(jq -r '.[0].user_id' "${output_file}")" == "${expected_user_id}" ]] || fail "membership read ${label} leaked another user"
  fi
}

assert_membership_rows "${owner_token}" 1 "${owner_id}" owner
assert_membership_rows "${viewer_token}" 1 "${viewer_id}" viewer
assert_membership_rows "${premium_token}" 0 "" premium

viewer_write_output="${TEMP_DIR}/viewer-write.json"
viewer_write_status="$(rest_call \
  "${viewer_token}" \
  PATCH \
  "admin_memberships?user_id=eq.${viewer_id}" \
  '{"role":"admin_owner"}' \
  "${viewer_write_output}")"
assert_denied "${viewer_write_status}" "viewer direct role escalation"

authenticated_audit_output="${TEMP_DIR}/authenticated-audit.json"
authenticated_audit_status="$(rpc_call \
  "${viewer_token}" \
  record_admin_audit_event \
  "$(jq -cn \
    --arg actor_user_id "${viewer_id}" \
    '{p_actor_user_id:$actor_user_id,p_required_capability:"admin.products.read",p_action:"admin.runtime.read",p_target_type:"product",p_target_id:null,p_before_value:null,p_after_value:null,p_reason:"runtime verifier",p_request_id:"runtime-viewer-audit-0001",p_metadata:{}}')" \
  "${authenticated_audit_output}")"
assert_denied "${authenticated_audit_status}" "authenticated audit RPC"

invalid_capability_output="${TEMP_DIR}/invalid-capability-audit.json"
invalid_capability_status="$(rpc_call \
  "${service_role_key}" \
  record_admin_audit_event \
  "$(jq -cn \
    --arg actor_user_id "${viewer_id}" \
    '{p_actor_user_id:$actor_user_id,p_required_capability:"admin.products.review",p_action:"admin.product.review",p_target_type:"product_candidate",p_target_id:"candidate-runtime",p_before_value:null,p_after_value:{decision:"approve"},p_reason:"runtime verifier",p_request_id:"runtime-viewer-review-0001",p_metadata:{}}')" \
  "${invalid_capability_output}")"
assert_denied "${invalid_capability_status}" "audit with missing actor capability"

valid_audit_payload="$(jq -cn \
  --arg actor_user_id "${owner_id}" \
  '{p_actor_user_id:$actor_user_id,p_required_capability:"admin.roles.manage",p_action:"admin.role.bootstrap_verified",p_target_type:"admin_membership",p_target_id:$actor_user_id,p_before_value:null,p_after_value:{role:"admin_owner"},p_reason:"Verify owner bootstrap contract",p_request_id:"runtime-owner-audit-0001",p_metadata:{source:"isolated_runtime"}}')"

valid_audit_output="${TEMP_DIR}/valid-audit.json"
valid_audit_status="$(rpc_call \
  "${service_role_key}" \
  record_admin_audit_event \
  "${valid_audit_payload}" \
  "${valid_audit_output}")"
assert_success "${valid_audit_status}" "service-role audit write"
audit_id="$(jq -er '.' "${valid_audit_output}")" || fail "service-role audit returned no id"

retry_audit_output="${TEMP_DIR}/retry-audit.json"
retry_audit_status="$(rpc_call \
  "${service_role_key}" \
  record_admin_audit_event \
  "${valid_audit_payload}" \
  "${retry_audit_output}")"
assert_success "${retry_audit_status}" "idempotent audit retry"
[[ "$(jq -r '.' "${retry_audit_output}")" == "${audit_id}" ]] || fail "idempotent audit retry returned a different id"

assert_audit_rows() {
  local token="$1"
  local expected_count="$2"
  local label="$3"
  local output_file="${TEMP_DIR}/audit-${label}.json"
  local status

  status="$(rest_call \
    "${token}" \
    GET \
    'admin_audit_logs?select=id,actor_user_id,actor_role,required_capability,action,request_id&order=created_at.asc' \
    '' \
    "${output_file}")"
  assert_success "${status}" "audit read ${label}"
  [[ "$(jq 'length' "${output_file}")" -eq "${expected_count}" ]] || fail "audit read ${label} count mismatch"
}

assert_audit_rows "${owner_token}" 1 owner
assert_audit_rows "${viewer_token}" 0 viewer
assert_audit_rows "${premium_token}" 0 premium

owner_audit_output="${TEMP_DIR}/audit-owner-detail.json"
owner_audit_status="$(rest_call \
  "${owner_token}" \
  GET \
  "admin_audit_logs?select=id,actor_user_id,actor_role,required_capability,action,request_id&id=eq.${audit_id}" \
  '' \
  "${owner_audit_output}")"
assert_success "${owner_audit_status}" "owner audit detail"
[[ "$(jq -r '.[0].actor_user_id' "${owner_audit_output}")" == "${owner_id}" ]] || fail "audit actor mismatch"
[[ "$(jq -r '.[0].required_capability' "${owner_audit_output}")" == "admin.roles.manage" ]] || fail "audit capability mismatch"

service_direct_audit_output="${TEMP_DIR}/service-direct-audit.json"
service_direct_audit_status="$(rest_call \
  "${service_role_key}" \
  POST \
  admin_audit_logs \
  "$(jq -cn \
    --arg actor_user_id "${owner_id}" \
    '{actor_user_id:$actor_user_id,actor_role:"admin_owner",required_capability:"admin.roles.manage",action:"admin.direct.write",target_type:"audit",reason:"must fail",request_id:"runtime-direct-audit-0001",metadata:{}}')" \
  "${service_direct_audit_output}")"
assert_denied "${service_direct_audit_status}" "service-role direct audit table write"

printf '%s\n' '{"status":"passed","roleMatrix":"owner-viewer-premium-override","auditRows":1}'
