import { buildTargetActionPool } from "./target-action-pool.js";

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

function keyFeatureDirection(profile, key) {
  return profile?.keyFeatures?.find((item) => item?.key === key)?.direction || null;
}

function isScopeAllowed(scope, domain) {
  if (scope.has("auto_scope")) return true;
  return scope.has(domain);
}

function hardExclusions(targetStyle) {
  return new Set(cleanList(targetStyle?.constraints?.hardExclusions));
}

function applyFaceModifiers(actions, currentFaceProfile) {
  const conflicts = [];
  const eyeDirection = keyFeatureDirection(currentFaceProfile, "eyeDirection");
  const contourDefinition = keyFeatureDirection(currentFaceProfile, "contourDefinition");
  const featureContrast = keyFeatureDirection(currentFaceProfile, "featureContrast");
  const lineBalance = keyFeatureDirection(currentFaceProfile, "straightCurveBalance");

  const modifiedActions = actions.map((item) => {
    const next = { ...item, evidence: [...item.evidence] };

    if (
      item.domain === "makeup" &&
      item.parameter === "outerEyeEmphasis" &&
      eyeDirection === "upturned"
    ) {
      next.parameter = "eyeDefinition";
      next.strength = "light";
      next.expectedEffect = "이미 상향 흐름이 보이는 눈매를 더 끌어올리기보다 선명도와 길이 조절로 목표 인상을 보탭니다.";
      next.reason = "face_modifier_eye_direction_already_upturned";
      next.evidence.push("face_feature:eyeDirection=upturned");
      conflicts.push({
        type: "over_amplification_guard",
        domains: ["makeup"],
        description: "이미 상향 흐름이 보이는 눈매에 추가 상승 방향을 중첩하지 않습니다.",
        resolution: "상승 각도 대신 눈의 선명도와 길이 쪽으로 이동합니다."
      });
    }

    if (
      item.domain === "makeup" &&
      item.parameter === "selectedFeatureContrast" &&
      featureContrast === "high"
    ) {
      next.strength = "light";
      next.expectedEffect = "이미 특징 대비가 높은 편이므로 전체 대비를 더 올리기보다 한 부위만 선택적으로 강조합니다.";
      next.reason = "face_modifier_existing_feature_contrast_high";
      next.evidence.push("face_feature:featureContrast=high");
      conflicts.push({
        type: "contrast_guard",
        domains: ["makeup"],
        description: "현재 특징 대비가 높은 상태에서 모든 부위의 대비를 함께 올리지 않습니다.",
        resolution: "한 부위 중심의 제한된 포인트로 전환합니다."
      });
    }

    if (
      item.domain === "hair" &&
      item.parameter === "outlineDefinition" &&
      contourDefinition === "defined"
    ) {
      next.direction = "maintain";
      next.strength = "light";
      next.expectedEffect = "이미 윤곽이 선명하게 읽히므로 헤어 외곽은 추가로 날카롭게 만들기보다 정돈된 수준을 유지합니다.";
      next.reason = "face_modifier_contour_already_defined";
      next.evidence.push("face_feature:contourDefinition=defined");
    }

    if (
      item.domain === "hair" &&
      item.parameter === "curvature" &&
      lineBalance === "curved"
    ) {
      next.direction = "maintain";
      next.strength = "light";
      next.expectedEffect = "이미 곡선 흐름이 보이므로 과한 컬보다 자연스러운 곡선감을 유지하는 쪽으로 제한합니다.";
      next.reason = "face_modifier_line_already_curved";
      next.evidence.push("face_feature:straightCurveBalance=curved");
    }

    return next;
  });

  return { actions: modifiedActions, conflicts };
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
  const guarded = applyFaceModifiers(rawActions, currentFaceProfile);
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
