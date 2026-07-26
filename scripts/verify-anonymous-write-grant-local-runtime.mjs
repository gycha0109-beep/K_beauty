import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  canonicalizeAnonymousResultForPersistence,
  createAnonymousWriteGrantTokens
} from "../lib/security/anonymous-write-grant-core.js";

const MARKERS = new Set([
  "anonymous_grant_canonicalization_failed",
  "anonymous_grant_rpc_failed",
  "anonymous_grant_created_count_invalid",
  "anonymous_grant_row_contract_invalid",
  "anonymous_grant_cleanup_failed",
  "remote_supabase_url_rejected"
]);

class VerificationFailure extends Error {
  constructor(marker) {
    super(marker);
    this.marker = marker;
  }
}

function fail(marker) {
  throw new VerificationFailure(marker);
}

function isLocalSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      Boolean(url.port) &&
      url.pathname === "/"
    );
  } catch {
    return false;
  }
}

function normalizeRpcJson(data) {
  if (!data) return null;
  if (typeof data !== "string") return data;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function createSyntheticResult() {
  return {
    summary: "synthetic summary",
    priority: { label: "synthetic priority" },
    topPick: { id: "synthetic-product-1", name: "Synthetic Product" },
    alternative: { id: "synthetic-product-2", name: "Synthetic Alternative" },
    amFocus: "protect",
    pmFocus: "recover",
    routineStructure: { mode: "balanced" },
    morning: ["cleanse"],
    night: ["cleanse"],
    warnings: ["patch test"],
    photoEvidence: ["one visible face"],
    photoObservations: { source: "synthetic" },
    imageEligibility: {
      status: "eligible",
      source: "vision",
      imageType: "photorealistic_human",
      humanFaceCount: 1,
      faceLabEligible: true,
      skinAnalysisEligible: true,
      faceLabFailureReason: null,
      skinFailureReason: null,
      confidence: 0.94,
      evidence: ["one visible face with usable skin detail"]
    },
    surveyEvidence: ["synthetic concern"],
    scoring: { syntheticConcern: 0.8 }
  };
}

function createSyntheticSurvey() {
  return {
    skinType: "dry",
    sensitivityLevel: "sensitive",
    mainConcern: "redness",
    mainConcerns: ["redness"],
    cleansingFrequency: "daily",
    preferredTexture: "gel",
    postWashFeeling: "tight",
    afternoonSkinChange: "dry",
    environmentExposure: ["outdoor"],
    mostDislikedFeel: "sticky"
  };
}

function toRpcGrant(grant) {
  return {
    jti_hash: grant.jtiHash,
    version: grant.version,
    purpose: grant.purpose,
    resource_type: grant.resourceType,
    resource_id: grant.resourceId,
    operation: grant.operation,
    principal_hash: grant.principalHash,
    expected_fingerprint_hash: grant.expectedFingerprintHash,
    max_uses: grant.maxUses,
    issued_at: grant.issuedAt,
    expires_at: grant.expiresAt
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!isLocalSupabaseUrl(supabaseUrl)) {
    fail("remote_supabase_url_rejected");
  }
  if (!serviceRoleKey) {
    fail("anonymous_grant_rpc_failed");
  }

  const canonicalResult = canonicalizeAnonymousResultForPersistence(createSyntheticResult());
  if (!canonicalResult) {
    fail("anonymous_grant_canonicalization_failed");
  }

  let bundle = null;
  try {
    bundle = createAnonymousWriteGrantTokens({
      secret: randomBytes(32).toString("base64url"),
      anonymousPayload: randomBytes(32).toString("base64url"),
      result: canonicalResult,
      form: createSyntheticSurvey(),
      locale: "ko"
    });
  } catch {
    fail("anonymous_grant_canonicalization_failed");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  let failureMarker = null;

  try {
    let rpcResponse = null;
    try {
      rpcResponse = await supabase.rpc("create_anonymous_write_grants", {
        p_grants: bundle.grants.map(toRpcGrant)
      });
    } catch {
      fail("anonymous_grant_rpc_failed");
    }

    if (rpcResponse?.error) {
      fail("anonymous_grant_rpc_failed");
    }
    if (normalizeRpcJson(rpcResponse?.data)?.created !== 2) {
      fail("anonymous_grant_created_count_invalid");
    }

    const { data: rows, error: rowError } = await supabase
      .from("anonymous_write_grants")
      .select("resource_id,operation")
      .eq("resource_id", bundle.analysisRunId);

    const operations = Array.isArray(rows)
      ? rows.map((row) => row.operation).sort()
      : [];
    if (
      rowError ||
      !Array.isArray(rows) ||
      rows.length !== 2 ||
      rows.some((row) => row.resource_id !== bundle.analysisRunId) ||
      operations.join(",") !== "result:create,track:create"
    ) {
      fail("anonymous_grant_row_contract_invalid");
    }
  } catch (error) {
    failureMarker = error instanceof VerificationFailure && MARKERS.has(error.marker)
      ? error.marker
      : "anonymous_grant_rpc_failed";
  } finally {
    let cleanupPassed = false;
    try {
      const { error: deleteError } = await supabase
        .from("anonymous_write_grants")
        .delete()
        .eq("resource_id", bundle.analysisRunId);
      const { count, error: countError } = await supabase
        .from("anonymous_write_grants")
        .select("id", { count: "exact", head: true })
        .eq("resource_id", bundle.analysisRunId);

      cleanupPassed = !deleteError && !countError && count === 0;
    } catch {
      cleanupPassed = false;
    }

    if (!cleanupPassed) {
      failureMarker = "anonymous_grant_cleanup_failed";
    }
  }

  if (failureMarker) {
    fail(failureMarker);
  }

  console.log("[anonymous-write-grant-local-runtime] PASS");
}

main().catch((error) => {
  const marker = error instanceof VerificationFailure && MARKERS.has(error.marker)
    ? error.marker
    : "anonymous_grant_rpc_failed";
  console.error(marker);
  process.exitCode = 1;
});
