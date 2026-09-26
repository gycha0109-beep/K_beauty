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
        domains: ["makeup"],
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
        targetFit: {
          status: "supported",
          coverage: 0.67,
          coveredDimensions: ["softSharp", "naturalPolished"],
          totalDimensions: ["softSharp", "naturalPolished", "minimalStatement"],
          explanation: "활성 목표 방향 3개 중 2개를 이 경로에서 함께 다룹니다."
        },
        constraintFit: { score: 1, softTradeoffs: ["daily_time_constraint_15"] },
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
        placement: ["실행 엔진 상세: 속눈썹 라인과 바깥쪽 길이 중심"],
        direction: ["실행 엔진 상세: 추가 상승각보다 선명도와 길이를 조절"],
        finish: [],
        colorDirection: []
      }
    }
  },
  color: { status: "not_requested", value: null },
  eyewear: { status: "not_requested", value: null },
  accessories: { status: "not_requested", value: null },
  looks: {
    status: "available",
    visualConflicts: [
      {
        conflictId: "style-delta-conflict-1",
        domains: ["makeup"],
        description: "이미 상향 흐름이 보이는 눈매에 추가 상승 방향을 중첩하지 않습니다.",
        impact: "over_amplification_guard",
        resolution: "상승 각도 대신 눈의 선명도와 길이 쪽으로 이동합니다."
      }
    ],
    looks: [
      {
        routeId: "makeup_led",
        title: "메이크업 중심",
        summary: "LOOK COMPOSER: 속눈썹 라인과 바깥쪽 길이 중심",
        whyItWorks: "LOOK COMPOSER: 선택한 메이크업 경로를 조합했습니다.",
        pieces: [
          {
            domain: "makeup",
            summary: "LOOK PIECE: 눈매의 선명도와 길이를 조절"
          }
        ]
      }
    ]
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
assert.equal(
  ko.routes.cards[0].targetFit,
  "활성 목표 방향 3개 중 2개를 이 경로에서 함께 다룹니다.",
  "route card must preserve the canonical localized target-coverage explanation"
);
assert.deepEqual(
  ko.routes.cards[0].tradeoffs,
  ["하루 15분 안에서는 이 경로가 손이 조금 더 갑니다."],
  "Korean route tradeoff copy must preserve the user's actual 15-minute constraint"
);
assert.equal(ko.execution.domains[0].domain, "makeup");
assert.ok(
  ko.execution.domains[0].actions.some((item) => item.includes("실행 엔진 상세")),
  "Korean execution UI must render the selected route's canonical domain execution, not just generic route actions"
);
assert.equal(
  ko.execution.domains[0].actions.includes("눈매의 상승 각도보다 선명도와 길이를 조절합니다."),
  false,
  "generic route copy must not replace more specific canonical execution details"
);
assert.equal(ko.look.summary, "LOOK COMPOSER: 속눈썹 라인과 바깥쪽 길이 중심");
assert.equal(ko.look.pieces[0].summary, "LOOK PIECE: 눈매의 선명도와 길이를 조절");
assert.equal(ko.conflicts.items.length, 1);
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

const enFixture = JSON.parse(JSON.stringify(fixture));
enFixture.routes.routes[0].targetFit.explanation = "This route covers 2 of 3 active target directions together.";
const en = buildFaceLabV2ResultPresentation(enFixture, { locale: "en" });
assert.equal(
  en.routes.cards[0].targetFit,
  "This route covers 2 of 3 active target directions together.",
  "English route card must preserve the canonical target-coverage explanation"
);
assert.deepEqual(
  en.routes.cards[0].tradeoffs,
  ["This route may take a little more effort within a 15-minute daily routine."],
  "English route tradeoff copy must preserve the user's actual 15-minute constraint"
);
assert.equal(
  /[가-힣]/.test(JSON.stringify(en)),
  false,
  "English presentation must not leak Korean engine copy"
);
assert.ok(en.execution.domains[0].actions[0].includes("definition"));
assert.ok(en.productGuides[0].recommended.some((item) => item.includes("Buildable")));

const unavailable = buildFaceLabV2ResultPresentation({
  status: "unavailable",
  currentFaceProfile: { status: "unavailable" }
}, { locale: "ko" });
assert.equal(unavailable.status, "unavailable");
assert.equal(unavailable.notice.kind, "unavailable");
assert.ok(unavailable.notice.title.includes("스타일 경로"));

const boundedFixture = JSON.parse(JSON.stringify(fixture));
boundedFixture.status = "partial";
boundedFixture.styleDelta.priorities = [];
boundedFixture.routes = {
  status: "insufficient_evidence",
  selectedRouteId: null,
  routes: []
};
boundedFixture.looks = { status: "insufficient_evidence", visualConflicts: [], looks: [] };
const bounded = buildFaceLabV2ResultPresentation(boundedFixture, { locale: "ko" });
assert.equal(bounded.status, "partial");
assert.equal(bounded.routes.cards.length, 0);
assert.equal(bounded.notice.kind, "bounded");

const limitedEvidenceFixture = JSON.parse(JSON.stringify(fixture));
limitedEvidenceFixture.status = "partial";
limitedEvidenceFixture.currentFaceProfile.status = "partial";
const limitedEvidence = buildFaceLabV2ResultPresentation(limitedEvidenceFixture, { locale: "ko" });
assert.equal(limitedEvidence.routes.cards.length, 1);
assert.equal(limitedEvidence.notice.kind, "limited_evidence");
assert.ok(limitedEvidence.notice.body.includes("근거가 부족한 특징은 추천에 사용하지 않았"));

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
assert.ok(
  resultUi.includes("route.targetFit"),
  "route cards must explain how broadly each route covers the active target"
);
assert.ok(
  resultUi.includes("view.look.why"),
  "composed look must expose the canonical rationale instead of showing only a summary"
);

assert.equal(
  resultUi.includes('if (view.status === "unavailable") return null'),
  false,
  "unavailable Face Lab V2 must render a bounded explanation instead of disappearing"
);
assert.ok(
  resultUi.includes("view.notice"),
  "partial results without an actionable route must explain the bounded state"
);
assert.ok(
  resultUi.includes("view.routes.cards.length"),
  "empty route collections must not render an unexplained blank route card"
);

console.log(JSON.stringify({
  ok: true,
  version: ko.version,
  executionDomains: ko.execution.domains.map((item) => item.domain),
  productGuideCount: ko.productGuides.length,
  checks: [
    "canonical_immutability",
    "conditional_execution_domains",
    "route_target_fit_explanation",
    "canonical_execution_details",
    "canonical_look_composer_output",
    "composed_look_rationale",
    "route_scoped_conflicts",
    "human_product_guidance",
    "raw_spec_hidden",
    "english_locale_isolation",
    "result_component_boundary",
    "bounded_unavailable_explanation",
    "empty_route_explanation",
    "partial_evidence_explanation"
  ]
}, null, 2));
