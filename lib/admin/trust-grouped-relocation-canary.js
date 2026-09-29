import "server-only";

import {
  stableCanaryDigest,
  verifyCanaryGroupedLineage,
  verifyCanaryIdempotentReplay,
  verifyCanaryProtectedAuthorityInvariant,
  verifyPhase8h3CanaryHandoff,
} from "@/lib/trust/official-source-grouped-relocation-canary.mjs";

export const FIRST_REAL_CANARY_AUDIT_ACTION =
  "trust.phase8i4g.first_real_canary_verification";
export const FIRST_REAL_CANARY_AUDIT_TARGET =
  "trust_official_source_relocation_group";

function by(key) {
  return (left, right) =>
    String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}

async function queryRows(client, table, columns, configure = null) {
  let query = client.from(table).select(columns);
  if (configure) query = configure(query);
  const { data, error } = await query;
  if (error) {
    throw new Error(
      `TRUST_PHASE8I4G_SNAPSHOT_QUERY_FAILED:${table}:${error.code || "QUERY_ERROR"}`,
    );
  }
  return data ?? [];
}

async function countRows(client, table, configure = null) {
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (configure) query = configure(query);
  const { count, error } = await query;
  if (error) {
    throw new Error(
      `TRUST_PHASE8I4G_SNAPSHOT_COUNT_FAILED:${table}:${error.code || "QUERY_ERROR"}`,
    );
  }
  return count ?? 0;
}

function compactSnapshot(snapshot) {
  return {
    snapshot_digest: snapshot.snapshot_digest,
    protected: snapshot.protected,
    authority: snapshot.authority,
    candidate: snapshot.candidate,
  };
}

export async function captureFirstRealCanaryAuthoritySnapshot({
  client,
  prepared,
  confirmed = null,
}) {
  if (!client || !prepared?.dbPreflight || !prepared?.snapshot) {
    throw new Error("TRUST_PHASE8I4G_SNAPSHOT_INPUT_INVALID");
  }

  const preflight = prepared.dbPreflight;
  const productId = String(preflight.product_id);
  const subjectId = String(preflight.subject_id);
  const sourceIds = [...(preflight.historical_source_ids || [])].map(String);

  const instances = (
    await queryRows(
      client,
      "product_fact_instances",
      "fact_instance_id,subject_id,registry_version,fact_key,proposition_key,semantic_status,value_type,value_boolean,value_enum,value_number,value_unit,value_range_min,value_range_max,value_entity_identifier,market,region,locale,valid_from,valid_to,qualifier,parent_proposition_key,parent_fact_instance_id,authority_ceiling,fused_confidence,fusion_policy_version,fusion_input_digest,supersedes_fact_instance_id,adjudicated_at,created_at",
      (query) => query.eq("subject_id", subjectId),
    )
  ).sort(by("fact_instance_id"));

  const current = (
    await queryRows(
      client,
      "product_fact_current",
      "proposition_key,fact_instance_id,subject_id,confirmation_id,updated_at",
      (query) => query.eq("subject_id", subjectId),
    )
  ).sort(by("proposition_key"));

  const confirmationIds = [
    ...new Set(current.map((row) => row.confirmation_id).filter(Boolean)),
  ];
  const confirmations =
    confirmationIds.length === 0
      ? []
      : (
          await queryRows(
            client,
            "product_fact_confirmations",
            "confirmation_id,request_id,namespace,payload_digest,prestate_digest,result_digest,created_at",
            (query) => query.in("confirmation_id", confirmationIds),
          )
        ).sort(by("confirmation_id"));

  const evidenceSources =
    sourceIds.length === 0
      ? []
      : (
          await queryRows(
            client,
            "product_evidence_sources",
            "source_id,canonical_locator,publisher,source_kind,source_metadata,content_digest,external_snapshot_reference,market,region,locale,published_at,accessed_at,observed_at,created_at",
            (query) => query.in("source_id", sourceIds),
          )
        ).sort(by("source_id"));

  const evidenceBindings =
    sourceIds.length === 0
      ? []
      : (
          await queryRows(
            client,
            "product_evidence_source_subject_bindings",
            "binding_id,source_id,product_id,subject_id,binding_state,scope_relation,presentation_metadata,identity_resolution_version,reviewed_by,reviewed_at,created_at",
            (query) =>
              query
                .in("source_id", sourceIds)
                .eq("product_id", productId)
                .eq("subject_id", subjectId),
          )
        ).sort(by("binding_id"));

  const recommendationRows = (
    await queryRows(
      client,
      "recommendation_logs",
      "id,event_name,timestamp,product_id,is_top_pick,question_id,answer,session_id,feature_name,result_type,meta_json",
      (query) => query.eq("product_id", productId),
    )
  ).sort(by("id"));

  const bindingIds = [
    preflight.old_binding_id,
    confirmed?.replacement_binding_id ?? null,
  ].filter(Boolean);
  const bindingRows =
    bindingIds.length === 0
      ? []
      : await queryRows(
          client,
          "product_source_bindings",
          "binding_id,binding_state,source_url,external_id,updated_at",
          (query) => query.in("binding_id", bindingIds),
        );
  const bindingMap = new Map(
    bindingRows.map((row) => [String(row.binding_id), row]),
  );

  const [
    relocationCount,
    groupedRelocationCount,
    groupedSourceCount,
    groupedIncidentCount,
    productSourceBindingCount,
    officialSourceReviewCount,
  ] = await Promise.all([
    countRows(client, "trust_official_source_relocations"),
    countRows(client, "trust_official_source_relocation_groups"),
    countRows(client, "trust_official_source_relocation_group_sources"),
    countRows(client, "trust_official_source_relocation_group_incidents"),
    countRows(client, "product_source_bindings", (query) =>
      query.eq("product_id", productId),
    ),
    countRows(client, "trust_official_source_binding_reviews", (query) =>
      query.eq("product_id", productId).eq("subject_id", subjectId),
    ),
  ]);

  const protectedState = {
    product_fact_instances: instances.length,
    product_fact_current: current.length,
    product_fact_confirmations: confirmations.length,
    evidence_sources: evidenceSources.length,
    evidence_subject_bindings: evidenceBindings.length,
    recommendation_logs: recommendationRows.length,
    historical_evidence_source_digest: stableCanaryDigest(evidenceSources),
    historical_evidence_binding_digest: stableCanaryDigest(evidenceBindings),
    product_fact_scope_digest: stableCanaryDigest({
      instances,
      current,
      confirmations,
    }),
    recommendation_scope_digest: stableCanaryDigest(recommendationRows),
  };

  const snapshot = {
    contract: "trust-phase8i4g-authority-snapshot-v1",
    product_id: productId,
    subject_id: subjectId,
    protected: protectedState,
    authority: {
      relocation_count: relocationCount,
      grouped_relocation_count: groupedRelocationCount,
      grouped_source_count: groupedSourceCount,
      grouped_incident_count: groupedIncidentCount,
      product_source_binding_count: productSourceBindingCount,
      official_source_review_count: officialSourceReviewCount,
    },
    candidate: {
      historical_source_count: sourceIds.length,
      incident_count: (preflight.incident_ids || []).length,
      old_binding_id: preflight.old_binding_id,
      old_binding_state:
        bindingMap.get(String(preflight.old_binding_id))?.binding_state ?? null,
      replacement_binding_id: confirmed?.replacement_binding_id ?? null,
      replacement_binding_state: confirmed?.replacement_binding_id
        ? bindingMap.get(String(confirmed.replacement_binding_id))
            ?.binding_state ?? null
        : null,
    },
  };

  return {
    ...snapshot,
    snapshot_digest: stableCanaryDigest(snapshot),
  };
}

function replayCounts(snapshot) {
  return {
    relocation_count: snapshot.authority.relocation_count,
    grouped_relocation_count: snapshot.authority.grouped_relocation_count,
    grouped_source_count: snapshot.authority.grouped_source_count,
    grouped_incident_count: snapshot.authority.grouped_incident_count,
    product_source_binding_count:
      snapshot.authority.product_source_binding_count,
    official_source_review_count:
      snapshot.authority.official_source_review_count,
    product_fact_instances: snapshot.protected.product_fact_instances,
    product_fact_current: snapshot.protected.product_fact_current,
    product_fact_confirmations:
      snapshot.protected.product_fact_confirmations,
    evidence_sources: snapshot.protected.evidence_sources,
    evidence_subject_bindings:
      snapshot.protected.evidence_subject_bindings,
    recommendation_logs: snapshot.protected.recommendation_logs,
  };
}

function resultShape(data) {
  return {
    status: data?.status,
    idempotent: data?.idempotent === true,
    groupId: data?.group_id ?? data?.groupId ?? null,
    relocationId: data?.relocation_id ?? data?.relocationId ?? null,
    replacementBindingId:
      data?.replacement_binding_id ?? data?.replacementBindingId ?? null,
    replacementReviewId:
      data?.replacement_review_id ?? data?.replacementReviewId ?? null,
  };
}

export function verifyFirstRealCanaryClosure({
  prepared,
  firstResult,
  replayResult,
  before,
  afterFirst,
  afterReplay,
  lineage,
}) {
  const authority = verifyCanaryProtectedAuthorityInvariant(
    before,
    afterFirst,
  );
  const groupedLineage = verifyCanaryGroupedLineage({
    expectedSourceIds: prepared.dbPreflight.historical_source_ids,
    expectedIncidentIds: prepared.dbPreflight.incident_ids,
    lineage,
  });
  const replay = verifyCanaryIdempotentReplay({
    firstResult: resultShape(firstResult),
    replayResult: resultShape(replayResult),
    beforeReplay: replayCounts(afterFirst),
    afterReplay: replayCounts(afterReplay),
  });
  const downstream = verifyPhase8h3CanaryHandoff({
    relocation: {
      status: firstResult?.status,
      relocation_id: firstResult?.relocation_id,
      product_id: prepared.dbPreflight.product_id,
      subject_id: prepared.dbPreflight.subject_id,
    },
    downstream: {
      relocation_id: firstResult?.relocation_id,
      product_id: prepared.dbPreflight.product_id,
      subject_id: prepared.dbPreflight.subject_id,
      state: "READY_FOR_REVALIDATION",
      automatic_semantic_authority: false,
    },
  });

  const checks = {
    authority,
    groupedLineage,
    replay,
    downstream,
  };
  const result = Object.values(checks).every(
    (check) => check.result === "PASS",
  )
    ? "PASS"
    : "FAIL";

  return {
    contract: "trust-phase8i4g-first-real-canary-closure-v1",
    result,
    checks,
    before_snapshot_digest: before.snapshot_digest,
    after_first_snapshot_digest: afterFirst.snapshot_digest,
    after_replay_snapshot_digest: afterReplay.snapshot_digest,
    automatic_semantic_authority: false,
    next_state:
      result === "PASS"
        ? "FIRST_REAL_CANARY_CLOSED"
        : "HALT_FURTHER_GROUPED_CONFIRMATIONS",
  };
}

export async function recordFirstRealCanaryClosureAudit({
  client,
  actorUserId,
  requestId,
  groupId,
  relocationId,
  evaluationId,
  before,
  after,
  verification,
}) {
  const { data, error } = await client.rpc("record_admin_audit_event", {
    p_actor_user_id: actorUserId,
    p_required_capability: "admin.products.review",
    p_action: FIRST_REAL_CANARY_AUDIT_ACTION,
    p_target_type: FIRST_REAL_CANARY_AUDIT_TARGET,
    p_target_id: groupId,
    p_before_value: compactSnapshot(before),
    p_after_value: compactSnapshot(after),
    p_reason:
      verification.result === "PASS"
        ? "Phase 8I-4G first real grouped relocation canary verification PASS"
        : "Phase 8I-4G first real grouped relocation canary verification FAIL; halt further grouped confirmations",
    p_request_id: `${requestId}:phase8i4g-canary`,
    p_metadata: {
      contract: verification.contract,
      result: verification.result,
      evaluation_id: evaluationId,
      relocation_id: relocationId,
      group_id: groupId,
      authority_result: verification.checks.authority.result,
      lineage_result: verification.checks.groupedLineage.result,
      replay_result: verification.checks.replay.result,
      downstream_result: verification.checks.downstream.result,
      automatic_semantic_authority: false,
      next_state: verification.next_state,
    },
  });
  if (error) {
    throw new Error(
      `TRUST_PHASE8I4G_AUDIT_FAILED:${error.code || "RPC_ERROR"}`,
    );
  }
  return data;
}

export async function loadFirstRealCanaryClosureState(client) {
  const rows = await queryRows(
    client,
    "admin_audit_logs",
    "id,target_id,request_id,metadata,created_at",
    (query) =>
      query
        .eq("action", FIRST_REAL_CANARY_AUDIT_ACTION)
        .eq("target_type", FIRST_REAL_CANARY_AUDIT_TARGET)
        .order("created_at", { ascending: false })
        .limit(20),
  );
  const pass = rows.find((row) => row.metadata?.result === "PASS") ?? null;
  const fail = rows.find((row) => row.metadata?.result === "FAIL") ?? null;
  return {
    contract: "trust-phase8i4g-canary-closure-state-v1",
    pass: Boolean(pass),
    failWithoutPass: Boolean(fail && !pass),
    passAuditId: pass?.id ?? null,
    passGroupId: pass?.metadata?.group_id ?? pass?.target_id ?? null,
    failAuditId: fail?.id ?? null,
    failGroupId: fail?.metadata?.group_id ?? fail?.target_id ?? null,
  };
}
