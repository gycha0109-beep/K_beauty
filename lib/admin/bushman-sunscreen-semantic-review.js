import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import s2Evidence from "@/evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-d-s2-bushman-web-review-evidence-v1.json";
import {
  BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET,
  BUSHMAN_SEMANTIC_REVIEW_FIELDS,
  evaluateBushmanSemanticReviewReadiness,
  isBushmanSemanticReviewRequestId,
} from "@/lib/admin/bushman-sunscreen-semantic-review-contract.mjs";
import { evaluateBushmanSemanticS4Audit } from "@/lib/admin/bushman-sunscreen-semantic-s4-audit.mjs";

export class BushmanSemanticReviewError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function clientOrFail() {
  const client = createSupabaseAdminClient();
  if (!client) throw new BushmanSemanticReviewError("semantic_admin_service_unavailable", 503);
  return client;
}

async function readBundle(client) {
  const { data, error } = await client.rpc(
    "read_sunscreen_recommendation_semantic_bundle_v1",
    { p_product_id: BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.productId },
  );
  if (error || !data || typeof data !== "object") {
    throw new BushmanSemanticReviewError("semantic_review_reader_unavailable", 503);
  }
  return data;
}

export async function loadBushmanSemanticReviewWorkbench() {
  const client = clientOrFail();
  const live = await readBundle(client);
  const currentIds = BUSHMAN_SEMANTIC_REVIEW_FIELDS.map(
    (name) => live.fields?.[name]?.reviewId,
  ).filter((id) => typeof id === "string");
  const [subjectResult, auditResult] = await Promise.all([
    client.from("product_fact_subjects")
      .select("identity_resolution_version")
      .eq("subject_id", BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.subjectId)
      .maybeSingle(),
    currentIds.length
      ? client.from("admin_audit_logs")
          .select("id,target_id,action,target_type,after_value,metadata")
          .eq("action", "admin.sunscreen_recommendation_semantic_field_reviewed")
          .eq("target_type", "sunscreen_recommendation_semantic_field_review")
          .in("target_id", currentIds)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (subjectResult.error || !subjectResult.data ||
      auditResult.error || !Array.isArray(auditResult.data)) {
    throw new BushmanSemanticReviewError("semantic_review_s4_audit_unavailable", 503);
  }
  const s4 = evaluateBushmanSemanticS4Audit(
    s2Evidence, live, auditResult.data,
    subjectResult.data.identity_resolution_version,
  );
  const fields = BUSHMAN_SEMANTIC_REVIEW_FIELDS.map((name) => {
    const proposal = s2Evidence.reviewDecisions.find((x) => x.field === name);
    const preflight = evaluateBushmanSemanticReviewReadiness(s2Evidence, live, name);
    return {
      name,
      proposalState: proposal?.state ?? null,
      proposalValue: proposal?.value ?? null,
      rationale: proposal?.reason ?? null,
      sourceIds: proposal?.sourceIds ?? [],
      current: live.fields?.[name] ?? null,
      status: preflight.status,
      blocker: preflight.reason,
    };
  });
  return {
    productId: BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.productId,
    subjectId: BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.subjectId,
    sourceStage: s2Evidence.stage,
    reviewed: live.reviewedFieldCount ?? 0,
    established: live.establishedFieldCount ?? 0,
    required: 12,
    s4,
    fields,
    sources: s2Evidence.sources.map((source) => ({
      id: source.id,
      url: source.url ?? null,
      level: source.level,
    })),
    note: "각 필드는 관리자 본인이 명시적으로 승인합니다. 50g/50ml 동일 상품 취급은 내부 판단이며 제조사 확인이나 Subject 권위 승격이 아닙니다.",
  };
}

export async function confirmBushmanSemanticReview({ actorUserId, fieldName, requestId }) {
  if (typeof actorUserId !== "string" || !/^[0-9a-f-]{36}$/i.test(actorUserId)) {
    throw new BushmanSemanticReviewError("semantic_admin_actor_required", 403);
  }
  if (!isBushmanSemanticReviewRequestId(requestId, fieldName)) {
    throw new BushmanSemanticReviewError("semantic_review_request_invalid", 400);
  }
  const client = clientOrFail();
  const live = await readBundle(client);
  const preflight = evaluateBushmanSemanticReviewReadiness(s2Evidence, live, fieldName);
  if (preflight.status !== "ready") {
    throw new BushmanSemanticReviewError(preflight.reason ?? "semantic_review_preflight_hold", 409);
  }
  const { data, error } = await client.rpc(
    "admin_register_sunscreen_recommendation_semantic_field_v1",
    {
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_payload: preflight.payload,
    },
  );
  if (error || data?.status !== "reviewed" || data?.field_name !== fieldName ||
      data?.product_id !== BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.productId ||
      data?.subject_id !== BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET.subjectId) {
    throw new BushmanSemanticReviewError("semantic_review_confirmation_failed", 409);
  }
  return {
    fieldName,
    reviewId: data.review_id,
    auditId: data.audit_id ?? null,
    inserted: data.inserted === true,
    reviewed: data.reviewed_field_count,
    required: data.required_field_count,
  };
}
