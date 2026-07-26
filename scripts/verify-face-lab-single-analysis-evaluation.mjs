import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildHostedEvaluationProviderGroups,
  createSharedHostedEvaluationTransport,
  selectPendingHostedEvaluationProviderGroups
} from "../lib/face-lab-hosted-evaluation-groups.mjs";

function makeCase(fixtureId, locale, repetition = 1, extra = {}) {
  return {
    caseId: `${fixtureId}:${locale}:${repetition}`,
    fixtureId,
    subjectId: fixtureId.startsWith("control") ? fixtureId : "subject-a",
    comparisonGroup: fixtureId,
    variantRole: fixtureId.startsWith("control") ? "control" : "baseline",
    conditionTags: ["clear"],
    expectedEligibility: fixtureId.startsWith("control") ? "ineligible" : "eligible",
    expectedDegradation: fixtureId.startsWith("control") ? "eligibility_block" : "none",
    imagePath: `/fixtures/${fixtureId}.jpg`,
    imagePathPortable: `private/face-lab-fixtures/${fixtureId}.jpg`,
    declaredMime: "image/jpeg",
    locale,
    repetition,
    ...extra
  };
}

const cases = [
  makeCase("subject-a-clear", "ko"),
  makeCase("subject-a-clear", "en"),
  makeCase("subject-a-warm", "ko"),
  makeCase("subject-a-warm", "en"),
  makeCase("subject-a-occluded", "ko"),
  makeCase("subject-a-occluded", "en"),
  makeCase("control-product", "ko"),
  makeCase("control-product", "en")
];

const groups = buildHostedEvaluationProviderGroups(cases, { maxProviderCalls: 4 });
assert.equal(groups.length, 4);
assert.deepEqual(groups.map((group) => group.cases.length), [2, 2, 2, 2]);
assert.deepEqual(groups.map((group) => group.providerLocale), ["ko", "ko", "ko", "ko"]);
assert.deepEqual(groups[0].locales, ["ko", "en"]);

const onlyEnglish = buildHostedEvaluationProviderGroups([
  makeCase("subject-a-clear", "en")
], { maxProviderCalls: 1 });
assert.equal(onlyEnglish[0].providerLocale, "en");

assert.throws(
  () => buildHostedEvaluationProviderGroups(cases, { maxProviderCalls: 3 }),
  /planned provider call count 4 exceeds maxProviderCalls 3/
);
assert.throws(
  () => buildHostedEvaluationProviderGroups([
    makeCase("subject-a-clear", "ko"),
    makeCase("subject-a-clear", "ko", 1, { caseId: "subject-a-clear:ko:duplicate" })
  ]),
  /duplicate locale ko/
);
assert.throws(
  () => buildHostedEvaluationProviderGroups([
    makeCase("subject-a-clear", "ko"),
    makeCase("subject-a-clear", "en", 1, { imagePath: "/fixtures/other.jpg" })
  ]),
  /inconsistent imagePath/
);

const pendingGroups = selectPendingHostedEvaluationProviderGroups(groups, [
  cases[1],
  cases[4],
  cases[5]
]);
assert.equal(pendingGroups.length, 2);
assert.deepEqual(pendingGroups[0].pendingCases.map((item) => item.caseId), [cases[1].caseId]);
assert.deepEqual(pendingGroups[1].pendingCases.map((item) => item.caseId), [cases[4].caseId, cases[5].caseId]);

const shared = createSharedHostedEvaluationTransport({
  status: "success",
  httpStatus: 200,
  attemptCount: 2,
  retryCount: 1,
  retryExhausted: false,
  retryAfterMs: null,
  durationMs: 1234,
  reasonCode: null
});
assert.equal(shared.status, "success");
assert.equal(shared.httpStatus, 200);
assert.equal(shared.attemptCount, 0);
assert.equal(shared.retryCount, 0);
assert.equal(shared.durationMs, null);
assert.equal(shared.reasonCode, "shared_provider_result:success");

const runnerSource = readFileSync("scripts/run-face-lab-hosted-evaluation-single-analysis.mjs", "utf8");
const wrapperSource = readFileSync("scripts/run-face-lab-hosted-evaluation.mjs", "utf8");
assert.equal((runnerSource.match(/await executeFaceLabEvaluationRequest\(/g) || []).length, 1);
assert.match(runnerSource, /planned-provider-calls=/);
assert.match(runnerSource, /pending-provider-calls=/);
assert.match(runnerSource, /group\.providerLocale/);
assert.match(runnerSource, /createSharedHostedEvaluationTransport/);
assert.doesNotMatch(runnerSource, /formData\.append\("locale", item\.locale\)/);
assert.match(wrapperSource, /run-face-lab-hosted-evaluation-single-analysis\.mjs/);

const routeSource = readFileSync("app/api/face-reading/route.js", "utf8");
const visionContractSource = readFileSync("lib/vision-observation-contract.js", "utf8");
const faceProjectorSource = readFileSync("lib/face-lab-observation-projector.js", "utf8");
assert.match(routeSource, /analyzeVisionObservation/);
assert.match(routeSource, /projectFaceLabResult/);
assert.doesNotMatch(routeSource, /type:\s*["']image_url["']/);
assert.match(visionContractSource, /vision-observation-v1/);
assert.match(visionContractSource, /Do not use survey answers, locale, products/);
assert.match(visionContractSource, /Return enum tokens exactly as listed/);
assert.match(faceProjectorSource, /ko:\s*\{/);
assert.match(faceProjectorSource, /en:\s*\{/);
assert.match(faceProjectorSource, /presentation_hint:\s*["']neutral["']/);

console.log("Face Lab hosted evaluation single-analysis grouping checks passed.");
