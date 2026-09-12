#!/usr/bin/env node

import assert from "node:assert/strict";

const baseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

assert.ok(baseUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { response, payload };
}

async function rpc(name, body) {
  return request(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function expectRpcError(name, body, expectedMessage) {
  const { response, payload } = await rpc(name, body);
  assert.equal(response.ok, false, `${name} unexpectedly succeeded: ${JSON.stringify(payload)}`);
  assert.match(String(payload?.message ?? payload), new RegExp(expectedMessage));
}

async function selectRows(table, query = "select=*") {
  const { response, payload } = await request(`${table}?${query}`);
  assert.equal(response.ok, true, `${table} read failed: ${JSON.stringify(payload)}`);
  assert.ok(Array.isArray(payload));
  return payload;
}

async function selectOne(table, query) {
  const rows = await selectRows(table, query);
  return rows[0] ?? null;
}

async function countRows(table) {
  return (await selectRows(table, "select=id")).length;
}

const ids = {
  target: "ccf23119-b067-4076-bb9e-01a83cf88fa0",
  ranking: "11111111-1111-4111-8111-111111111111",
  queued: "22222222-2222-4222-8222-222222222221",
  reviewing: "22222222-2222-4222-8222-222222222222",
  deferred: "22222222-2222-4222-8222-222222222223",
  approved: "22222222-2222-4222-8222-222222222224",
  rejected: "22222222-2222-4222-8222-222222222225",
  promoted: "22222222-2222-4222-8222-222222222226",
  missing: "22222222-2222-4222-8222-222222222299",
};

const adminActor = "30000000-0000-4000-8000-000000000001";
const nonAdminActor = "30000000-0000-4000-8000-000000000099";
const rpcName = "admin_enqueue_product_candidate_structural_review_v1";

const identityEvidence = {
  contract_version: "manual-catalog-identity-evidence-v1",
  providers: [
    {
      provider: "torriden_official",
      external_type: "goods",
      external_id: "136",
      url: "https://www.torriden.com/goods/goods_view.php?goodsNo=136",
      brand: "토리든",
      title: "다이브인 무기자차 마일드 선크림 60ml",
      size_ml: 60,
    },
    {
      provider: "hwahae",
      external_type: "products",
      external_id: "1986669",
      url: "https://www.hwahae.com/en/products/1986669",
      brand: "Torriden",
      title: "DIVE IN Mild Sun Cream [SPF50+/PA++++]",
      size_ml: 60,
    },
  ],
  convergence_dimensions: ["brand", "product_title", "size_60ml"],
  authority_boundary: {
    product_write_allowed: false,
    candidate_identity_resolution_write_allowed: false,
    product_source_binding_write_allowed: false,
    offer_materialization_allowed: false,
    recommendation_authority: false,
  },
};

function intakeBody(candidateId, requestId, reason = "independent identity convergence for governed manual catalog review", evidence = identityEvidence) {
  return {
    p_actor_user_id: adminActor,
    p_candidate_id: candidateId,
    p_request_id: requestId,
    p_reason: reason,
    p_identity_evidence: evidence,
  };
}

const identitySelect =
  "select=id,review_status,identity_resolution_state,canonical_name,canonical_brand,service_category,product_form,matched_product_id,duplicate_of_product_id,promotion_payload&order=id.asc";

const beforeCandidates = await selectRows("product_candidates", identitySelect);
const beforeCounts = {
  products: await countRows("products"),
  bindings: await countRows("product_source_bindings"),
  offers: await countRows("product_offers"),
  productFacts: await countRows("product_fact_current"),
  recommendationLogs: await countRows("recommendation_logs"),
};
const beforeQueued = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.queued}&select=*`,
);
const beforeReviewing = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.reviewing}&select=*`,
);
const beforeApproved = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.approved}&select=*`,
);
const beforeRejected = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.rejected}&select=*`,
);

await expectRpcError(
  rpcName,
  {
    ...intakeBody(ids.target, "offer14-unauthorized-001"),
    p_actor_user_id: nonAdminActor,
  },
  "admin_product_review_access_required",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.target, "offer14-shortreason-001", "too short"),
  "manual_catalog_review_reason_invalid",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.target, "offer14-malformed-001", undefined, {}),
  "manual_catalog_review_identity_evidence_invalid",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.target, "offer14-duplicate-provider-001", undefined, {
    ...identityEvidence,
    providers: [identityEvidence.providers[0], { ...identityEvidence.providers[0] }],
  }),
  "manual_catalog_review_identity_evidence_invalid",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.target, "offer14-semantic-001", undefined, {
    ...identityEvidence,
    providers: [
      ...identityEvidence.providers,
      { provider: "bad", recommendation_eligible: true },
    ],
  }),
  "manual_catalog_review_identity_evidence_semantic_authority_forbidden",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.target, "offer14-null-001", undefined, {
    ...identityEvidence,
    providers: [...identityEvidence.providers, { provider: "bad", value: null }],
  }),
  "manual_catalog_review_identity_evidence_null_forbidden",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.target, "offer14-oversized-001", undefined, {
    ...identityEvidence,
    oversized_padding: "x".repeat(17000),
  }),
  "manual_catalog_review_identity_evidence_invalid",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.missing, "offer14-missing-001"),
  "manual_catalog_review_candidate_not_found",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.promoted, "offer14-promoted-001"),
  "manual_catalog_review_candidate_state_not_intake_eligible",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.queued, "offer14-existing-queued-001"),
  "manual_catalog_review_actionable_review_exists",
);
assert.deepEqual(
  await selectOne("candidate_promotion_reviews", `candidate_id=eq.${ids.queued}&select=*`),
  beforeQueued,
  "existing queued review mutated",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.reviewing, "offer14-existing-reviewing-001"),
  "manual_catalog_review_actionable_review_exists",
);
assert.deepEqual(
  await selectOne("candidate_promotion_reviews", `candidate_id=eq.${ids.reviewing}&select=*`),
  beforeReviewing,
  "existing reviewing review mutated",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.approved, "offer14-approved-protected-001"),
  "manual_catalog_review_terminal_review_protected",
);
assert.deepEqual(
  await selectOne("candidate_promotion_reviews", `candidate_id=eq.${ids.approved}&select=*`),
  beforeApproved,
  "approved review mutated",
);

await expectRpcError(
  rpcName,
  intakeBody(ids.rejected, "offer14-rejected-protected-001"),
  "manual_catalog_review_terminal_review_protected",
);
assert.deepEqual(
  await selectOne("candidate_promotion_reviews", `candidate_id=eq.${ids.rejected}&select=*`),
  beforeRejected,
  "rejected review mutated",
);

const targetRequest = intakeBody(
  ids.target,
  "offer14-target-001",
  "Torriden official listing 136 and Hwahae 1986669 converge for human catalog review",
);
const { response: enqueueResponse, payload: enqueueResult } = await rpc(rpcName, targetRequest);
assert.equal(enqueueResponse.ok, true, JSON.stringify(enqueueResult));
assert.equal(enqueueResult.status, "queued");
assert.equal(enqueueResult.candidate_id, ids.target);
assert.equal(enqueueResult.rule_version, "manual-catalog-identity-review-v1");
assert.equal(enqueueResult.request_id, "offer14-target-001");
assert.equal(enqueueResult.action, "inserted");
assert.equal(enqueueResult.idempotent, false);
assert.equal(enqueueResult.audit_written, true);
assert.equal(enqueueResult.products_written, 0);
assert.equal(enqueueResult.candidate_identity_writes, 0);
assert.equal(enqueueResult.product_source_bindings_written, 0);
assert.equal(enqueueResult.offers_written, 0);
assert.equal(enqueueResult.product_facts_written, 0);
assert.equal(enqueueResult.recommendation_semantic_writes, 0);

const queuedTarget = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.target}&select=*`,
);
assert.ok(queuedTarget);
assert.equal(queuedTarget.status, "queued");
assert.equal(Number(queuedTarget.priority_score), 0);
assert.equal(queuedTarget.rule_version, "manual-catalog-identity-review-v1");
assert.equal(queuedTarget.reviewed_at, null);
assert.equal(queuedTarget.review_note, null);
assert.equal(queuedTarget.approved_product_id, null);
assert.equal(queuedTarget.evidence_snapshot.intake_contract, "manual-catalog-review-intake-v1");
assert.equal(queuedTarget.evidence_snapshot.queue_policy, "manual_catalog_admission");
assert.equal(queuedTarget.evidence_snapshot.manual_queue_eligible, true);
assert.equal(queuedTarget.evidence_snapshot.ranking_queue_authority, false);
assert.equal(queuedTarget.evidence_snapshot.manual_review_required, true);
assert.equal(queuedTarget.evidence_snapshot.identity_evidence.contract_version, "manual-catalog-identity-evidence-v1");
assert.equal(queuedTarget.evidence_snapshot.authority_boundary.product_write_allowed, false);
assert.equal(queuedTarget.evidence_snapshot.authority_boundary.candidate_identity_resolution_write_allowed, false);
assert.equal(queuedTarget.evidence_snapshot.authority_boundary.product_source_binding_write_allowed, false);
assert.equal(queuedTarget.evidence_snapshot.authority_boundary.offer_materialization_allowed, false);
assert.equal(queuedTarget.evidence_snapshot.authority_boundary.product_fact_write_allowed, false);
assert.equal(queuedTarget.evidence_snapshot.authority_boundary.recommendation_semantic_write_allowed, false);
assert.equal(queuedTarget.evidence_snapshot.manual_intake_requests.length, 1);
assert.equal(queuedTarget.evidence_snapshot.manual_intake_requests[0].request_id, "offer14-target-001");

assert.equal(await countRows("admin_audit_logs"), 1);

const { response: replayResponse, payload: replayResult } = await rpc(rpcName, targetRequest);
assert.equal(replayResponse.ok, true, JSON.stringify(replayResult));
assert.equal(replayResult.action, "replay");
assert.equal(replayResult.idempotent, true);
assert.equal(replayResult.audit_written, false);
assert.equal(replayResult.review_id, enqueueResult.review_id);
assert.equal(await countRows("admin_audit_logs"), 1, "idempotent replay duplicated audit");

await expectRpcError(
  rpcName,
  {
    ...targetRequest,
    p_reason: "same request id with a materially different payload must fail closed",
  },
  "manual_catalog_review_request_conflict",
);

const deferredRequest = intakeBody(
  ids.deferred,
  "offer14-deferred-001",
  "deferred candidate receives a new governed manual catalog admission request",
);
const { response: deferredResponse, payload: deferredResult } = await rpc(rpcName, deferredRequest);
assert.equal(deferredResponse.ok, true, JSON.stringify(deferredResult));
assert.equal(deferredResult.action, "requeued");
assert.equal(deferredResult.idempotent, false);
assert.equal(deferredResult.audit_written, true);

const deferredAfter = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.deferred}&select=*`,
);
assert.equal(deferredAfter.status, "queued");
assert.equal(deferredAfter.rule_version, "manual-catalog-identity-review-v1");
assert.equal(Number(deferredAfter.priority_score), 0);
assert.equal(deferredAfter.reviewed_at, null);
assert.equal(deferredAfter.review_note, null);
assert.equal(deferredAfter.evidence_snapshot.fixture, "deferred");
assert.equal(deferredAfter.evidence_snapshot.queue_policy, "manual_catalog_admission");
assert.equal(deferredAfter.evidence_snapshot.manual_queue_eligible, true);
assert.equal(deferredAfter.evidence_snapshot.ranking_queue_authority, false);
assert.equal(deferredAfter.evidence_snapshot.prior_queue_state.status, "deferred");
assert.equal(deferredAfter.evidence_snapshot.prior_queue_state.rule_version, "ranking-review-v2");
assert.equal(deferredAfter.evidence_snapshot.manual_intake_requests.at(-1).request_id, "offer14-deferred-001");
assert.equal(await countRows("admin_audit_logs"), 2);

const { response: deferredReplayResponse, payload: deferredReplayResult } = await rpc(rpcName, deferredRequest);
assert.equal(deferredReplayResponse.ok, true, JSON.stringify(deferredReplayResult));
assert.equal(deferredReplayResult.idempotent, true);
assert.equal(deferredReplayResult.action, "replay");
assert.equal(await countRows("admin_audit_logs"), 2, "deferred replay duplicated audit");

const manualTargetBeforeRefresh = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.target}&select=*`,
);
const manualDeferredBeforeRefresh = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.deferred}&select=*`,
);

const { response: refreshResponse, payload: refreshResult } = await rpc(
  "refresh_candidate_promotion_reviews",
  { p_rule_version: "ranking-review-v2" },
);
assert.equal(refreshResponse.ok, true, JSON.stringify(refreshResult));
assert.equal(refreshResult.rule_version, "ranking-review-v2");

assert.deepEqual(
  await selectOne("candidate_promotion_reviews", `candidate_id=eq.${ids.target}&select=*`),
  manualTargetBeforeRefresh,
  "ranking refresh mutated manual target review",
);
assert.deepEqual(
  await selectOne("candidate_promotion_reviews", `candidate_id=eq.${ids.deferred}&select=*`),
  manualDeferredBeforeRefresh,
  "ranking refresh mutated manually requeued deferred review",
);

const rankingReview = await selectOne(
  "candidate_promotion_reviews",
  `candidate_id=eq.${ids.ranking}&select=*`,
);
assert.ok(rankingReview);
assert.equal(rankingReview.status, "queued");
assert.equal(rankingReview.rule_version, "ranking-review-v2");
assert.equal(Number(rankingReview.priority_score), 100);
assert.equal(rankingReview.evidence_snapshot.queue_eligible, true);
assert.equal(rankingReview.evidence_snapshot.rule_version, "ranking-review-v2");

const afterCandidates = await selectRows("product_candidates", identitySelect);
assert.deepEqual(afterCandidates, beforeCandidates, "manual catalog admission mutated candidate identity fields");

const afterCounts = {
  products: await countRows("products"),
  bindings: await countRows("product_source_bindings"),
  offers: await countRows("product_offers"),
  productFacts: await countRows("product_fact_current"),
  recommendationLogs: await countRows("recommendation_logs"),
};
assert.deepEqual(afterCounts, beforeCounts, "manual catalog admission mutated downstream authority tables");

console.log(
  JSON.stringify(
    {
      status: "PASS",
      contract: "manual-catalog-review-intake-v1",
      assertions: {
        unauthorized_actor_blocked: true,
        malformed_evidence_blocked: true,
        duplicate_provider_evidence_blocked: true,
        forbidden_semantic_authority_blocked: true,
        json_null_blocked: true,
        short_reason_blocked: true,
        oversized_evidence_blocked: true,
        missing_candidate_blocked: true,
        promoted_candidate_blocked: true,
        existing_queued_protected: true,
        reviewing_protected: true,
        deferred_requeued: true,
        approved_protected: true,
        rejected_protected: true,
        valid_manual_insert: true,
        exact_request_replay_idempotent: true,
        ambiguous_request_replay_blocked: true,
        audit_idempotent: true,
        ranking_review_authority_not_fabricated: true,
        product_writes_zero: true,
        candidate_identity_writes_zero: true,
        product_fact_writes_zero: true,
        offer_writes_zero: true,
        recommendation_semantic_writes_zero: true,
      },
    },
    null,
    2,
  ),
);
