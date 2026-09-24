import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFaceLabV2ResultPresentation } from "../lib/face-lab-v2/result-presentation.js";

const fixture = {
  status: "available",
  currentFaceProfile: {
    status: "available",
    summary: "현재 얼굴에서 스타일 판단에 사용할 수 있는 특징을 확인했습니다.",
    keyFeatures: [
      {
        key: "eyeDirection",
        label: "눈매 방향",
        explanation: "눈 바깥쪽 방향성이 또렷하게 읽힙니다."
      }
    ]
  },
  targetStyle: {
    status: "available",
    source: "known",
    targetLabels: ["sophisticated", "chic"]
  },
  styleDelta: {
    priorities: [
      {
        domain: "makeup",
        parameter: "eyeDefinition",
        strength: "light",
        constraintState: "allowed",
        expectedEffect: "이미 상향 흐름이 보이는 눈매를 더 끌어올리기보다 선명도와 길이를 조절합니다."
      }
    ],
    conflicts: [
      {
        type: "over_amplification_guard",
        description: "이미 상향 흐름이 보이는 눈매에 추가 상승 방향을 중첩하지 않습니다.",
        resolution: "상승 각도 대신 눈의 선명도와 길이 쪽으로 이동합니다."
      }
    ]
  },
  routes: {
    status: "available",
    selectedRouteId: "makeup_led",
    routes: [
      {
        routeId: "makeup_led",
        title: "메이크업 중심",
        whyThisRoute: "헤어 변화를 크게 주지 않고 메이크업 위치와 강도를 이용합니다.",
        summary: "눈매 선명도를 중심으로 조절합니다.",
        domains: ["makeup"],
        changeMagnitude: "medium",
        dailyEffort: "high",
        maintenance: "low",
        costBand: "standard",
        reversibility: "easy",
        targetFit: { status: "supported" },
        constraintFit: { score: 1, softTradeoffs: [] },
        actions: [
          {
            domain: "makeup",
            parameter: "eyeDefinition",
            direction: "increase",
            strength: "light",
            explanation: "눈매의 상승 각도보다 선명도와 길이를 조절합니다."
          }
        ]
      }
    ]
  },
  hair: { status: "not_requested", value: null },
  grooming: { status: "not_requested", value: null },
  makeup: {
    status: "available",
    value: {
      eyes: {
        direction: ["눈매의 상승 각도보다 선명도와 길이를 조절합니다."]
      }
    }
  },
  color: { status: "not_requested", value: null },
  eyewear: { status: "not_requested", value: null },
  accessories: { status: "not_requested", value: null },
  looks: {
    status: "available",
    visualConflicts: []
  },
  productHandoff: {
    status: "partial",
    matches: [],
    catalogVersion: null,
    specifications: [
      {
        specId: "eye-defined-buildable",
        category: "eyeliner",
        requiredAttributes: {
          opacity: "buildable",
          finish: ["matte", "satin"],
          chroma: null,
          diffusion: null,
          buildability: null
        },
        excludedAttributes: {
          constraints: ["avoid_overly_fixed_upward_angle"]
        }
      }
    ]
  },
  archetypeFun: {
    status: "available",
    funOnly: true,
    styleAuthority: false,
    mix: [
      { key: "cat", label: "고양이상", relativeShare: 0.65 },
      { key: "wolf", label: "늑대상", relativeShare: 0.35 }
    ]
  }
};

const before = JSON.stringify(fixture);
const ko = buildFaceLabV2ResultPresentation(fixture, { locale: "ko" });
assert.equal(JSON.stringify(fixture), before, "presentation adapter must not mutate canonical input");
assert.equal(ko.status, "available");
assert.equal(ko.execution.domains.length, 1);
assert.equal(ko.execution.domains[0].domain, "makeup");
assert.equal(ko.productGuides.length, 1);
assert.ok(ko.productGuides[0].recommended.some((item) => item.includes("농도")));
assert.ok(ko.productGuides[0].avoid.some((item) => item.includes("각도")));
assert.equal(ko.archetype.items[0].emphasis, "primary");
assert.equal(
  JSON.stringify(ko).includes("constraintScore"),
  false,
  "internal route score naming must not leak into presentation"
);
assert.equal(
  JSON.stringify(ko).includes("opacity:"),
  false,
  "raw product attribute rendering must not leak into presentation"
);

const en = buildFaceLabV2ResultPresentation(fixture, { locale: "en" });
assert.equal(
  /[가-힣]/.test(JSON.stringify(en)),
  false,
  "English presentation must not leak Korean engine copy"
);
assert.ok(en.execution.domains[0].actions[0].includes("definition"));
assert.ok(en.productGuides[0].recommended.some((item) => item.includes("Buildable")));

const root = resolve(process.cwd());
const premium = readFileSync(resolve(root, "components/full-report/PremiumFaceLabSection.jsx"), "utf8");
const resultUi = readFileSync(resolve(root, "components/full-report/face-lab/FaceLabV2Result.jsx"), "utf8");

assert.ok(
  premium.includes('from "@/components/full-report/face-lab/FaceLabV2Result"'),
  "premium Face Lab must delegate result rendering to the product result component"
);
assert.equal(
  premium.includes("Object.entries(spec.requiredAttributes"),
  false,
  "premium Face Lab must not render raw product spec entries"
);
assert.equal(
  resultUi.includes("requiredAttributes"),
  false,
  "result UI must consume presentation guides instead of raw product spec fields"
);
assert.ok(
  resultUi.includes("view.execution.domains.map"),
  "result UI must render only presentation-approved execution domains"
);

console.log(JSON.stringify({
  ok: true,
  version: ko.version,
  executionDomains: ko.execution.domains.map((item) => item.domain),
  productGuideCount: ko.productGuides.length,
  checks: [
    "canonical_immutability",
    "conditional_execution_domains",
    "human_product_guidance",
    "raw_spec_hidden",
    "english_locale_isolation",
    "result_component_boundary"
  ]
}, null, 2));
