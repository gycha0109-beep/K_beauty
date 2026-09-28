import { createHash } from "node:crypto";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import {
  buildCandidateStyleDelta,
  CANDIDATE_STYLE_DELTA_VERSION
} from "../candidate-style-delta.js";
import {
  buildStyleRoutes
} from "../route-generator.js";
import {
  STYLE_DELTA_VERSION
} from "../style-delta.js";
import {
  buildFaceLabV2TargetSweepCohort
} from "./target-responsiveness.js";
import {
  runFaceLabV2CandidatePersonalizationEvaluation
} from "./candidate-personalization.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE,
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA,
  canonicalizeFaceLabV2HumanPairwiseArtifact
} from "./human-pairwise-contract.js";

export const FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION =
  "face-lab-v2-human-pairwise-builder-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA =
  "face-lab-v2-human-pairwise-review-packet-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA =
  "face-lab-v2-human-pairwise-operator-manifest-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_SAMPLE_SEED =
  "face-lab-v2-human-pairwise-sample-v1";

export const FACE_LAB_V2_HUMAN_PAIRWISE_FROZEN_CREATED_AT =
  "2026-09-28T19:41:00.000Z";

export const FACE_LAB_V2_HIGH_REPETITION_TARGETS = Object.freeze([
  "classic",
  "mature_calm",
  "minimal",
  "natural",
  "sophisticated",
  "trendy"
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digestWithout(value, digestKey) {
  return sha256Hex(
    stableStringify(
      Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== digestKey)
      )
    )
  );
}

function sealReviewItem(value) {
  const next = {
    ...structuredClone(value),
    itemDigest: "0".repeat(64)
  };
  const payload =
    canonicalizeFaceLabV2HumanPairwiseArtifact(
      next,
      "itemDigest"
    );
  next.itemDigest = sha256Hex(payload);
  return next;
}

function selectedCurrentRoute(canonical) {
  return (canonical?.routes?.routes || []).find(
    (route) =>
      route.routeId === canonical?.routes?.selectedRouteId
  ) || null;
}

function selectedCandidateRoute(routes) {
  const list = Array.isArray(routes?.routes)
    ? routes.routes
    : [];
  if (!list.length) return null;

  if (routes.defaultRouteId) {
    const found = list.find(
      (route) => route.routeId === routes.defaultRouteId
    );
    if (found) return found;
  }

  return list[0];
}

function reviewerSafeReason(reason) {
  if (reason === "candidate_face_fit_curve_alignment") {
    return "face_fit_curve_alignment";
  }
  if (reason === "candidate_face_fit_straight_alignment") {
    return "face_fit_straight_alignment";
  }
  return reason;
}

function reviewerSafeEvidence(values) {
  return (Array.isArray(values) ? values : [])
    .filter(
      (value) =>
        typeof value === "string" &&
        !value.startsWith("candidate_relation:")
    );
}

function projectVisibleAction(action) {
  return {
    domain: action.domain,
    parameter: action.parameter,
    direction: action.direction,
    strength: action.strength,
    reason: reviewerSafeReason(action.reason),
    evidence: reviewerSafeEvidence(action.evidence),
    explanation: action.explanation
  };
}

function projectVisibleOption(route) {
  const projected = {
    routeStrategy: route.strategy,
    actions: (route.actions || []).map(projectVisibleAction)
  };

  return {
    recommendationDigest: sha256Hex(
      stableStringify(projected)
    ),
    ...projected
  };
}

function projectContext(canonical, caseDef) {
  const targetStyle = canonical.targetStyle;
  const currentFaceProfile = canonical.currentFaceProfile;

  return {
    targetLabel: caseDef.targetKey,
    targetVector: {
      softSharp: targetStyle.vector.softSharp,
      naturalPolished: targetStyle.vector.naturalPolished,
      playfulMature: targetStyle.vector.playfulMature,
      minimalStatement: targetStyle.vector.minimalStatement,
      warmCool: targetStyle.vector.warmCool,
      classicTrendy: targetStyle.vector.classicTrendy
    },
    currentFaceFeatures: (currentFaceProfile.keyFeatures || [])
      .filter(
        (item) =>
          typeof item?.key === "string" &&
          typeof item?.direction === "string" &&
          Array.isArray(item?.evidence) &&
          item.evidence.length > 0
      )
      .map((item) => ({
        key: item.key,
        direction: item.direction,
        evidence: [...item.evidence]
      })),
    stylingScope: [...(targetStyle.stylingScope || [])],
    constraints: {
      changeTolerance: targetStyle.changeTolerance || null,
      makeupIntensity:
        targetStyle.constraints?.makeup?.intensity || null,
      dailyMinutes:
        targetStyle.constraints?.lifestyle?.dailyMinutes ?? null,
      budgetBand:
        targetStyle.constraints?.lifestyle?.budgetBand || null,
      maintenanceTolerance:
        targetStyle.constraints?.lifestyle?.maintenanceTolerance || null,
      hardExclusions: [
        ...(targetStyle.constraints?.hardExclusions || [])
      ]
    }
  };
}

function buildCaseArtifacts(caseDef) {
  const canonical = buildFaceLabV2Canonical({
    analysis: caseDef.analysis,
    surveyAnswers: caseDef.surveyAnswers,
    resultId: caseDef.caseId
  });

  const candidateStyleDelta =
    buildCandidateStyleDelta({
      currentFaceProfile: canonical.currentFaceProfile,
      targetStyle: canonical.targetStyle
    });

  const candidateRoutes = buildStyleRoutes(
    candidateStyleDelta,
    {
      locale: "ko",
      targetStyle: canonical.targetStyle
    }
  );

  const currentRoute = selectedCurrentRoute(canonical);
  const candidateRoute =
    selectedCandidateRoute(candidateRoutes);

  if (!currentRoute || !candidateRoute) {
    throw new Error(
      "human pairwise builder requires two visible routes: " +
        caseDef.caseId
    );
  }

  return {
    canonical,
    candidateStyleDelta,
    currentOption: projectVisibleOption(currentRoute),
    candidateOption: projectVisibleOption(candidateRoute),
    relationIds: [
      ...new Set(
        (candidateStyleDelta.personalizationLedger || [])
          .map((entry) => entry.relationId)
      )
    ]
  };
}

function sampleHash(label, caseId) {
  return sha256Hex(
    FACE_LAB_V2_HUMAN_PAIRWISE_SAMPLE_SEED +
      "|" +
      label +
      "|" +
      caseId
  );
}

function selectSampleCases() {
  const evaluation =
    runFaceLabV2CandidatePersonalizationEvaluation();
  const cohort = buildFaceLabV2TargetSweepCohort();
  const casesById = new Map(
    cohort.cases.map((item) => [item.caseId, item])
  );

  const rowsById = new Map(
    evaluation.rows.map((row) => [row.caseId, row])
  );

  const selected = [];

  evaluation.rows
    .filter((row) => row.selectedRouteChanged)
    .forEach((row) => {
      selected.push({
        caseDef: casesById.get(row.caseId),
        row,
        sampleBucket: "route_mutation"
      });
    });

  evaluation.rows
    .filter(
      (row) =>
        row.candidateRelationIds.length > 0 &&
        !row.selectedRouteChanged
    )
    .forEach((row) => {
      selected.push({
        caseDef: casesById.get(row.caseId),
        row,
        sampleBucket: "activation_boundary"
      });
    });

  for (const targetKey of FACE_LAB_V2_HIGH_REPETITION_TARGETS) {
    const candidates = cohort.cases
      .filter((item) => item.targetKey === targetKey)
      .map((caseDef) => ({
        caseDef,
        row: rowsById.get(caseDef.caseId)
      }))
      .sort((left, right) =>
        sampleHash(
          "high_repetition",
          left.caseDef.caseId
        ).localeCompare(
          sampleHash(
            "high_repetition",
            right.caseDef.caseId
          )
        )
      );

    const chosen = candidates[0];
    if (!chosen) {
      throw new Error(
        "missing high-repetition target case: " + targetKey
      );
    }

    selected.push({
      ...chosen,
      sampleBucket: "high_repetition"
    });
  }

  return selected.sort((left, right) =>
    sampleHash(
      "packet_order",
      left.caseDef.caseId +
        "|" +
        left.sampleBucket
    ).localeCompare(
      sampleHash(
        "packet_order",
        right.caseDef.caseId +
          "|" +
          right.sampleBucket
      )
    )
  );
}

function pairId(caseId) {
  return (
    "flhp_" +
    sha256Hex(
      FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION +
        "|pair|" +
        caseId
    ).slice(0, 24)
  );
}

function buildArtifacts({
  createdAt =
    FACE_LAB_V2_HUMAN_PAIRWISE_FROZEN_CREATED_AT
} = {}) {
  const sampled = selectSampleCases();
  const reviewItems = [];
  const mappings = [];

  sampled.forEach((sample, index) => {
    const artifacts = buildCaseArtifacts(sample.caseDef);
    const currentOnA = index % 2 === 0;

    const A = currentOnA
      ? artifacts.currentOption
      : artifacts.candidateOption;
    const B = currentOnA
      ? artifacts.candidateOption
      : artifacts.currentOption;

    const item = sealReviewItem({
      schemaVersion:
        FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA,
      contractVersion:
        FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
      pairId: pairId(sample.caseDef.caseId),
      evaluationCaseRef: sample.caseDef.caseId,
      context: projectContext(
        artifacts.canonical,
        sample.caseDef
      ),
      options: {
        A,
        B
      },
      blindState: {
        ...FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE
      },
      createdAt
    });

    reviewItems.push(item);

    mappings.push({
      pairId: item.pairId,
      evaluationCaseRef: sample.caseDef.caseId,
      targetKey: sample.caseDef.targetKey,
      sampleBucket: sample.sampleBucket,
      candidateRelationIds: [...artifacts.relationIds],
      selectedRouteChanged:
        sample.row?.selectedRouteChanged === true,
      mapping: {
        A: {
          role: currentOnA ? "current" : "candidate",
          engineVersion: currentOnA
            ? STYLE_DELTA_VERSION
            : CANDIDATE_STYLE_DELTA_VERSION,
          recommendationDigest:
            item.options.A.recommendationDigest
        },
        B: {
          role: currentOnA ? "candidate" : "current",
          engineVersion: currentOnA
            ? CANDIDATE_STYLE_DELTA_VERSION
            : STYLE_DELTA_VERSION,
          recommendationDigest:
            item.options.B.recommendationDigest
        }
      }
    });
  });

  const packetId =
    "flhpb_" +
    sha256Hex(
      FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION +
        "|" +
        reviewItems.map((item) => item.pairId).join("|")
    ).slice(0, 24);

  const reviewPacketBase = {
    schemaVersion:
      FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA,
    builderVersion:
      FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION,
    contractVersion:
      FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
    packetId,
    dimensions: [
      ...FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS
    ],
    reviewItems,
    createdAt
  };

  const reviewPacket = {
    ...reviewPacketBase,
    packetDigest: sha256Hex(
      stableStringify(reviewPacketBase)
    )
  };

  const bucketCounts = {};
  mappings.forEach((item) => {
    bucketCounts[item.sampleBucket] =
      (bucketCounts[item.sampleBucket] || 0) + 1;
  });

  const operatorBase = {
    schemaVersion:
      FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA,
    builderVersion:
      FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION,
    contractVersion:
      FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
    packetId,
    reviewPacketDigest: reviewPacket.packetDigest,
    createdAt,
    sampling: {
      seed: FACE_LAB_V2_HUMAN_PAIRWISE_SAMPLE_SEED,
      pairCount: mappings.length,
      bucketCounts,
      highRepetitionTargets: [
        ...FACE_LAB_V2_HIGH_REPETITION_TARGETS
      ]
    },
    mappings
  };

  const operatorManifest = {
    ...operatorBase,
    manifestDigest: sha256Hex(
      stableStringify(operatorBase)
    )
  };

  return {
    reviewPacket,
    operatorManifest
  };
}

export function buildFaceLabV2HumanPairwiseReviewPacket(
  options = {}
) {
  return buildArtifacts(options).reviewPacket;
}

export function buildFaceLabV2HumanPairwiseOperatorManifest(
  options = {}
) {
  return buildArtifacts(options).operatorManifest;
}

export function verifyFaceLabV2HumanPairwisePacketDigest(
  packet
) {
  return Boolean(
    packet &&
    packet.packetDigest ===
      digestWithout(packet, "packetDigest")
  );
}

export function verifyFaceLabV2HumanPairwiseOperatorManifestDigest(
  manifest
) {
  return Boolean(
    manifest &&
    manifest.manifestDigest ===
      digestWithout(manifest, "manifestDigest")
  );
}
