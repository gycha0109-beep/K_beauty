export const STYLE_DELTA_VERSION = "face-lab-style-delta-v2";

const EXECUTION_DOMAINS = new Set([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

function clamp01(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

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

function action({
  domain,
  parameter,
  direction,
  strength,
  expectedEffect,
  reason,
  evidence = [],
  blockedBy = null
}) {
  return {
    rank: 0,
    domain,
    parameter,
    direction,
    strength,
    expectedEffect,
    reason,
    evidence: cleanList(evidence),
    constraintState: blockedBy ? "blocked" : "allowed",
    blockedBy
  };
}

function getTargetAxis(vector, key) {
  return clamp01(vector?.[key]);
}

function buildTargetActions(targetStyle) {
  const vector = targetStyle?.vector || {};
  const actions = [];

  const softSharp = getTargetAxis(vector, "softSharp");
  if (softSharp !== null && softSharp >= 0.64) {
    actions.push(
      action({
        domain: "hair",
        parameter: "outlineDefinition",
        direction: "increase",
        strength: softSharp >= 0.78 ? "strong" : "moderate",
        expectedEffect: "헤어 외곽과 가르마의 구조감을 높여 목표의 선명한 방향을 강화합니다.",
        reason: "target_softSharp_high",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "brow_grooming",
        parameter: "definition",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "눈썹의 경계를 조금 더 정돈해 얼굴 주변 선의 구조감을 높입니다.",
        reason: "target_softSharp_high",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "makeup",
        parameter: "outerEyeEmphasis",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "눈 바깥쪽의 방향성을 조금 더 분명하게 만들어 선명한 인상을 보탭니다.",
        reason: "target_softSharp_high",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "eyewear",
        parameter: "angularity",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "안경테를 선택한다면 곡선 일변도보다 구조가 읽히는 프레임 쪽으로 이동합니다.",
        reason: "target_softSharp_high",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "facial_hair",
        parameter: "edgeDefinition",
        direction: "increase",
        strength: "light",
        expectedEffect: "수염을 사용한다면 외곽과 길이를 흐리지 않고 가볍게 정리해 구조감을 보탭니다.",
        reason: "target_softSharp_high",
        evidence: ["target_axis:softSharp"]
      })
    );
  } else if (softSharp !== null && softSharp <= 0.36) {
    actions.push(
      action({
        domain: "hair",
        parameter: "curvature",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "헤어 실루엣의 곡선 흐름을 늘려 전체 선을 부드럽게 연결합니다.",
        reason: "target_softSharp_low",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "brow_grooming",
        parameter: "angularity",
        direction: "decrease",
        strength: "light",
        expectedEffect: "눈썹 각을 완화해 얼굴 주변의 직선 압력을 줄입니다.",
        reason: "target_softSharp_low",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "makeup",
        parameter: "edgeDiffusion",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "아이·블러셔 경계를 더 부드럽게 확산해 목표 분위기에 맞춥니다.",
        reason: "target_softSharp_low",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "eyewear",
        parameter: "curvature",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "안경테를 선택한다면 각진 외곽보다 곡선이 섞인 프레임으로 선을 완화합니다.",
        reason: "target_softSharp_low",
        evidence: ["target_axis:softSharp"]
      }),
      action({
        domain: "facial_hair",
        parameter: "edgeDefinition",
        direction: "decrease",
        strength: "light",
        expectedEffect: "수염을 사용한다면 외곽을 과하게 날카롭게 자르지 않고 자연스럽게 연결합니다.",
        reason: "target_softSharp_low",
        evidence: ["target_axis:softSharp"]
      })
    );
  }

  const naturalPolished = getTargetAxis(vector, "naturalPolished");
  if (naturalPolished !== null && naturalPolished >= 0.64) {
    actions.push(
      action({
        domain: "hair",
        parameter: "finishControl",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "잔머리와 실루엣의 정돈감을 높여 설계된 인상을 강화합니다.",
        reason: "target_naturalPolished_high",
        evidence: ["target_axis:naturalPolished"]
      }),
      action({
        domain: "brow_grooming",
        parameter: "shapeControl",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "눈썹의 형태와 마감선을 정돈해 전체 완성도를 높입니다.",
        reason: "target_naturalPolished_high",
        evidence: ["target_axis:naturalPolished"]
      }),
      action({
        domain: "makeup",
        parameter: "boundaryControl",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "립·아이 등 주요 경계를 선택적으로 정돈해 polished 방향을 만듭니다.",
        reason: "target_naturalPolished_high",
        evidence: ["target_axis:naturalPolished"]
      }),
      action({
        domain: "eyewear",
        parameter: "rimDefinition",
        direction: "increase",
        strength: "light",
        expectedEffect: "안경을 쓴다면 프레임의 마감과 상단 라인이 흐리지 않은 쪽을 우선합니다.",
        reason: "target_naturalPolished_high",
        evidence: ["target_axis:naturalPolished"]
      }),
      action({
        domain: "facial_hair",
        parameter: "trimControl",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "수염을 유지한다면 길이 편차와 외곽을 정돈해 전체 마감을 맞춥니다.",
        reason: "target_naturalPolished_high",
        evidence: ["target_axis:naturalPolished"]
      })
    );
  } else if (naturalPolished !== null && naturalPolished <= 0.36) {
    actions.push(
      action({
        domain: "hair",
        parameter: "textureFreedom",
        direction: "increase",
        strength: "light",
        expectedEffect: "완벽하게 고정된 마감보다 자연스러운 텍스처를 남깁니다.",
        reason: "target_naturalPolished_low",
        evidence: ["target_axis:naturalPolished"]
      }),
      action({
        domain: "makeup",
        parameter: "coverageIntensity",
        direction: "decrease",
        strength: "light",
        expectedEffect: "표현 강도와 경계를 낮춰 힘을 뺀 느낌을 유지합니다.",
        reason: "target_naturalPolished_low",
        evidence: ["target_axis:naturalPolished"]
      })
    );
  }

  const playfulMature = getTargetAxis(vector, "playfulMature");
  if (playfulMature !== null && playfulMature >= 0.66) {
    actions.push(
      action({
        domain: "hair",
        parameter: "silhouetteControl",
        direction: "increase",
        strength: "light",
        expectedEffect: "헤어 실루엣의 불필요한 분산을 줄여 차분한 인상을 만듭니다.",
        reason: "target_playfulMature_high",
        evidence: ["target_axis:playfulMature"]
      }),
      action({
        domain: "accessories",
        parameter: "visualNoise",
        direction: "decrease",
        strength: "light",
        expectedEffect: "얼굴 주변 포인트 수를 줄여 더 절제된 인상을 만듭니다.",
        reason: "target_playfulMature_high",
        evidence: ["target_axis:playfulMature"]
      })
    );
  } else if (playfulMature !== null && playfulMature <= 0.34) {
    actions.push(
      action({
        domain: "hair",
        parameter: "movement",
        direction: "increase",
        strength: "light",
        expectedEffect: "레이어나 가벼운 움직임을 늘려 생기 있는 인상을 만듭니다.",
        reason: "target_playfulMature_low",
        evidence: ["target_axis:playfulMature"]
      }),
      action({
        domain: "color",
        parameter: "accentFreshness",
        direction: "increase",
        strength: "light",
        expectedEffect: "얼굴 주변에 가볍고 생기 있는 색 포인트를 허용합니다.",
        reason: "target_playfulMature_low",
        evidence: ["target_axis:playfulMature"]
      })
    );
  }

  const minimalStatement = getTargetAxis(vector, "minimalStatement");
  if (minimalStatement !== null && minimalStatement >= 0.66) {
    actions.push(
      action({
        domain: "makeup",
        parameter: "selectedFeatureContrast",
        direction: "increase",
        strength: minimalStatement >= 0.82 ? "strong" : "moderate",
        expectedEffect: "모든 부위를 강하게 만들기보다 선택한 한두 부위의 대비를 높입니다.",
        reason: "target_minimalStatement_high",
        evidence: ["target_axis:minimalStatement"]
      }),
      action({
        domain: "accessories",
        parameter: "visualWeight",
        direction: "increase",
        strength: "moderate",
        expectedEffect: "얼굴 주변 포인트의 존재감을 높여 statement 방향을 보탭니다.",
        reason: "target_minimalStatement_high",
        evidence: ["target_axis:minimalStatement"]
      }),
      action({
        domain: "eyewear",
        parameter: "visualWeight",
        direction: "increase",
        strength: "light",
        expectedEffect: "안경을 사용하는 경우 프레임 존재감을 한 단계 높여 포인트 역할을 부여합니다.",
        reason: "target_minimalStatement_high",
        evidence: ["target_axis:minimalStatement"]
      })
    );
  } else if (minimalStatement !== null && minimalStatement <= 0.34) {
    actions.push(
      action({
        domain: "makeup",
        parameter: "accentCount",
        direction: "decrease",
        strength: "moderate",
        expectedEffect: "강조 부위를 줄여 전체 시각 강도를 낮춥니다.",
        reason: "target_minimalStatement_low",
        evidence: ["target_axis:minimalStatement"]
      }),
      action({
        domain: "accessories",
        parameter: "visualWeight",
        direction: "decrease",
        strength: "moderate",
        expectedEffect: "얼굴 주변 액세서리의 무게를 낮춰 미니멀한 방향을 유지합니다.",
        reason: "target_minimalStatement_low",
        evidence: ["target_axis:minimalStatement"]
      }),
      action({
        domain: "eyewear",
        parameter: "visualWeight",
        direction: "decrease",
        strength: "light",
        expectedEffect: "안경을 사용하는 경우 프레임의 시각 무게를 낮춰 미니멀한 방향을 유지합니다.",
        reason: "target_minimalStatement_low",
        evidence: ["target_axis:minimalStatement"]
      })
    );
  }

  const warmCool = getTargetAxis(vector, "warmCool");
  if (warmCool !== null && Math.abs(warmCool - 0.5) >= 0.16) {
    actions.push(action({
      domain: "color",
      parameter: "temperatureDirection",
      direction: "shift",
      strength: Math.abs(warmCool - 0.5) >= 0.28 ? "strong" : "moderate",
      expectedEffect: warmCool > 0.5
        ? "사용자가 선호한 쿨한 색 무드 쪽으로 얼굴 주변 색을 이동합니다."
        : "사용자가 선호한 따뜻한 색 무드 쪽으로 얼굴 주변 색을 이동합니다.",
      reason: warmCool > 0.5 ? "target_warmCool_cool" : "target_warmCool_warm",
      evidence: ["target_axis:warmCool"]
    }));
  }

  const classicTrendy = getTargetAxis(vector, "classicTrendy");
  if (classicTrendy !== null && classicTrendy >= 0.68) {
    actions.push(action({
      domain: "face_adjacent_style",
      parameter: "trendSignal",
      direction: "increase",
      strength: "light",
      expectedEffect: "얼굴 주변 스타일에 현재 유행 요소를 선택적으로 반영합니다.",
      reason: "target_classicTrendy_high",
      evidence: ["target_axis:classicTrendy"]
    }));
  } else if (classicTrendy !== null && classicTrendy <= 0.32) {
    actions.push(action({
      domain: "face_adjacent_style",
      parameter: "trendSignal",
      direction: "decrease",
      strength: "light",
      expectedEffect: "유행 의존도를 낮추고 오래 유지되는 정돈된 요소를 우선합니다.",
      reason: "target_classicTrendy_low",
      evidence: ["target_axis:classicTrendy"]
    }));
  }

  return actions;
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

  const rawActions = buildTargetActions(targetStyle);
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
