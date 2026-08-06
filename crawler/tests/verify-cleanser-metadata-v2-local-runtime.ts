import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import { canonicalJson, sha256Utf8 } from "../lib/reviews/review-batch-integrity.js";
import { createReviewConfirmClient } from "../lib/reviews/review-confirm-client.js";
import { createReviewReadOnlyClient } from "../lib/reviews/review-readonly-client.js";
import { loadIntakeDatabaseSnapshot } from "../lib/reviews/review-export-query.js";
import {
  buildCleanserMetadataV2ConfirmPayload,
  parseCleanserMetadataV2Package,
  runCleanserMetadataV2DryRun,
} from "../lib/reviews/review-cleanser-metadata-v2.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MERGE_CANDIDATE = "51000000-0000-4000-8000-000000000002";
const MERGE_PRODUCT = "52000000-0000-4000-8000-000000000001";
const INACTIVE_ADMIN = "30000000-0000-4000-8000-000000000004";
const CANDIDATE_IDS = [
  "51000000-0000-4000-8000-000000000001",
  "51000000-0000-4000-8000-000000000002",
  "51000000-0000-4000-8000-000000000003",
  "51000000-0000-4000-8000-000000000004",
  "51000000-0000-4000-8000-000000000005",
];
let phase = "init";

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = error as Record<string, unknown>;
  return ["message", "details", "hint", "code"]
    .map((key) => typeof value[key] === "string" ? value[key] : "")
    .join(" ");
}

function boundedErrorCode(error: unknown): string {
  const match = errorText(error).match(/\b(?:review|admin)_[a-z0-9_]+\b/);
  if (match) return match[0];
  return error ? "unexpected_rpc_error" : "no_error";
}

function assertNoError(error: unknown, code: string): void {
  if (error) throw new Error(code);
}

async function rpcFail(
  client: SupabaseClient,
  actorId: string,
  requestId: string,
  payload: Record<string, unknown>,
  expected: string,
): Promise<void> {
  const { error } = await client.rpc("admin_confirm_product_review_import_v2_batch", {
    p_actor_user_id: actorId,
    p_request_id: requestId,
    p_payload: payload,
    p_payload_hash: sha256Utf8(canonicalJson(payload)),
  });
  if (!error || !errorText(error).includes(expected)) {
    throw new Error(`review_v2_expected_${expected}_received_${boundedErrorCode(error)}`);
  }
}

async function count(client: SupabaseClient, table: string, column = "id"): Promise<number> {
  const { count: value, error } = await client.from(table).select(column, { count: "exact", head: true });
  if (error || value === null) throw new Error(`review_v2_count_${table}_failed`);
  return value;
}

async function metadataSnapshot(client: SupabaseClient, productIds: string[]) {
  const products = new Map<string, Record<string, unknown>>();
  const reviews = new Map<string, Record<string, unknown>>();
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return { products, reviews };
  const productResult = await client
    .from("products")
    .select("id,category,cleansing_profile,updated_at")
    .in("id", ids);
  if (productResult.error) throw new Error("review_v2_product_snapshot_failed");
  for (const row of productResult.data ?? []) products.set(String(row.id), row);
  const reviewResult = await client
    .from("product_metadata_field_reviews")
    .select("product_id,candidate_id,canonical_payload_digest,updated_at")
    .eq("field_name", "cleansing_profile")
    .in("product_id", ids);
  if (reviewResult.error) throw new Error("review_v2_metadata_snapshot_failed");
  for (const row of reviewResult.data ?? []) reviews.set(String(row.product_id), row);
  return { products, reviews };
}

async function candidateStateSnapshot(client: SupabaseClient) {
  const candidates = await client.from("product_candidates")
    .select("id,review_status,matched_product_id,reviewed_at,reviewed_by,updated_at")
    .in("id", CANDIDATE_IDS)
    .order("id");
  if (candidates.error) throw new Error("review_v2_candidate_state_snapshot_failed");
  const reviews = await client.from("candidate_promotion_reviews")
    .select("candidate_id,status,approved_product_id,reviewed_at,review_note,updated_at")
    .in("candidate_id", CANDIDATE_IDS)
    .order("candidate_id");
  if (reviews.error) throw new Error("review_v2_queue_state_snapshot_failed");
  return { candidates: candidates.data, reviews: reviews.data };
}

async function mutationSnapshot(client: SupabaseClient) {
  const products = await client.from("products")
    .select("id,cleansing_profile,updated_at")
    .order("id");
  if (products.error) throw new Error("review_v2_product_mutation_snapshot_failed");
  const metadata = await client.from("product_metadata_field_reviews")
    .select("product_id,request_id,canonical_payload_digest,updated_at")
    .order("product_id");
  if (metadata.error) throw new Error("review_v2_metadata_mutation_snapshot_failed");
  return {
    products: products.data,
    metadata: metadata.data,
    candidates: await candidateStateSnapshot(client),
    auditCount: await count(client, "admin_audit_logs"),
  };
}

function addSecond(value: string): string {
  return new Date(new Date(value).getTime() + 1000).toISOString();
}

async function main(): Promise<void> {
  const [relativeDirectory, actorId, viewerId, requestId] = process.argv.slice(2);
  if (!relativeDirectory || !actorId || !viewerId || !requestId) {
    throw new Error("review_v2_runtime_arguments_required");
  }
  dotenv.config({ path: path.join(ROOT, "crawler/.env"), override: false });
  const directory = path.resolve(ROOT, relativeDirectory);
  const parsed = parseCleanserMetadataV2Package({
    batch: new Uint8Array(await fs.readFile(path.join(directory, "batch.json"))),
    manifest: new Uint8Array(await fs.readFile(path.join(directory, "manifest.csv"))),
    evidence: new Uint8Array(await fs.readFile(path.join(directory, "evidence.jsonl"))),
    reviewed: new Uint8Array(await fs.readFile(path.join(directory, "reviewed.csv"))),
  });
  const readClient = createReviewReadOnlyClient();
  const client = createReviewConfirmClient();
  const dryRun = () => runCleanserMetadataV2DryRun(
    parsed,
    (request) => loadIntakeDatabaseSnapshot(readClient, request),
    ({ productIds }) => metadataSnapshot(readClient, productIds),
  );

  phase = "dry_run";
  const dry = await dryRun();
  assert.deepEqual(
    [dry.summary.status, dry.summary.total_rows, dry.summary.metadata_review_complete,
      dry.summary.reviewed_unknown, dry.summary.reviewed_conflict,
      dry.summary.not_applicable, dry.summary.database_writes],
    ["PASS", 5, 2, 1, 1, 1, 0],
  );
  const confirmation = buildCleanserMetadataV2ConfirmPayload(parsed, dry);
  const rows = confirmation.payload.rows as Array<Record<string, unknown>>;
  const v1Hash = String(confirmation.payload.v1_payload_hash);

  phase = "permission_and_spoof";
  await rpcFail(client, viewerId, "viewer-v2-test", confirmation.payload,
    "admin_product_review_capability_required");
  await rpcFail(client, INACTIVE_ADMIN, "inactive-admin-v2", confirmation.payload,
    "admin_product_review_access_required");
  const actorSpoof = structuredClone(confirmation.payload) as Record<string, unknown>;
  actorSpoof.actor = actorId;
  await rpcFail(client, actorId, "actor-spoof-v2", actorSpoof, "review_v2_payload_schema_invalid");
  const reviewerSpoof = structuredClone(confirmation.payload) as Record<string, unknown>;
  (reviewerSpoof.rows as Array<Record<string, unknown>>)[0].reviewer_id = actorId;
  await rpcFail(client, actorId, "reviewer-spoof-v2", reviewerSpoof, "review_v2_row_schema_invalid");

  phase = "server_negative_controls";
  const mutate = async (
    suffix: string,
    expected: string,
    change: (payload: Record<string, unknown>, row: Record<string, unknown>) => void,
  ) => {
    const payload = structuredClone(confirmation.payload) as Record<string, unknown>;
    change(payload, (payload.rows as Array<Record<string, unknown>>)[0]);
    await rpcFail(client, actorId, `negative-${suffix}`, payload, expected);
  };
  await mutate("foreign", "review_v2_evidence_binding_invalid", (_payload, row) => {
    (row.cleansing_profile_evidence_records as Array<Record<string, unknown>>)[0].candidate_id = MERGE_CANDIDATE;
  });
  await mutate("field", "review_v2_evidence_binding_invalid", (_payload, row) => {
    (row.cleansing_profile_evidence_records as Array<Record<string, unknown>>)[0].field = "texture";
  });
  await mutate("digest", "review_v2_evidence_binding_invalid", (_payload, row) => {
    (row.cleansing_profile_evidence_records as Array<Record<string, unknown>>)[0].evidence_digest = "0".repeat(64);
  });
  await mutate("profile", "review_v2_reviewed_valid_invalid", (_payload, row) => {
    row.cleansing_profile = "strong";
  });
  await mutate("confidence", "review_v2_reviewed_valid_invalid", (_payload, row) => {
    row.cleansing_profile_confidence = "unknown";
  });
  await mutate("state", "review_v2_reviewed_unknown_invalid", (_payload, row) => {
    row.cleansing_profile_review_state = "reviewed_unknown";
    row.structured_metadata_review_complete = false;
  });
  await mutate("row-version", "review_v2_row_version_invalid", (_payload, row) => {
    row.cleansing_profile_review_policy_version = "unknown-policy-v9";
  });
  await mutate("missing-evidence", "review_v2_reviewed_valid_invalid", (_payload, row) => {
    row.cleansing_profile_evidence_refs = [];
    row.cleansing_profile_evidence_records = [];
    row.cleansing_profile_evidence_digest = null;
  });
  await mutate("contract", "review_v2_payload_version_invalid", (payload) => {
    payload.review_contract_version = "admin-product-review-v9";
  });

  phase = "stale_candidate_and_evidence";
  const candidateId = String(rows[0].candidate_id);
  const candidateRead = await client.from("product_candidates")
    .select("id,updated_at").eq("id", candidateId).single();
  if (candidateRead.error || !candidateRead.data) throw new Error("review_v2_candidate_read_failed");
  const staleCandidateAt = addSecond(candidateRead.data.updated_at);
  const staleCandidateMutation = await client.from("product_candidates")
    .update({ updated_at: staleCandidateAt }).eq("id", candidateId)
    .select("id,updated_at").single();
  assertNoError(staleCandidateMutation.error, "review_v2_stale_candidate_mutation_failed");
  assert.equal(new Date(staleCandidateMutation.data.updated_at).toISOString(), staleCandidateAt);
  await rpcFail(client, actorId, "stale-candidate-v2", confirmation.payload, "review_import_stale_candidate");
  const restoreCandidate = await client.from("product_candidates")
    .update({ updated_at: candidateRead.data.updated_at }).eq("id", candidateId);
  assertNoError(restoreCandidate.error, "review_v2_stale_candidate_restore_failed");

  const reviewRead = await client.from("candidate_promotion_reviews")
    .select("candidate_id,evidence_snapshot,updated_at").eq("candidate_id", candidateId).single();
  if (reviewRead.error || !reviewRead.data) throw new Error("review_v2_review_read_failed");
  const staleReviewQueue = await client.from("candidate_promotion_reviews").update({
    evidence_snapshot: { ...(reviewRead.data.evidence_snapshot as Record<string, unknown>), stale: true },
    updated_at: addSecond(reviewRead.data.updated_at),
  }).eq("candidate_id", candidateId);
  assertNoError(staleReviewQueue.error, "review_v2_stale_queue_mutation_failed");
  await rpcFail(client, actorId, "stale-evidence-v2", confirmation.payload,
    "review_import_stale_review_queue");
  const restoreReviewQueue = await client.from("candidate_promotion_reviews").update({
    evidence_snapshot: reviewRead.data.evidence_snapshot,
    updated_at: reviewRead.data.updated_at,
  }).eq("candidate_id", candidateId);
  assertNoError(restoreReviewQueue.error, "review_v2_stale_queue_restore_failed");

  phase = "stale_target_and_review";
  const mergeRow = rows.find((row) => row.candidate_id === MERGE_CANDIDATE);
  assert.ok(mergeRow);
  const target = mergeRow.expected_target_product as Record<string, unknown>;
  const staleTargetAt = addSecond(String(target.updated_at));
  const staleTargetMutation = await client.from("products")
    .update({ updated_at: staleTargetAt })
    .eq("id", target.id)
    .select("id,updated_at")
    .single();
  assertNoError(staleTargetMutation.error, "review_v2_stale_target_mutation_failed");
  if (!staleTargetMutation.data) throw new Error("review_v2_stale_target_mutation_missing");
  assert.equal(new Date(staleTargetMutation.data.updated_at).toISOString(), staleTargetAt);
  await rpcFail(client, actorId, "stale-target-v2", confirmation.payload,
    "review_v2_stale_target_product");
  const restoreTarget = await client.from("products")
    .update({ updated_at: target.updated_at })
    .eq("id", target.id)
    .select("id,updated_at")
    .single();
  assertNoError(restoreTarget.error, "review_v2_stale_target_restore_failed");
  if (!restoreTarget.data) throw new Error("review_v2_stale_target_restore_missing");

  const oldReview = mergeRow.expected_existing_metadata_review as Record<string, unknown>;
  const staleMetadataReview = await client.rpc("test_admin_product_review_v2_set_review_updated_at", {
    p_product_id: MERGE_PRODUCT,
    p_updated_at: addSecond(String(oldReview.updated_at)),
  });
  assertNoError(staleMetadataReview.error, "review_v2_stale_metadata_mutation_failed");
  await rpcFail(client, actorId, "stale-review-v2", confirmation.payload,
    "review_v2_stale_metadata_review");
  const restoreMetadataReview = await client.rpc("test_admin_product_review_v2_set_review_updated_at", {
    p_product_id: MERGE_PRODUCT,
    p_updated_at: oldReview.updated_at,
  });
  assertNoError(restoreMetadataReview.error, "review_v2_stale_metadata_restore_failed");
  assert.equal((await dryRun()).summary.status, "PASS");

  phase = "rollback";
  const productsBefore = await count(client, "products");
  const metadataBefore = await count(client, "product_metadata_field_reviews", "product_id");
  const auditsBefore = await count(client, "admin_audit_logs");
  const stateBeforeRollback = await candidateStateSnapshot(client);
  await rpcFail(client, actorId, "rollback-v2-test", confirmation.payload,
    "review_v2_test_partial_failure");
  assert.equal(await count(client, "products"), productsBefore);
  assert.equal(await count(client, "product_metadata_field_reviews", "product_id"), metadataBefore);
  assert.equal(await count(client, "admin_audit_logs"), auditsBefore);
  assert.deepEqual(await candidateStateSnapshot(client), stateBeforeRollback);
  const v1Lookup = await client.rpc("admin_get_product_review_import_confirmation", {
    p_actor_user_id: actorId,
    p_request_id: "rollback-v2-test",
    p_export_batch_id: parsed.batch.export_batch_id,
    p_payload_hash: v1Hash,
  });
  assert.equal(v1Lookup.error, null);
  assert.equal(v1Lookup.data, null);
  const v2Lookup = await client.rpc("admin_get_product_review_import_v2_confirmation", {
    p_actor_user_id: actorId,
    p_request_id: "rollback-v2-test",
    p_export_batch_id: parsed.batch.export_batch_id,
    p_payload_hash: confirmation.payloadHash,
  });
  assert.equal(v2Lookup.error, null);
  assert.equal(v2Lookup.data, null);

  phase = "browser_roles_and_storage";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("review_v2_anon_env_missing");
  const email = `review-v2-${requestId}@example.test`;
  const password = "LocalReviewV2!12345";
  const created = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("review_v2_auth_create_failed");
  const authenticated = createClient(url, anonKey, { auth: { persistSession: false } });
  assert.equal((await authenticated.auth.signInWithPassword({ email, password })).error, null);
  assert.ok((await authenticated.rpc("admin_confirm_product_review_import_v2_batch", {
    p_actor_user_id: created.data.user.id,
    p_request_id: "auth-direct-v2",
    p_payload: confirmation.payload,
    p_payload_hash: confirmation.payloadHash,
  })).error);
  await client.auth.admin.deleteUser(created.data.user.id);
  assert.ok((await client.from("product_metadata_field_reviews").insert({
    product_id: MERGE_PRODUCT,
    field_name: "cleansing_profile",
  })).error);

  phase = "confirm_retry_conflict";
  const confirmed = await client.rpc("admin_confirm_product_review_import_v2_batch", {
    p_actor_user_id: actorId,
    p_request_id: requestId,
    p_payload: confirmation.payload,
    p_payload_hash: confirmation.payloadHash,
  });
  if (confirmed.error || !confirmed.data) throw new Error("review_v2_confirm_failed");
  const result = confirmed.data;
  assert.deepEqual(
    [result.status, result.total_rows, result.approve_create_new,
      result.approve_merge_existing, result.metadata_writes],
    ["confirmed", 5, 4, 1, 5],
  );
  const beforeRetry = await mutationSnapshot(client);
  const retry = await client.rpc("admin_confirm_product_review_import_v2_batch", {
    p_actor_user_id: actorId,
    p_request_id: requestId,
    p_payload: confirmation.payload,
    p_payload_hash: confirmation.payloadHash,
  });
  assert.equal(retry.error, null);
  assert.deepEqual(retry.data, result);
  assert.deepEqual(await mutationSnapshot(client), beforeRetry);
  const conflictPayload = structuredClone(confirmation.payload) as Record<string, unknown>;
  (conflictPayload.rows as Array<Record<string, unknown>>)[0]
    .structured_metadata_review_complete = false;
  await rpcFail(client, actorId, requestId, conflictPayload, "review_v2_request_id_conflict");
  await rpcFail(client, actorId, `${requestId}-second`, confirmation.payload,
    "review_v2_batch_already_confirmed");

  phase = "state_audit_rls";
  assert.equal(await count(client, "products"), productsBefore + 4);
  assert.equal(await count(client, "product_metadata_field_reviews", "product_id"), 5);
  assert.equal(await count(client, "admin_audit_logs"), auditsBefore + 10);
  const metadata = await client.from("product_metadata_field_reviews")
    .select("candidate_id,review_state,field_value,reviewed_by,review_contract_version")
    .order("candidate_id");
  if (metadata.error) throw new Error("review_v2_metadata_read_failed");
  assert.deepEqual(metadata.data.map((row) => row.review_state).sort(), [
    "not_applicable", "reviewed_conflict", "reviewed_unknown", "reviewed_valid", "reviewed_valid",
  ]);
  assert.ok(metadata.data.every((row) => row.reviewed_by === actorId));
  assert.equal(metadata.data.find((row) => row.candidate_id === MERGE_CANDIDATE)?.field_value, "low_ph");
  const completeness = await client.from("product_metadata_review_completeness_v1")
    .select("structured_metadata_review_complete");
  if (completeness.error) throw new Error("review_v2_completeness_read_failed");
  assert.equal(completeness.data.filter((row) => row.structured_metadata_review_complete).length, 2);

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  assert.ok((await anon.from("product_metadata_field_reviews").select("product_id")).error);
  assert.ok((await anon.from("product_metadata_review_completeness_v1").select("product_id")).error);
  assert.ok((await anon.rpc("admin_confirm_product_review_import_v2_batch", {
    p_actor_user_id: actorId,
    p_request_id: "anon-v2-test",
    p_payload: confirmation.payload,
    p_payload_hash: confirmation.payloadHash,
  })).error);

  process.stdout.write(
    "verify:admin-product-review-cleanser-metadata-v2:local-runtime PASS " +
    "(create/merge valid, unknown, conflict, not-applicable, negative controls, stale, rollback, retry, audit, RLS)\n",
  );
}

main().catch((error) => {
  process.stderr.write("verify:admin-product-review-cleanser-metadata-v2:local-runtime FAIL\n");
  if (error instanceof Error && /^[a-z0-9_]+$/.test(error.message)) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`review_v2_runtime_${phase}_failed\n`);
  }
  process.exitCode = 1;
});
