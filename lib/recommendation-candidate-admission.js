import "server-only";
import {
  RECOMMENDATION_ADMISSION_AUTHORITY_READ_CONTRACT_VERSION,
  RECOMMENDATION_ADMISSION_AUTHORITY_STATUS,
  buildG2Input,
  buildPdaMapperInput,
} from "@/lib/recommendation-admission-authority-contract.mjs";
import { readRecommendationAdmissionAuthority } from "@/lib/recommendation-admission-authority-reader";
import {
  LEGACY_RECOMMENDATION_CORPUS_IDS,
  isExactLegacyRecommendationCorpusMember,
} from "@/lib/recommendation-legacy-corpus-v1.mjs";
import {
  INITIAL_ADMISSION_POLICY_VERSION,
  evaluateInitialAdmissionGrant,
} from "../scripts/product-evidence/initial-admission-grant-policy-v1.mjs";
import {
  VERSION as PDA_MAPPER_VERSION,
  materialize as materializeExfoliationPda,
} from "../scripts/product-evidence/exfoliation-non-numeric-pda-offline-shadow-v1.mjs";

export const RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION =
  "production-recommendation-candidate-admission-v1";
export const RECOMMENDATION_CANDIDATE_ADMISSION_MAX_NONLEGACY_READS = 64;
export const RECOMMENDATION_CANDIDATE_ADMISSION_CONCURRENCY = 1;

export const RECOMMENDATION_CANDIDATE_ADMISSION_TYPE = Object.freeze({
  LEGACY: "LEGACY_COMPATIBILITY_ADMISSION",
  INITIAL_GRANT: "INITIAL_ADMISSION_GRANT",
  REJECTED: "REJECTED",
});

const UUID_LOWERCASE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INFRASTRUCTURE_REASON_PREFIXES = Object.freeze([
  "PF_AUTHORITY_CREDENTIAL_UNAVAILABLE",
  "PF_AUTHORITY_READ_TIMEOUT",
  "PF_AUTHORITY_READ_FAILED",
  "MALFORMED_",
  "READ_CONTRACT_VERSION_MISMATCH",
  "AMBIGUOUS_CURRENT_AUTHORITY",
  "STALE_CURRENT_FACT",
  "STALE_SUBJECT",
  "NON_CURRENT_SUBJECT",
]);

export class RecommendationCandidateAdmissionInfrastructureError extends Error {
  constructor(reason, options = {}) {
    super("Recommendation candidate admission authority is unavailable.");
    this.name = "RecommendationCandidateAdmissionInfrastructureError";
    this.code = "RECOMMENDATION_CANDIDATE_ADMISSION_INFRASTRUCTURE_FAILURE";
    this.reason = String(reason || "ADMISSION_INFRASTRUCTURE_FAILURE");
    this.cause = options.cause;
  }
}

function isStrictCanonicalProductId(value) {
  return typeof value === "string" && UUID_LOWERCASE_RE.test(value);
}

function isInfrastructureAuthorityReason(reason) {
  const normalized = String(reason || "");
  return INFRASTRUCTURE_REASON_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function freezeDecision({ admissionType, product, reasonCodes = [], pda = null, g2 = null }) {
  return Object.freeze({
    contractVersion: RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION,
    admissionType,
    product,
    reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
    pda,
    g2,
  });
}

export async function evaluateRecommendationCandidateAdmission(
  product,
  {
    reader = readRecommendationAdmissionAuthority,
    pdaMapper = materializeExfoliationPda,
    g2Evaluator = evaluateInitialAdmissionGrant,
  } = {},
) {
  const productId = product?.id;
  if (!isStrictCanonicalProductId(productId)) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "INVALID_CANONICAL_PRODUCT_IDENTITY",
    );
  }

  if (isExactLegacyRecommendationCorpusMember(productId)) {
    return freezeDecision({
      admissionType: RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.LEGACY,
      product,
      reasonCodes: ["EXACT_FROZEN_LEGACY_CORPUS_MEMBER"],
    });
  }

  let resolved;
  try {
    resolved = await reader(productId);
  } catch (error) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "PF_AUTHORITY_READER_THROW",
      { cause: error },
    );
  }

  if (!resolved || resolved.readContractVersion !== RECOMMENDATION_ADMISSION_AUTHORITY_READ_CONTRACT_VERSION) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "READ_CONTRACT_VERSION_MISMATCH",
    );
  }

  if (resolved.status !== RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.RESOLVED) {
    const reason = String(resolved.reason || "PF_AUTHORITY_UNAVAILABLE");
    if (isInfrastructureAuthorityReason(reason)) {
      throw new RecommendationCandidateAdmissionInfrastructureError(reason);
    }
    return freezeDecision({
      admissionType: RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED,
      product,
      reasonCodes: [`AUTHORITY_REJECTED:${reason}`],
    });
  }

  if (
    resolved.authority?.product?.product_id !== productId ||
    resolved.authority?.product?.category !== String(product?.category || "")
  ) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "AUTHORITY_PRODUCT_BINDING_MISMATCH",
    );
  }

  const mapperInput = buildPdaMapperInput(resolved);
  if (!mapperInput) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "PDA_MAPPER_INPUT_UNAVAILABLE",
    );
  }

  let mapperResult;
  try {
    mapperResult = pdaMapper(
      mapperInput.product,
      mapperInput.facts,
      mapperInput.subject,
    );
  } catch (error) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "PDA_MAPPER_FAILURE",
      { cause: error },
    );
  }

  const g2Input = buildG2Input(resolved, mapperResult, PDA_MAPPER_VERSION);
  if (!g2Input) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "G2_INPUT_UNAVAILABLE",
    );
  }

  let g2;
  try {
    g2 = g2Evaluator(g2Input, {
      legacyIds: new Set(LEGACY_RECOMMENDATION_CORPUS_IDS),
    });
  } catch (error) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "G2_EVALUATOR_FAILURE",
      { cause: error },
    );
  }

  const pda = mapperResult?.pda || null;
  if (g2?.decision !== "INITIAL_ADMISSION_GRANT" || g2?.grant !== true) {
    return freezeDecision({
      admissionType: RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED,
      product,
      reasonCodes: [
        `G2_DECISION:${String(g2?.decision || "UNKNOWN")}`,
        ...(Array.isArray(g2?.reasons) ? g2.reasons : []),
      ],
      pda,
      g2,
    });
  }

  return freezeDecision({
    admissionType: RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.INITIAL_GRANT,
    product,
    reasonCodes: [
      `G2_POLICY:${INITIAL_ADMISSION_POLICY_VERSION}`,
      "INITIAL_ADMISSION_GRANT_CONFIRMED",
    ],
    pda,
    g2,
  });
}

export async function admitRecommendationProducts(
  rawProducts,
  dependencies = {},
) {
  if (!Array.isArray(rawProducts)) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "RAW_PRODUCT_SET_MALFORMED",
    );
  }

  const nonlegacyCount = rawProducts.reduce((count, product) => {
    const id = product?.id;
    if (!isStrictCanonicalProductId(id)) {
      throw new RecommendationCandidateAdmissionInfrastructureError(
        "INVALID_CANONICAL_PRODUCT_IDENTITY",
      );
    }
    return count + (isExactLegacyRecommendationCorpusMember(id) ? 0 : 1);
  }, 0);

  if (nonlegacyCount > RECOMMENDATION_CANDIDATE_ADMISSION_MAX_NONLEGACY_READS) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "NONLEGACY_AUTHORITY_READ_SCALE_CEILING_EXCEEDED",
    );
  }

  const decisions = [];
  let legacyAdmittedCount = 0;
  let nonlegacyCheckedCount = 0;
  let nonlegacyGrantedCount = 0;
  let nonlegacyRejectedCount = 0;

  // Deliberately sequential. G3A currently owns one pooled DB connection and one UUID RPC.
  // The explicit 64-product ceiling prevents an unbounded N+1 workload.
  for (const product of rawProducts) {
    const legacy = isExactLegacyRecommendationCorpusMember(product.id);
    const decision = await evaluateRecommendationCandidateAdmission(product, dependencies);
    decisions.push(decision);

    if (legacy) {
      legacyAdmittedCount += 1;
    } else {
      nonlegacyCheckedCount += 1;
      if (decision.admissionType === RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.INITIAL_GRANT) {
        nonlegacyGrantedCount += 1;
      } else {
        nonlegacyRejectedCount += 1;
      }
    }
  }

  return Object.freeze({
    contractVersion: RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION,
    decisions: Object.freeze(decisions),
    summary: Object.freeze({
      enumeratedCount: rawProducts.length,
      legacyAdmittedCount,
      nonlegacyCheckedCount,
      nonlegacyGrantedCount,
      nonlegacyRejectedCount,
      authorityFailureCount: 0,
      concurrency: RECOMMENDATION_CANDIDATE_ADMISSION_CONCURRENCY,
      maxNonlegacyReads: RECOMMENDATION_CANDIDATE_ADMISSION_MAX_NONLEGACY_READS,
    }),
  });
}

export function projectAdmittedRecommendationProducts(admissionResult, projector) {
  if (!admissionResult || !Array.isArray(admissionResult.decisions)) {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "ADMISSION_RESULT_MALFORMED",
    );
  }
  if (typeof projector !== "function") {
    throw new RecommendationCandidateAdmissionInfrastructureError(
      "ADMISSION_PROJECTOR_REQUIRED",
    );
  }

  const projected = [];
  for (const decision of admissionResult.decisions) {
    if (decision.admissionType === RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED) {
      continue;
    }
    const product = projector(decision.product, decision);
    if (product) projected.push(product);
  }
  return projected;
}
