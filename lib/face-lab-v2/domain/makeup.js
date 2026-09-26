export const MAKEUP_ENGINE_VERSION = "face-lab-makeup-engine-v3";
export const MAKEUP_PRODUCT_SPEC_VERSION = "face-lab-makeup-product-spec-v1";

function actionsForRoute(route) {
  return Array.isArray(route?.actions)
    ? route.actions.filter((item) => item?.domain === "makeup")
    : [];
}

function createTechnique() {
  return {
    placement: [],
    direction: [],
    intensity: null,
    finish: [],
    colorDirection: [],
    whyItWorks: "",
    productSpecificationRefs: []
  };
}

function createSpec(specId, category, values = {}) {
  return {
    specId,
    version: MAKEUP_PRODUCT_SPEC_VERSION,
    category,
    hueFamily: values.hueFamily || null,
    undertone: values.undertone || null,
    depth: values.depth || null,
    chroma: values.chroma || null,
    opacity: values.opacity || null,
    finish: values.finish || null,
    glossLevel: values.glossLevel || null,
    blurLevel: values.blurLevel || null,
    shimmerLevel: values.shimmerLevel || null,
    diffusion: values.diffusion || null,
    buildability: values.buildability || null,
    constraints: values.constraints || []
  };
}

export function buildMakeupExecution({ route, targetStyle } = {}) {
  const scope = new Set(Array.isArray(targetStyle?.stylingScope) ? targetStyle.stylingScope : []);
  const exclusions = new Set(
    Array.isArray(targetStyle?.constraints?.hardExclusions)
      ? targetStyle.constraints.hardExclusions
      : []
  );
  const makeupIntensity = targetStyle?.constraints?.makeup?.intensity || null;
  const makeupExplicitlyExcluded =
    ["grooming_only", "none"].includes(makeupIntensity) ||
    exclusions.has("makeup_disabled");

  if (
    makeupExplicitlyExcluded ||
    (!scope.has("makeup") && !scope.has("auto_scope"))
  ) {
    return {
      result: {
        status: "not_requested",
        version: MAKEUP_ENGINE_VERSION,
        routeId: route?.routeId || null,
        targetProfileVersion: targetStyle?.profileVersion || null,
        value: null,
        reason: null,
        confidence: null,
        evidence: [],
        productSpecificationRefs: [],
        unavailableReason: null
      },
      productSpecifications: []
    };
  }

  const actions = actionsForRoute(route);
  if (!actions.length) {
    return {
      result: {
        status: "not_applicable",
        version: MAKEUP_ENGINE_VERSION,
        routeId: route?.routeId || null,
        targetProfileVersion: targetStyle?.profileVersion || null,
        value: null,
        reason: "선택한 경로는 메이크업 변화를 사용하지 않습니다.",
        confidence: null,
        evidence: [],
        productSpecificationRefs: [],
        unavailableReason: null
      },
      productSpecifications: []
    };
  }

  const brows = createTechnique();
  const eyes = createTechnique();
  const blush = createTechnique();
  const lips = createTechnique();
  const complexion = createTechnique();
  const contourHighlight = createTechnique();
  const specs = [];

  actions.forEach((item) => {
    if (item.parameter === "outerEyeEmphasis") {
      eyes.placement.push("눈 바깥쪽 1/3 중심");
      eyes.direction.push("수평에서 약간 바깥쪽으로 확장");
      eyes.intensity = item.strength;
      eyes.whyItWorks = item.explanation;
      const specId = "eye-defined-buildable";
      eyes.productSpecificationRefs.push(specId);
      specs.push(createSpec(specId, "eyeliner", {
        opacity: "buildable",
        finish: ["matte", "satin"],
        constraints: ["avoid_overly_fixed_upward_angle"]
      }));
    }

    if (item.parameter === "eyeDefinition") {
      eyes.placement.push("속눈썹 라인과 바깥쪽 길이 중심");
      eyes.direction.push("추가 상승각보다 선명도와 길이를 조절");
      eyes.intensity = item.strength;
      eyes.whyItWorks = item.explanation;
      const specId = "eye-definition-controlled";
      eyes.productSpecificationRefs.push(specId);
      specs.push(createSpec(specId, "eyeliner", {
        opacity: "buildable",
        finish: ["matte"],
        constraints: ["angle_neutral_to_slight"]
      }));
    }

    if (item.parameter === "edgeDiffusion") {
      eyes.direction.push("아이 음영 경계를 부드럽게 확산");
      blush.direction.push("볼 경계를 넓고 부드럽게 블렌딩");
      eyes.intensity = item.strength;
      blush.intensity = item.strength;
      eyes.whyItWorks = item.explanation;
      blush.whyItWorks = item.explanation;
      const specId = "soft-diffusion-shadow";
      eyes.productSpecificationRefs.push(specId);
      specs.push(createSpec(specId, "eyeshadow", {
        chroma: "medium_low",
        finish: ["matte", "soft_satin"],
        diffusion: "high",
        buildability: "high"
      }));
    }

    if (item.parameter === "boundaryControl") {
      lips.direction.push("립 경계는 번짐 없이 정돈하되 지나치게 날카롭게 자르지 않음");
      lips.intensity = item.strength;
      lips.whyItWorks = item.explanation;
      const specId = "lip-controlled-boundary";
      lips.productSpecificationRefs.push(specId);
      specs.push(createSpec(specId, "lip", {
        chroma: "medium",
        opacity: "buildable",
        finish: ["satin", "soft_matte"],
        buildability: "high"
      }));
    }

    if (item.parameter === "coverageIntensity") {
      complexion.direction.push("두꺼운 커버보다 필요한 부위만 얇게 정돈");
      complexion.intensity = item.strength;
      complexion.whyItWorks = item.explanation;
      const specId = "base-light-coverage";
      complexion.productSpecificationRefs.push(specId);
      specs.push(createSpec(specId, "base", {
        opacity: "light_to_medium",
        finish: ["natural", "satin"],
        constraints: ["avoid_heavy_coverage"]
      }));
    }

    if (item.parameter === "selectedFeatureContrast") {
      eyes.direction.push("눈 또는 립 중 한 부위만 주 포인트로 선택");
      lips.direction.push("다른 포인트와 동시에 최고 강도로 올리지 않음");
      eyes.intensity = item.strength;
      lips.intensity = item.strength;
      eyes.whyItWorks = item.explanation;
      lips.whyItWorks = item.explanation;
    }

    if (item.parameter === "accentCount") {
      eyes.direction.push("아이·립·블러셔를 동시에 강하게 하지 않고 강조 부위를 줄임");
      lips.direction.push("주 포인트가 아니면 채도와 경계를 낮춤");
      blush.direction.push("주 포인트가 아니면 면적과 강도를 낮춤");
      eyes.intensity = item.strength;
      lips.intensity = item.strength;
      blush.intensity = item.strength;
      eyes.whyItWorks = item.explanation;
      lips.whyItWorks = item.explanation;
      blush.whyItWorks = item.explanation;
    }
  });

  const specIds = [...new Set(specs.map((item) => item.specId))];
  const uniqueSpecs = [...new Map(specs.map((item) => [item.specId, item])).values()];

  return {
    result: {
      status: "available",
      version: MAKEUP_ENGINE_VERSION,
      routeId: route.routeId,
      targetProfileVersion: targetStyle?.profileVersion || null,
      value: {
        intensity: targetStyle?.constraints?.makeup?.intensity || "light",
        brows: brows.placement.length || brows.direction.length ? brows : null,
        eyes: eyes.placement.length || eyes.direction.length ? eyes : null,
        blush: blush.placement.length || blush.direction.length ? blush : null,
        lips: lips.placement.length || lips.direction.length ? lips : null,
        complexion: complexion.placement.length || complexion.direction.length ? complexion : null,
        contourHighlight: contourHighlight.placement.length || contourHighlight.direction.length
          ? contourHighlight
          : null,
        avoidOrModerate: []
      },
      reason: actions[0].explanation,
      confidence: 0.68,
      evidence: actions.map((item) => `style_delta:${item.parameter}`),
      productSpecificationRefs: specIds,
      unavailableReason: null
    },
    productSpecifications: uniqueSpecs
  };
}
