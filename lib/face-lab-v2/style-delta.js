import { buildTargetActionPool } from "./target-action-pool.js";
import {
  applyCurrentFaceModifiers
} from "./personalization/current-face-modifier.js";


export const STYLE_DELTA_VERSION = "face-lab-style-delta-v3";

const EXECUTION_DOMAINS = new Set([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

function cleanList(values) {
  return Array.isArray(values)
    ? [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]
    : [];
}

function isScopeAllowed(scope, domain) {
  if (scope.has("auto_scope")) return true;
  return scope.has(domain);
}

function hardExclusions(targetStyle) {
  return new Set(cleanList(targetStyle?.constraints?.hardExclusions));
}

function applyScopeAndConstraints(actions, targetStyle) {
  const scope = new Set(cleanList(targetStyle?.stylingScope));
  const exclusions = hardExclusions(targetStyle);
  const makeupIntensity = targetStyle?.constraints?.makeup?.intensity || null;
  const makeupExcludedByIntensity = ["grooming_only", "none"].includes(makeupIntensity);

  return actions
    .filter((item) => EXECUTION_DOMAINS.has(item.domain))
    .map((item) => {
      if (!isScopeAllowed(scope, item.domain)) {
        return {
          ...item,
          constraintState: "blocked",
          blockedBy: "domain_not_requested"
        };
      }

      if (item.domain === "makeup" && makeupExcludedByIntensity) {
        return {
          ...item,
          constraintState: "blocked",
          blockedBy: "makeup_intensity_exclusion"
        };
      }

      const blockKeys = [
        `${item.domain}:${item.parameter}`,
        `${item.domain}_disabled`
      ];

      const blockedBy = blockKeys.find((key) => exclusions.has(key));
      return blockedBy
        ? { ...item, constraintState: "blocked", blockedBy }
        : item;
    });
}

export function buildStyleDelta({
  currentFaceProfile,
  targetStyle
} = {}) {
  if (!currentFaceProfile || !["available", "partial"].includes(currentFaceProfile.status)) {
    return {
      status: "unavailable",
      version: STYLE_DELTA_VERSION,
      summary: null,
      priorities: [],
      preservedFeatures: [],
      conflicts: [],
      confidence: null,
      evidence: [],
      unavailableReason: "current_face_profile_unavailable"
    };
  }

  if (!targetStyle || targetStyle.status !== "available" || targetStyle.approvedByUser !== true) {
    return {
      status: "insufficient_evidence",
      version: STYLE_DELTA_VERSION,
      summary: null,
      priorities: [],
      preservedFeatures: [],
      conflicts: [],
      confidence: null,
      evidence: [],
      unavailableReason: "target_style_not_confirmed"
    };
  }

  const rawActions = buildTargetActionPool(targetStyle);
  const guarded = applyCurrentFaceModifiers(
    rawActions,
    currentFaceProfile,
    {
      recommendationPriority:
        targetStyle.recommendationPriority
    }
  );
  const finalActions = applyScopeAndConstraints(guarded.actions, targetStyle);

  const active = finalActions.filter((item) => item.constraintState !== "blocked");
  const blocked = finalActions.filter((item) => item.constraintState === "blocked");

  active.forEach((item, index) => {
    item.rank = index + 1;
  });
  blocked.forEach((item, index) => {
    item.rank = active.length + index + 1;
  });

  const evidence = [...new Set([
    ...(currentFaceProfile.evidence || []).slice(0, 8),
    ...(targetStyle.preferenceEvidence || []).slice(0, 8)
  ])];

  return {
    status: active.length ? "available" : "partial",
    version: STYLE_DELTA_VERSION,
    targetProfileVersion: targetStyle.profileVersion || null,
    faceProfileVersion: currentFaceProfile.profileVersion || null,
    summary: active.length
      ? "현재 얼굴의 특징을 유지하면서 선택한 추구미로 이동할 수 있는 스타일 변화 방향을 정리했습니다."
      : "선택한 범위와 제약 안에서 바로 적용할 수 있는 변화가 제한적입니다.",
    priorities: [...active, ...blocked],
    preservedFeatures: currentFaceProfile.keyFeatures.slice(0, 3).map((feature) => ({
      feature: feature.key,
      reason: "현재 관찰된 특징은 제거 대상이 아니라 스타일 조합에서 보존하거나 조절할 기준으로 사용합니다."
    })),
    conflicts: guarded.conflicts,
    confidence: active.length ? Math.min(1, Number(((currentFaceProfile.confidence || 0.5) * 0.7 + 0.3).toFixed(2))) : 0.4,
    evidence,
    unavailableReason: active.length ? null : "no_actionable_style_delta"
  };
}
