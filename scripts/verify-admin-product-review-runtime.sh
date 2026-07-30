#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${1:-tmp/admin-product-review-runtime}"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.109.1}"
TEMP_DIR="$(mktemp -d)"
PASSWORD='Admin-product-review-42!'

cleanup() {
  rm -rf "${TEMP_DIR}"
}
trap cleanup EXIT

fail() {
  printf 'admin product review runtime verification failed: %s\n' "$1" >&2
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
    --max-time 25 \
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
    --arg password "${PASSWORD}" \
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
    --arg password "${PASSWORD}" \
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
  local prefer="${6:-return=representation}"
  local arguments=(
    --request "${method}"
    "${api_url}/rest/v1/${path}"
    --header "apikey: ${token}"
    --header "Authorization: Bearer ${token}"
    --header 'Content-Type: application/json'
    --header "Prefer: ${prefer}"
  )

  if [[ -n "${payload}" ]]; then
    arguments+=(--data "${payload}")
  fi

  request_status "${output_file}" "${arguments[@]}"
}

row_count() {
  local table_path="$1"
  local output_file="${TEMP_DIR}/count-${table_path//[^a-zA-Z0-9]/_}.json"
  local status
  status="$(rest_call "${service_role_key}" GET "${table_path}" '' "${output_file}")"
  assert_success "${status}" "count ${table_path}"
  jq 'length' "${output_file}"
}

preflight() {
  local actor_id="$1"
  local candidate_id="$2"
  local decision="$3"
  local reason="$4"
  local output_file="$5"
  local payload
  payload="$(jq -cn \
    --arg actor "${actor_id}" \
    --arg candidate "${candidate_id}" \
    --arg decision "${decision}" \
    --arg reason "${reason}" \
    '{p_actor_user_id:$actor,p_candidate_id:$candidate,p_decision:$decision,p_reason:$reason}')"
  rpc_call "${service_role_key}" admin_preflight_product_candidate_review "${payload}" "${output_file}"
}

confirm_from_preflight() {
  local actor_id="$1"
  local candidate_id="$2"
  local decision="$3"
  local reason="$4"
  local request_id="$5"
  local preflight_file="$6"
  local output_file="$7"
  local preflight_hash_override="${8:-}"
  local preflight_hash
  local payload

  preflight_hash="$(jq -r '.preflight_hash' "${preflight_file}")"
  if [[ -n "${preflight_hash_override}" ]]; then
    preflight_hash="${preflight_hash_override}"
  fi

  payload="$(jq -cn \
    --arg actor "${actor_id}" \
    --arg candidate "${candidate_id}" \
    --arg decision "${decision}" \
    --arg reason "${reason}" \
    --arg candidate_updated_at "$(jq -r '.candidate_updated_at' "${preflight_file}")" \
    --arg review_updated_at "$(jq -r '.review_updated_at' "${preflight_file}")" \
    --arg evidence_hash "$(jq -r '.evidence_hash' "${preflight_file}")" \
    --arg preflight_hash "${preflight_hash}" \
    --arg request_id "${request_id}" \
    '{p_actor_user_id:$actor,p_candidate_id:$candidate,p_decision:$decision,p_reason:$reason,p_candidate_updated_at_expected:$candidate_updated_at,p_review_updated_at_expected:$review_updated_at,p_evidence_hash_expected:$evidence_hash,p_preflight_hash_expected:$preflight_hash,p_request_id:$request_id}')"

  rpc_call "${service_role_key}" admin_confirm_product_candidate_review "${payload}" "${output_file}"
}

owner_email="owner-product-review@example.test"
operator_email="operator-product-review@example.test"
viewer_email="viewer-product-review@example.test"
premium_email="premium-product-review@example.test"

owner_id="$(create_user "${owner_email}" '{}')"
operator_id="$(create_user "${operator_email}" '{}')"
viewer_id="$(create_user "${viewer_email}" '{}')"
premium_id="$(create_user "${premium_email}" '{"premium_entitlement":"admin_override","role":"admin","admin":true}')"

bootstrap_file="${TEMP_DIR}/bootstrap.json"
bootstrap_status="$(rpc_call \
  "${service_role_key}" \
  bootstrap_first_admin_owner \
  "$(jq -cn --arg id "${owner_id}" '{p_user_id:$id}')" \
  "${bootstrap_file}")"
assert_success "${bootstrap_status}" "bootstrap owner"

membership_file="${TEMP_DIR}/memberships.json"
membership_payload="$(jq -cn \
  --arg operator "${operator_id}" \
  --arg viewer "${viewer_id}" \
  '[{user_id:$operator,role:"admin_operator",is_active:true},{user_id:$viewer,role:"admin_viewer",is_active:true}]')"
membership_status="$(rest_call \
  "${service_role_key}" POST admin_memberships "${membership_payload}" "${membership_file}")"
assert_success "${membership_status}" "create operator and viewer memberships"

owner_token="$(login_user "${owner_email}")"
operator_token="$(login_user "${operator_email}")"
viewer_token="$(login_user "${viewer_email}")"
premium_token="$(login_user "${premium_email}")"

premium_role_file="${TEMP_DIR}/premium-role.json"
premium_role_status="$(rpc_call "${premium_token}" get_current_admin_role '{}' "${premium_role_file}")"
assert_success "${premium_role_status}" "premium role lookup"
[[ "$(jq -r '.' "${premium_role_file}")" == "null" ]] || fail "premium override became admin"

existing_product_id="10000000-0000-4000-8000-000000000001"
insert_candidate_id="20000000-0000-4000-8000-000000000001"
merge_candidate_id="20000000-0000-4000-8000-000000000002"
missing_form_candidate_id="20000000-0000-4000-8000-000000000003"
defer_candidate_id="20000000-0000-4000-8000-000000000004"
block_candidate_id="20000000-0000-4000-8000-000000000005"
stale_candidate_id="20000000-0000-4000-8000-000000000006"

product_payload='{"skin_types":["combination","sensitive"],"concerns":["acne","redness"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true,"price_min":19000,"price_max":25000,"buy_link":null,"image_url":null}'

existing_product_file="${TEMP_DIR}/existing-product.json"
existing_product_status="$(rest_call \
  "${service_role_key}" POST products \
  "$(jq -cn --arg id "${existing_product_id}" '{id:$id,name:"Existing Serum",brand:"Existing Brand",category:"treatment",product_form:"serum",skin_types:["combination"],concerns:["acne"],texture:"gel",finish:"natural",irritation_risk:"low",sensitivity_safe:true,normalized_name:"existingserum",normalized_brand:"existingbrand"}')" \
  "${existing_product_file}")"
assert_success "${existing_product_status}" "seed existing product"

candidates_payload="$(jq -cn \
  --arg insert_id "${insert_candidate_id}" \
  --arg merge_id "${merge_candidate_id}" \
  --arg missing_id "${missing_form_candidate_id}" \
  --arg defer_id "${defer_candidate_id}" \
  --arg block_id "${block_candidate_id}" \
  --arg stale_id "${stale_candidate_id}" \
  --arg existing_product_id "${existing_product_id}" \
  --argjson product "${product_payload}" \
  '[
    {id:$insert_id,source_name:"hwahae",external_type:"goods",external_id:"insert-1",category_path:"skincare/serum",product_name_raw:"New Calm Serum",brand_name_raw:"New Brand",normalized_name:"newcalmserum",normalized_brand:"newbrand",service_category:"treatment",product_form:"serum",canonical_name:"New Calm Serum",canonical_brand:"New Brand",review_status:"needs_review",promotion_payload:{product:$product}},
    {id:$merge_id,source_name:"hwahae",external_type:"goods",external_id:"merge-1",category_path:"skincare/serum",product_name_raw:"Existing Serum",brand_name_raw:"Existing Brand",normalized_name:"existingserum",normalized_brand:"existingbrand",service_category:"treatment",product_form:"serum",canonical_name:"Existing Serum",canonical_brand:"Existing Brand",review_status:"needs_review",matched_product_id:$existing_product_id,promotion_payload:{product:$product}},
    {id:$missing_id,source_name:"hwahae",external_type:"goods",external_id:"missing-form-1",category_path:"skincare/serum",product_name_raw:"Unknown Treatment",brand_name_raw:"Unknown Brand",normalized_name:"unknowntreatment",normalized_brand:"unknownbrand",service_category:"treatment",product_form:null,canonical_name:"Unknown Treatment",canonical_brand:"Unknown Brand",review_status:"needs_review",promotion_payload:{product:$product}},
    {id:$defer_id,source_name:"hwahae",external_type:"goods",external_id:"defer-1",category_path:"skincare/serum",product_name_raw:"Deferred Serum",brand_name_raw:"Deferred Brand",normalized_name:"deferredserum",normalized_brand:"deferredbrand",service_category:"treatment",product_form:"serum",canonical_name:"Deferred Serum",canonical_brand:"Deferred Brand",review_status:"needs_review",promotion_payload:{product:$product}},
    {id:$block_id,source_name:"hwahae",external_type:"goods",external_id:"block-1",category_path:"skincare/serum",product_name_raw:"Blocked Serum",brand_name_raw:"Blocked Brand",normalized_name:"blockedserum",normalized_brand:"blockedbrand",service_category:"treatment",product_form:"serum",canonical_name:"Blocked Serum",canonical_brand:"Blocked Brand",review_status:"needs_review",promotion_payload:{product:$product}},
    {id:$stale_id,source_name:"hwahae",external_type:"goods",external_id:"stale-1",category_path:"skincare/serum",product_name_raw:"Stale Serum",brand_name_raw:"Stale Brand",normalized_name:"staleserum",normalized_brand:"stalebrand",service_category:"treatment",product_form:"serum",canonical_name:"Stale Serum",canonical_brand:"Stale Brand",review_status:"needs_review",promotion_payload:{product:$product}}
  ]')"

candidates_file="${TEMP_DIR}/candidates.json"
candidates_status="$(rest_call \
  "${service_role_key}" POST product_candidates "${candidates_payload}" "${candidates_file}")"
assert_success "${candidates_status}" "seed product candidates"

reviews_payload="$(jq -cn \
  --arg insert_id "${insert_candidate_id}" \
  --arg merge_id "${merge_candidate_id}" \
  --arg missing_id "${missing_form_candidate_id}" \
  --arg defer_id "${defer_candidate_id}" \
  --arg block_id "${block_candidate_id}" \
  --arg stale_id "${stale_candidate_id}" \
  '[
    {candidate_id:$insert_id,status:"queued",priority_score:100,selection_reason:"top rank",evidence_snapshot:{concerns:[{concern:"acne",latest_rank:1}]},rule_version:"ranking-review-v2"},
    {candidate_id:$merge_id,status:"queued",priority_score:90,selection_reason:"persistent",evidence_snapshot:{concerns:[{concern:"acne",latest_rank:2}]},rule_version:"ranking-review-v2"},
    {candidate_id:$missing_id,status:"queued",priority_score:80,selection_reason:"needs metadata",evidence_snapshot:{concerns:[{concern:"acne",latest_rank:3}]},rule_version:"ranking-review-v2"},
    {candidate_id:$defer_id,status:"queued",priority_score:70,selection_reason:"needs source",evidence_snapshot:{concerns:[{concern:"redness",latest_rank:4}]},rule_version:"ranking-review-v2"},
    {candidate_id:$block_id,status:"queued",priority_score:60,selection_reason:"identity risk",evidence_snapshot:{concerns:[{concern:"acne",latest_rank:5}]},rule_version:"ranking-review-v2"},
    {candidate_id:$stale_id,status:"queued",priority_score:50,selection_reason:"stale test",evidence_snapshot:{concerns:[{concern:"acne",latest_rank:6}]},rule_version:"ranking-review-v2"}
  ]')"

reviews_file="${TEMP_DIR}/reviews.json"
reviews_status="$(rest_call \
  "${service_role_key}" POST candidate_promotion_reviews "${reviews_payload}" "${reviews_file}")"
assert_success "${reviews_status}" "seed promotion reviews"

owner_direct_preflight_file="${TEMP_DIR}/owner-direct-preflight.json"
owner_direct_preflight_status="$(rpc_call \
  "${owner_token}" admin_preflight_product_candidate_review \
  "$(jq -cn --arg actor "${owner_id}" --arg candidate "${insert_candidate_id}" '{p_actor_user_id:$actor,p_candidate_id:$candidate,p_decision:"approve",p_reason:"direct browser attempt"}')" \
  "${owner_direct_preflight_file}")"
assert_denied "${owner_direct_preflight_status}" "authenticated direct preflight RPC"

viewer_preflight_file="${TEMP_DIR}/viewer-preflight.json"
viewer_preflight_status="$(preflight \
  "${viewer_id}" "${insert_candidate_id}" approve "viewer must be denied" "${viewer_preflight_file}")"
assert_denied "${viewer_preflight_status}" "viewer product review capability"

products_initial="$(row_count 'products?select=id')"

missing_preflight_file="${TEMP_DIR}/missing-preflight.json"
missing_preflight_status="$(preflight \
  "${operator_id}" "${missing_form_candidate_id}" approve "product form is required" "${missing_preflight_file}")"
assert_success "${missing_preflight_status}" "missing product form preflight"
[[ "$(jq -r '.status' "${missing_preflight_file}")" == "blocked" ]] || fail "missing product form preflight was not blocked"
jq -e '.issues | index("missing_product_form") != null' "${missing_preflight_file}" >/dev/null || fail "missing product form issue absent"
[[ "$(jq -r '.planned.products_write_count' "${missing_preflight_file}")" == "0" ]] || fail "blocked preflight predicted product write"
[[ "$(row_count 'products?select=id')" == "${products_initial}" ]] || fail "preflight changed products"

insert_preflight_file="${TEMP_DIR}/insert-preflight.json"
insert_preflight_status="$(preflight \
  "${operator_id}" "${insert_candidate_id}" approve "verified official product evidence" "${insert_preflight_file}")"
assert_success "${insert_preflight_status}" "insert candidate preflight"
[[ "$(jq -r '.status' "${insert_preflight_file}")" == "ready" ]] || fail "insert candidate preflight not ready"
[[ "$(jq -r '.planned.promotion_action' "${insert_preflight_file}")" == "inserted" ]] || fail "insert preflight did not plan insert"
[[ "$(jq -r '.planned.products_write_count' "${insert_preflight_file}")" == "1" ]] || fail "insert preflight write count mismatch"
[[ "$(row_count 'products?select=id')" == "${products_initial}" ]] || fail "insert preflight wrote product"

wrong_hash_file="${TEMP_DIR}/wrong-hash.json"
wrong_hash_status="$(confirm_from_preflight \
  "${operator_id}" "${insert_candidate_id}" approve "verified official product evidence" \
  "review-insert-wrong-hash" "${insert_preflight_file}" "${wrong_hash_file}" \
  "00000000000000000000000000000000")"
assert_denied "${wrong_hash_status}" "confirm with wrong preflight hash"

insert_confirm_file="${TEMP_DIR}/insert-confirm.json"
insert_confirm_status="$(confirm_from_preflight \
  "${operator_id}" "${insert_candidate_id}" approve "verified official product evidence" \
  "review-insert-confirm-0001" "${insert_preflight_file}" "${insert_confirm_file}")"
assert_success "${insert_confirm_status}" "confirm inserted product"
[[ "$(jq -r '.status' "${insert_confirm_file}")" == "confirmed" ]] || fail "insert confirm status mismatch"
[[ "$(jq -r '.promotion_action' "${insert_confirm_file}")" == "inserted" ]] || fail "insert confirm action mismatch"
products_after_insert="$(row_count 'products?select=id')"
[[ "${products_after_insert}" -eq $((products_initial + 1)) ]] || fail "insert confirm product count mismatch"

insert_retry_file="${TEMP_DIR}/insert-retry.json"
insert_retry_status="$(confirm_from_preflight \
  "${operator_id}" "${insert_candidate_id}" approve "verified official product evidence" \
  "review-insert-confirm-0001" "${insert_preflight_file}" "${insert_retry_file}")"
assert_success "${insert_retry_status}" "idempotent insert retry"
[[ "$(jq -cS '.' "${insert_retry_file}")" == "$(jq -cS '.' "${insert_confirm_file}")" ]] || fail "idempotent retry result changed"
[[ "$(row_count 'products?select=id')" == "${products_after_insert}" ]] || fail "idempotent retry duplicated product"

merge_preflight_file="${TEMP_DIR}/merge-preflight.json"
merge_preflight_status="$(preflight \
  "${owner_id}" "${merge_candidate_id}" approve "confirmed exact existing product" "${merge_preflight_file}")"
assert_success "${merge_preflight_status}" "merge preflight"
[[ "$(jq -r '.planned.promotion_action' "${merge_preflight_file}")" == "merged" ]] || fail "merge preflight action mismatch"

merge_confirm_file="${TEMP_DIR}/merge-confirm.json"
merge_confirm_status="$(confirm_from_preflight \
  "${owner_id}" "${merge_candidate_id}" approve "confirmed exact existing product" \
  "review-merge-confirm-0001" "${merge_preflight_file}" "${merge_confirm_file}")"
assert_success "${merge_confirm_status}" "merge confirm"
[[ "$(jq -r '.promotion_action' "${merge_confirm_file}")" == "merged" ]] || fail "merge confirm action mismatch"
[[ "$(row_count 'products?select=id')" == "${products_after_insert}" ]] || fail "merge confirm duplicated product"

defer_preflight_file="${TEMP_DIR}/defer-preflight.json"
defer_preflight_status="$(preflight \
  "${operator_id}" "${defer_candidate_id}" defer "official source requires recheck" "${defer_preflight_file}")"
assert_success "${defer_preflight_status}" "defer preflight"
[[ "$(jq -r '.planned.products_write_count' "${defer_preflight_file}")" == "0" ]] || fail "defer preflight predicted product write"

defer_confirm_file="${TEMP_DIR}/defer-confirm.json"
defer_confirm_status="$(confirm_from_preflight \
  "${operator_id}" "${defer_candidate_id}" defer "official source requires recheck" \
  "review-defer-confirm-0001" "${defer_preflight_file}" "${defer_confirm_file}")"
assert_success "${defer_confirm_status}" "defer confirm"
[[ "$(jq -r '.queue_status' "${defer_confirm_file}")" == "deferred" ]] || fail "defer queue status mismatch"
[[ "$(row_count 'products?select=id')" == "${products_after_insert}" ]] || fail "defer changed products"

block_preflight_file="${TEMP_DIR}/block-preflight.json"
block_preflight_status="$(preflight \
  "${owner_id}" "${block_candidate_id}" block "product identity is invalid" "${block_preflight_file}")"
assert_success "${block_preflight_status}" "block preflight"

block_confirm_file="${TEMP_DIR}/block-confirm.json"
block_confirm_status="$(confirm_from_preflight \
  "${owner_id}" "${block_candidate_id}" block "product identity is invalid" \
  "review-block-confirm-0001" "${block_preflight_file}" "${block_confirm_file}")"
assert_success "${block_confirm_status}" "block confirm"
[[ "$(jq -r '.queue_status' "${block_confirm_file}")" == "rejected" ]] || fail "block queue status mismatch"
[[ "$(row_count 'products?select=id')" == "${products_after_insert}" ]] || fail "block changed products"

stale_preflight_file="${TEMP_DIR}/stale-preflight.json"
stale_preflight_status="$(preflight \
  "${operator_id}" "${stale_candidate_id}" defer "stale evidence test" "${stale_preflight_file}")"
assert_success "${stale_preflight_status}" "stale preflight"

stale_patch_file="${TEMP_DIR}/stale-patch.json"
stale_patch_status="$(rest_call \
  "${service_role_key}" PATCH \
  "candidate_promotion_reviews?candidate_id=eq.${stale_candidate_id}" \
  '{"evidence_snapshot":{"concerns":[{"concern":"acne","latest_rank":1}],"changed":true},"updated_at":"2030-01-01T00:00:00Z"}' \
  "${stale_patch_file}")"
assert_success "${stale_patch_status}" "mutate evidence after preflight"

stale_confirm_file="${TEMP_DIR}/stale-confirm.json"
stale_confirm_status="$(confirm_from_preflight \
  "${operator_id}" "${stale_candidate_id}" defer "stale evidence test" \
  "review-stale-confirm-0001" "${stale_preflight_file}" "${stale_confirm_file}")"
assert_denied "${stale_confirm_status}" "stale preflight confirm"

viewer_escalation_file="${TEMP_DIR}/viewer-escalation.json"
viewer_escalation_status="$(rest_call \
  "${viewer_token}" PATCH \
  "product_candidates?id=eq.${missing_form_candidate_id}" \
  '{"review_status":"approved"}' \
  "${viewer_escalation_file}")"
assert_denied "${viewer_escalation_status}" "viewer direct candidate escalation"

owner_audit_file="${TEMP_DIR}/owner-audit.json"
owner_audit_status="$(rest_call \
  "${owner_token}" GET \
  'admin_audit_logs?select=id,action,target_id,metadata&action=eq.admin.product_candidate.review_confirmed&order=created_at.asc' \
  '' "${owner_audit_file}")"
assert_success "${owner_audit_status}" "owner audit read"
[[ "$(jq 'length' "${owner_audit_file}")" -eq 4 ]] || fail "expected four confirmed audit events"

viewer_audit_file="${TEMP_DIR}/viewer-audit.json"
viewer_audit_status="$(rest_call \
  "${viewer_token}" GET \
  'admin_audit_logs?select=id&action=eq.admin.product_candidate.review_confirmed' \
  '' "${viewer_audit_file}")"
assert_success "${viewer_audit_status}" "viewer audit read"
[[ "$(jq 'length' "${viewer_audit_file}")" -eq 0 ]] || fail "viewer read audit events"

confirmation_direct_file="${TEMP_DIR}/confirmation-direct.json"
confirmation_direct_status="$(rest_call \
  "${service_role_key}" GET \
  'admin_product_review_confirmations?select=request_id' \
  '' "${confirmation_direct_file}")"
assert_denied "${confirmation_direct_status}" "service role direct confirmation ledger read"

printf '%s\n' "ADMIN_PRODUCT_CANDIDATE_REVIEW_RUNTIME_VERIFIED"
