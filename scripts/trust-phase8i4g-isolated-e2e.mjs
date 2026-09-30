import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  runTransportDriftHandoff,
  stableDigest,
} from "./trust-transport-drift-handoff-worker.mjs";
import {
  preflightGroupedOfficialSourceRelocation,
} from "../lib/trust/official-source-grouped-relocation-preflight.mjs";
import {
  buildGroupedOfficialSourceRelocationConfirmationRequest,
} from "../lib/trust/official-source-grouped-relocation-confirmation-request.mjs";
import {
  assertGroupedRelocationOperatorParity,
  buildGroupedRelocationOperatorPreflightHash,
} from "../lib/trust/official-source-grouped-relocation-operator-contract.mjs";
import {
  buildReadOnlyCanarySnapshot,
  classifyRealCanaryProvenance,
  stableCanaryDigest,
  verifyCanaryProtectedAuthorityInvariant,
  verifyCanaryGroupedLineage,
  verifyCanaryIdempotentReplay,
  verifyPhase8h3CanaryHandoff,
} from "../lib/trust/official-source-grouped-relocation-canary.mjs";
import {
  buildCanaryActivationSignal,
} from "./trust-phase8i4g-canary-activation-signal.mjs";

const ACTOR_ID = "92000000-0000-4000-8000-000000000001";
const RUN_ID = "phase8i3e-scheduled-99999999999-1";
const REPLACEMENT_URL =
  "https://official.example.test/trust-phase4-fixture-v2";
const QUALIFICATION_DIGEST = stableDigest({
  contract: "trust-phase8i4g-isolated-qualification-v1",
  replacement: REPLACEMENT_URL,
});

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function rpc(client, fn, args = {}) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new Error(`${fn}:${error.code || "RPC_ERROR"}:${error.message}`);
  }
  return data;
}

async function tableRows(client, table, columns = "*", configure = null) {
  let query = client.from(table).select(columns);
  if (configure) query = configure(query);
  const { data, error } = await query;
  if (error) {
    throw new Error(`${table}:${error.code || "SELECT_ERROR"}:${error.message}`);
  }
  return data || [];
}

async function one(client, table, columns, configure) {
  const rows = await tableRows(client, table, columns, (query) =>
    configure(query).limit(2),
  );
  assert.equal(rows.length, 1, `${table} expected exactly one row`);
  return rows[0];
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { head: true, count: "exact" });
  if (error) {
    throw new Error(`${table}:${error.code || "COUNT_ERROR"}:${error.message}`);
  }
  return Number(count || 0);
}

async function captureProtected(client, {
  caseRow,
  oldBindingId,
  replacementBindingId = null,
} = {}) {
  const subjectId = caseRow.subject_id;
  const sourceIds = [...caseRow.source_ids].map(String).sort();

  const [
    instances,
    current,
    confirmations,
    evidenceSources,
    evidenceBindings,
    recommendationLogs,
    oldBinding,
  ] = await Promise.all([
    tableRows(client, "product_fact_instances", "*", (q) =>
      q.eq("subject_id", subjectId).order("fact_instance_id"),
    ),
    tableRows(client, "product_fact_current", "*", (q) =>
      q.eq("subject_id", subjectId).order("proposition_key"),
    ),
    tableRows(client, "product_fact_confirmations", "*", (q) =>
      q.eq("subject_id", subjectId).order("confirmation_id"),
    ),
    tableRows(client, "product_evidence_sources", "*", (q) =>
      q.in("source_id", sourceIds).order("source_id"),
    ),
    tableRows(client, "product_evidence_source_subject_bindings", "*", (q) =>
      q.in("source_id", sourceIds).order("binding_id"),
    ),
    tableRows(client, "recommendation_logs", "*"),
    one(client, "product_source_bindings", "*", (q) =>
      q.eq("binding_id", oldBindingId),
    ),
  ]);

  let replacementBinding = null;
  if (replacementBindingId) {
    replacementBinding = await one(
      client,
      "product_source_bindings",
      "*",
      (q) => q.eq("binding_id", replacementBindingId),
    );
  }

  const authority = {
    relocation_count: await countRows(
      client,
      "trust_official_source_relocations",
    ),
    grouped_relocation_count: await countRows(
      client,
      "trust_official_source_relocation_groups",
    ),
    grouped_source_count: await countRows(
      client,
      "trust_official_source_relocation_group_sources",
    ),
    grouped_incident_count: await countRows(
      client,
      "trust_official_source_relocation_group_incidents",
    ),
  };

  return {
    protected: {
      product_fact_instances: instances.length,
      product_fact_current: current.length,
      product_fact_confirmations: confirmations.length,
      evidence_sources: evidenceSources.length,
      evidence_subject_bindings: evidenceBindings.length,
      recommendation_logs: recommendationLogs.length,
      historical_evidence_source_digest: stableCanaryDigest(evidenceSources),
      historical_evidence_binding_digest: stableCanaryDigest(evidenceBindings),
      product_fact_scope_digest: stableCanaryDigest({
        instances,
        current,
        confirmations,
      }),
      recommendation_scope_digest: stableCanaryDigest(recommendationLogs),
    },
    authority,
    candidate: {
      historical_source_count: sourceIds.length,
      incident_count: caseRow.incident_ids.length,
      old_binding_state: oldBinding.binding_state,
      replacement_binding_state: replacementBinding?.binding_state ?? null,
    },
  };
}

async function captureReplayCounts(client) {
  const tables = {
    relocation_count: "trust_official_source_relocations",
    grouped_relocation_count: "trust_official_source_relocation_groups",
    grouped_source_count: "trust_official_source_relocation_group_sources",
    grouped_incident_count: "trust_official_source_relocation_group_incidents",
    product_source_binding_count: "product_source_bindings",
    official_source_review_count: "trust_official_source_binding_reviews",
    product_fact_instances: "product_fact_instances",
    product_fact_current: "product_fact_current",
    product_fact_confirmations: "product_fact_confirmations",
    evidence_sources: "product_evidence_sources",
    evidence_subject_bindings: "product_evidence_source_subject_bindings",
    recommendation_logs: "recommendation_logs",
  };
  const result = {};
  for (const [key, table] of Object.entries(tables)) {
    result[key] = await countRows(client, table);
  }
  return result;
}

function mapConfirmResult(result) {
  return {
    status: result.status,
    idempotent: result.idempotent === true,
    groupId: result.group_id,
    relocationId: result.relocation_id,
    replacementBindingId: result.replacement_binding_id,
    replacementReviewId: result.replacement_review_id,
  };
}

async function main() {
  const client = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const targets = await rpc(
    client,
    "get_trust_official_source_transport_targets_v1",
  );
  assert.equal(targets.contract, "trust-official-source-transport-targets-v1");
  assert.equal(targets.ready_source_count, 3);
  assert.equal(targets.unique_ready_target_count, 1);

  const readyTargets = targets.targets.filter(
    (row) => row.target_status === "READY",
  );
  assert.equal(readyTargets.length, 3);
  const targetKey = readyTargets[0].target_key;
  const oldLocator = readyTargets[0].effective_locator;
  for (const target of readyTargets) {
    assert.equal(target.target_key, targetKey);
    assert.equal(target.effective_locator, oldLocator);
  }

  const firstAt = "2026-09-30T00:00:00.000Z";
  const secondAt = "2026-09-30T00:31:00.000Z";
  for (const [index, target] of readyTargets.entries()) {
    const first = await rpc(
      client,
      "record_trust_official_source_transport_observation_v1",
      {
        p_request_id: `phase8i4g-e2e-a-${index + 1}`,
        p_probe_group_id: "phase8i4g-e2e-probe-a",
        p_source_id: target.source_id,
        p_target_key: target.target_key,
        p_transport_result: "MISSING",
        p_http_status: 404,
        p_final_locator: null,
        p_redirect_chain: [],
        p_checked_at: firstAt,
        p_worker_version: "trust-phase8i4g-isolated-e2e-v1",
        p_transport_metadata: { fixture: true, observation: 1 },
      },
    );
    assert.equal(first.incident_created, false);

    const second = await rpc(
      client,
      "record_trust_official_source_transport_observation_v1",
      {
        p_request_id: `phase8i4g-e2e-b-${index + 1}`,
        p_probe_group_id: "phase8i4g-e2e-probe-b",
        p_source_id: target.source_id,
        p_target_key: target.target_key,
        p_transport_result: "MISSING",
        p_http_status: 404,
        p_final_locator: null,
        p_redirect_chain: [],
        p_checked_at: secondAt,
        p_worker_version: "trust-phase8i4g-isolated-e2e-v1",
        p_transport_metadata: { fixture: true, observation: 2 },
      },
    );
    assert.equal(second.incident_created, true);
    assert.ok(second.incident_id);
  }

  const enqueue = await rpc(
    client,
    "enqueue_trust_official_source_transport_drift_cases_v1",
    { p_limit: 100 },
  );
  assert.equal(enqueue.authority_mutation, false);
  assert.equal(enqueue.current_invalidated, false);
  assert.equal(enqueue.new_case_count, 1);
  assert.equal(enqueue.new_link_count, 3);
  assert.equal(enqueue.blocked_count, 0);

  const listedBefore = await rpc(
    client,
    "get_trust_official_source_transport_drift_cases_v1",
    { p_limit: 100 },
  );
  assert.equal(listedBefore.case_count, 1);
  const caseBefore = listedBefore.cases[0];
  assert.equal(caseBefore.incident_kind, "CONFIRMED_MISSING");
  assert.equal(caseBefore.source_ids.length, 3);
  assert.equal(caseBefore.incident_ids.length, 3);
  assert.equal(caseBefore.latest_evaluation, null);

  const anchorSourceId = [...caseBefore.source_ids].map(String).sort()[0];
  const anchorSource = await one(
    client,
    "product_evidence_sources",
    "*",
    (q) => q.eq("source_id", anchorSourceId),
  );
  const governedSubject = await one(
    client,
    "product_fact_subjects",
    "*",
    (q) => q.eq("subject_id", caseBefore.subject_id),
  );
  const oldBinding = await one(
    client,
    "product_source_bindings",
    "*",
    (q) =>
      q
        .eq("product_id", caseBefore.product_id)
        .eq("source_url", caseBefore.effective_locator)
        .eq("binding_state", "resolved")
        .eq("binding_method", "trust_official_source_review_v1")
        .eq("product_scope_state", "product"),
  );
  const oldReview = await one(
    client,
    "trust_official_source_binding_reviews",
    "*",
    (q) =>
      q
        .eq("binding_id", oldBinding.binding_id)
        .eq("subject_id", caseBefore.subject_id),
  );

  const registry = {
    contract: "trust-phase8i3-transport-drift-evaluation-policy-registry-v1",
    version: "isolated-e2e-v1",
    authority:
      "REPOSITORY_REVIEWED_EVALUATION_POLICY_NOT_PRODUCT_FACT_AUTHORITY",
    retry_interval_hours: 6,
    policies: [
      {
        policy_key: `product:${caseBefore.product_id}:subject:${caseBefore.subject_id}`,
        product_id: caseBefore.product_id,
        subject_id: caseBefore.subject_id,
        historical_source_ids: [...caseBefore.source_ids],
        direct_qualification_template: {
          contract: "trust-phase8h-source-identity-qualification-v1",
          historical_source: {
            source_id: anchorSourceId,
            canonical_locator: oldLocator,
          },
          governed_subject: {
            product_id: caseBefore.product_id,
            subject_id: caseBefore.subject_id,
          },
          reviewed_binding: null,
          requirements: {},
          candidate_defaults: {
            publisher: anchorSource.publisher,
            market: anchorSource.market,
            source_kind: oldBinding.external_type,
          },
        },
        rediscovery_case_template: {
          contract: "trust-phase8h-official-source-rediscovery-v1",
          case_id: "phase8i4g-isolated-e2e",
          historical_source_id: anchorSourceId,
          historical_source_ids: [...caseBefore.source_ids],
          product_id: caseBefore.product_id,
          subject_id: caseBefore.subject_id,
          qualification_template: {
            historical_source: {
              source_id: anchorSourceId,
              canonical_locator: oldLocator,
            },
          },
        },
      },
    ],
  };

  const qualification = {
    contract: "trust-phase8h-source-identity-qualification-v1",
    historical_source_id: anchorSourceId,
    historical_locator: oldLocator,
    historical_publisher: anchorSource.publisher,
    historical_source_kind: anchorSource.source_kind,
    product_id: caseBefore.product_id,
    subject_id: caseBefore.subject_id,
    candidate_locator: REPLACEMENT_URL,
    candidate_publisher: anchorSource.publisher,
    candidate_source_kind: oldBinding.external_type,
    discovery_method: "isolated_fixture",
    disposition: "QUALIFIED_EXACT",
    reason: "exact_governed_identity_proven",
    qualification_digest: QUALIFICATION_DIGEST,
    mutation_policy: "READ_ONLY_NO_PRODUCTION_WRITE",
    authority: "QUALIFICATION_EVIDENCE_ONLY_REQUIRES_GOVERNED_RELOCATION",
  };

  const handoff = await runTransportDriftHandoff({
    client,
    registry,
    runId: RUN_ID,
    limit: 100,
    record: true,
    runRediscovery: async () => ({
      contract: "trust-phase8h-official-source-rediscovery-batch-result-v1",
      authority: "READ_ONLY_REDISCOVERY_NO_PRODUCTION_WRITE",
      results: [
        {
          case_id: "phase8i4g-isolated-e2e",
          disposition: "QUALIFIED_EXACT_FOUND",
          rediscovery: {
            disposition: "CANDIDATES_FOUND",
            candidate_count: 1,
          },
          exact_candidate_count: 1,
          qualifications: [
            {
              candidate: {
                candidate_locator: REPLACEMENT_URL,
                discovery_method: "isolated_fixture",
              },
              qualification,
            },
          ],
        },
      ],
    }),
  });

  assert.equal(handoff.case_count, 1);
  assert.equal(handoff.recorded_count, 1);
  assert.equal(handoff.result_counts.READY_FOR_8I4, 1);
  assert.equal(handoff.rows[0].result_kind, "READY_FOR_8I4");

  const listed = await rpc(
    client,
    "get_trust_official_source_transport_drift_cases_v1",
    { p_limit: 100 },
  );
  const caseRow = listed.cases[0];
  const evaluation = caseRow.latest_evaluation;
  assert.equal(evaluation.result_kind, "READY_FOR_8I4");
  const provenance = classifyRealCanaryProvenance({
    ...evaluation,
    case_id: caseRow.case_id,
  });
  assert.equal(provenance.eligible, true);
  assert.equal(provenance.kind, "PHASE8I3E_SCHEDULED_REAL");

  const canarySnapshot = buildReadOnlyCanarySnapshot({
    capturedAt: "2026-09-30T00:32:00.000Z",
    evaluations: [{ ...evaluation, case_id: caseRow.case_id }],
    groupedRelocations: [],
    caseLineage: {
      [caseRow.case_id]: {
        product_id: caseRow.product_id,
        subject_id: caseRow.subject_id,
        source_ids: caseRow.source_ids,
        incident_ids: caseRow.incident_ids,
      },
    },
    counts: {
      ready_for_8i4: 1,
      grouped_relocations: 0,
    },
  });
  assert.equal(
    canarySnapshot.state,
    "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT",
  );
  const activation = buildCanaryActivationSignal(canarySnapshot);
  assert.equal(
    activation.state,
    "FIRST_REAL_CANARY_ADMIN_ATTENTION_REQUIRED",
  );
  assert.equal(activation.automatic_confirmation, false);

  const dbPreflight = await rpc(
    client,
    "admin_preflight_trust_official_source_grouped_relocation_v1",
    {
      p_actor_user_id: ACTOR_ID,
      p_case_id: caseRow.case_id,
      p_evaluation_id: evaluation.evaluation_id,
    },
  );
  assert.equal(
    dbPreflight.status,
    "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION",
  );

  const historicalSources = [];
  for (const sourceId of [...caseRow.source_ids].map(String).sort()) {
    const source = await one(
      client,
      "product_evidence_sources",
      "*",
      (q) => q.eq("source_id", sourceId),
    );
    const binding = await one(
      client,
      "product_evidence_source_subject_bindings",
      "*",
      (q) =>
        q
          .eq("source_id", sourceId)
          .eq("product_id", caseRow.product_id)
          .eq("subject_id", caseRow.subject_id)
          .eq("binding_state", "exact_subject_match")
          .in("scope_relation", ["equivalent", "narrower"]),
    );
    historicalSources.push({
      source_id: source.source_id,
      canonical_locator: source.canonical_locator,
      publisher: source.publisher,
      source_kind: source.source_kind,
      market: source.market,
      locale: source.locale,
      content_digest: source.content_digest,
      product_id: binding.product_id,
      subject_id: binding.subject_id,
      source_subject_binding_id: binding.binding_id,
      binding_state: binding.binding_state,
      scope_relation: binding.scope_relation,
      reviewed_binding_id: oldBinding.binding_id,
      reviewed_review_id: oldReview.review_id,
    });
  }

  const input = {
    contract: "trust-phase8i4-grouped-relocation-preflight-input-v1",
    case: {
      case_id: caseRow.case_id,
      product_id: caseRow.product_id,
      subject_id: caseRow.subject_id,
      case_digest: caseRow.case_digest,
      historical_source_ids: [...caseRow.source_ids],
      incident_ids: [...caseRow.incident_ids],
    },
    evaluation: {
      evaluation_id: evaluation.evaluation_id,
      case_id: caseRow.case_id,
      policy_version: evaluation.policy_version,
      result_kind: evaluation.result_kind,
      candidate_locator: evaluation.candidate_locator,
      qualified_historical_source_id:
        evaluation.result_payload.qualified_historical_source_id,
      qualified_exact: evaluation.result_payload.qualified_exact,
      qualification_contract:
        evaluation.result_payload.qualified_exact.contract,
      qualification_digest: evaluation.qualification_digest,
      input_digest: evaluation.input_digest,
      result_digest: evaluation.result_digest,
    },
    governed_subject: {
      product_id: governedSubject.product_id,
      subject_id: governedSubject.subject_id,
      market_applicability: governedSubject.market_applicability,
      variant_key: governedSubject.variant_key,
      formulation_revision_key: governedSubject.formulation_revision_key,
      identity_status: governedSubject.identity_status,
      current_state: governedSubject.current_state,
    },
    current_reviewed_binding: {
      binding_id: oldBinding.binding_id,
      review_id: oldReview.review_id,
      product_id: oldBinding.product_id,
      subject_id: oldReview.subject_id,
      source_name: oldBinding.source_name,
      external_type: oldBinding.external_type,
      source_url: oldBinding.source_url,
      market_code: oldBinding.market_code,
      locale: oldBinding.locale,
      binding_state: oldBinding.binding_state,
      binding_method: oldBinding.binding_method,
      product_scope_state: oldBinding.product_scope_state,
      review_version: oldReview.review_version,
      review_subject_market: oldReview.subject_market,
      review_source_market: oldReview.source_market,
      review_scope_relation: oldReview.scope_relation,
      review_variant_key: oldReview.variant_key,
      review_formulation_revision_key: oldReview.formulation_revision_key,
      review_source_kind: oldReview.source_kind,
    },
    historical_sources: historicalSources,
    replacement: {
      source_name: oldBinding.source_name,
      external_type: oldBinding.external_type,
      source_url: REPLACEMENT_URL,
      market_code: oldBinding.market_code,
      locale: oldBinding.locale,
    },
  };

  const jsPreflight = preflightGroupedOfficialSourceRelocation(input);
  assert.equal(
    jsPreflight.status,
    "READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION",
  );
  const confirmationRequest =
    buildGroupedOfficialSourceRelocationConfirmationRequest(input);
  const parity = assertGroupedRelocationOperatorParity({
    dbPreflight,
    jsPreflight,
    confirmationRequest,
  });
  assert.equal(parity.result, "PASS");

  const preflightHash = buildGroupedRelocationOperatorPreflightHash({
    ...jsPreflight,
    phase8h_anchor_prestate_digest:
      confirmationRequest.phase8h_anchor_prestate_digest,
    phase8h_anchor_relocation_plan_digest:
      confirmationRequest.phase8h_anchor_relocation_plan_digest,
  });
  const requestId = `trust-group-relocation-${preflightHash.slice(0, 32)}`;

  const before = await captureProtected(client, {
    caseRow,
    oldBindingId: oldBinding.binding_id,
  });

  const firstDbResult = await rpc(
    client,
    "admin_confirm_trust_official_source_grouped_relocation_v1",
    {
      p_actor_user_id: ACTOR_ID,
      p_request_id: requestId,
      p_payload: confirmationRequest,
    },
  );
  assert.equal(firstDbResult.status, "confirmed");
  assert.equal(firstDbResult.idempotent, false);

  const after = await captureProtected(client, {
    caseRow,
    oldBindingId: oldBinding.binding_id,
    replacementBindingId: firstDbResult.replacement_binding_id,
  });
  const authorityVerification =
    verifyCanaryProtectedAuthorityInvariant(before, after);
  assert.equal(authorityVerification.result, "PASS");

  const lineage = await rpc(
    client,
    "get_trust_official_source_grouped_relocation_lineage_v1",
    {
      p_group_id: firstDbResult.group_id,
      p_relocation_id: null,
    },
  );
  assert.equal(lineage.found, true);
  const lineageVerification = verifyCanaryGroupedLineage({
    expectedSourceIds: caseRow.source_ids,
    expectedIncidentIds: caseRow.incident_ids,
    lineage,
  });
  assert.equal(lineageVerification.result, "PASS");

  const beforeReplay = await captureReplayCounts(client);
  const replayDbResult = await rpc(
    client,
    "admin_confirm_trust_official_source_grouped_relocation_v1",
    {
      p_actor_user_id: ACTOR_ID,
      p_request_id: requestId,
      p_payload: confirmationRequest,
    },
  );
  const afterReplay = await captureReplayCounts(client);
  const replayVerification = verifyCanaryIdempotentReplay({
    firstResult: mapConfirmResult(firstDbResult),
    replayResult: mapConfirmResult(replayDbResult),
    beforeReplay,
    afterReplay,
  });
  assert.equal(replayVerification.result, "PASS");

  const downstreamVerification = verifyPhase8h3CanaryHandoff({
    relocation: {
      status: firstDbResult.status,
      relocation_id: firstDbResult.relocation_id,
      product_id: firstDbResult.product_id,
      subject_id: firstDbResult.subject_id,
    },
    downstream: {
      relocation_id: firstDbResult.relocation_id,
      product_id: firstDbResult.product_id,
      subject_id: firstDbResult.subject_id,
      state: "READY_FOR_REVALIDATION",
      automatic_semantic_authority: false,
    },
  });
  assert.equal(downstreamVerification.result, "PASS");

  const auditId = await rpc(client, "record_admin_audit_event", {
    p_actor_user_id: ACTOR_ID,
    p_required_capability: "admin.products.review",
    p_action: "trust.phase8i4g.first_real_canary_verification",
    p_target_type: "trust_official_source_relocation_group",
    p_target_id: firstDbResult.group_id,
    p_before_value: {
      evaluation_id: evaluation.evaluation_id,
      request_id: evaluation.request_id,
    },
    p_after_value: {
      authority: authorityVerification.result,
      lineage: lineageVerification.result,
      replay: replayVerification.result,
      downstream: downstreamVerification.result,
    },
    p_reason: "isolated Phase 8I-4G first-real canary E2E closure verification",
    p_request_id: `phase8i4g-e2e-close-${firstDbResult.group_id}`,
    p_metadata: {
      phase: "8I-4G",
      isolated: true,
      production_mutation: false,
    },
  });
  assert.ok(auditId);

  const audits = await tableRows(
    client,
    "admin_audit_logs",
    "id,action,target_id",
    (q) =>
      q
        .eq("action", "trust.phase8i4g.first_real_canary_verification")
        .eq("target_id", firstDbResult.group_id),
  );
  assert.equal(audits.length, 1);

  process.stdout.write(
    JSON.stringify(
      {
        contract: "trust-phase8i4g-isolated-first-real-canary-e2e-v1",
        result: "PASS",
        production_mutation: false,
        transport_incidents: 3,
        drift_cases: 1,
        scheduled_ready_for_8i4: 1,
        activation_state: activation.state,
        preflight: dbPreflight.status,
        grouped_relocation: firstDbResult.status,
        grouped_source_count: lineage.sources.length,
        grouped_incident_count: lineage.incidents.length,
        authority_invariant: authorityVerification.result,
        idempotent_replay: replayVerification.result,
        phase8h3_handoff: downstreamVerification.result,
        closure_audit: "PASS",
        canary_request_id: evaluation.request_id,
        snapshot_digest: canarySnapshot.snapshot_digest,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
