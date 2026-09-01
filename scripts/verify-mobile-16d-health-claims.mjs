import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(repoRoot, path), "utf8");

const contract = JSON.parse(read("apps/mobile/health-claims-readiness.json"));
const healthClaimsSource = read("apps/mobile/lib/health-claims.ts");
const analyzeClientSource = read("apps/mobile/features/analyze/analyze-client.ts");
const analyzeScreenSource = read("apps/mobile/app/analyze.tsx");
const visionPromptSource = read("lib/vision-observation-contract.js");
const explanationRouteSource = read("app/api/analyze/route.js");

const disclaimerEn =
  "BEJEWELY is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Results are cosmetic skin-care guidance only.";
const disclaimerKo =
  "BEJEWELY는 의료기기가 아니며 어떠한 질환도 진단·치료·치유·예방하지 않습니다. 결과는 화장품·스킨케어 참고용 안내입니다.";

assert.equal(contract.schemaVersion, "mobile-health-claims-readiness-v1");
assert.equal(contract.slice, "MOBILE-16D");
assert.equal(contract.productIntent.medicalDecisionUse, false);
assert.equal(contract.productIntent.diagnosisUse, false);
assert.equal(contract.productIntent.treatmentUse, false);
assert.equal(contract.productIntent.regulatoryMedicalDeviceStatus, "external_not_verified");
assert.equal(contract.googlePlay.healthAppsDeclarationRequired, true);
assert.equal(contract.googlePlay.healthFeatureCategory, "Diseases and Conditions Management");
assert.equal(contract.googlePlay.healthAppsDeclarationStatus, "external_pending");
assert.equal(contract.apple.healthMeasurementAccuracyClaim, false);
assert.equal(contract.apple.medicalDiagnosisOrTreatmentClaim, false);
assert.equal(contract.claimBoundary.mobileRenderGuard, "strong_medical_claims_fail_closed_without_rewriting_server_result");
assert.equal(contract.claimBoundary.productExplanationPrompt, "server_prompt_explicit_guard_pending");
assert.equal(contract.claimBoundary.inAppDisclaimer.en, disclaimerEn);
assert.equal(contract.claimBoundary.inAppDisclaimer.ko, disclaimerKo);
assert.equal(contract.externalAuthority.googlePlayHealthAppsDeclaration, "external_pending");
assert.equal(contract.externalAuthority.legalRegulatoryClassification, "external_pending");

assert.ok(healthClaimsSource.includes(disclaimerEn), "English in-app non-medical disclaimer drifted");
assert.ok(healthClaimsSource.includes(disclaimerKo), "Korean in-app non-medical disclaimer drifted");
for (const marker of [
  "medical\\s+device",
  "diagnos",
  "treat",
  "cure",
  "prevent",
  "의료기기",
  "진단",
  "치료"
]) {
  assert.ok(healthClaimsSource.includes(marker), `Missing fail-closed medical claim marker: ${marker}`);
}

assert.ok(
  analyzeClientSource.includes("hasForbiddenMobileAnalyzeMedicalClaim"),
  "Analyze client must enforce the mobile medical-claim boundary"
);
assert.ok(
  analyzeClientSource.includes("mobile_analyze_medical_claim_guard"),
  "Analyze client must expose a deterministic fail-closed error code"
);
assert.ok(
  analyzeScreenSource.includes("MOBILE_HEALTH_DISCLAIMER[locale]"),
  "Analyze screen must render the locale-specific non-medical disclaimer"
);
assert.ok(
  analyzeScreenSource.includes('testID="native-analyze-health-disclaimer"'),
  "Analyze screen disclaimer needs a stable runtime verification target"
);

assert.ok(
  visionPromptSource.includes("This is not medical diagnosis"),
  "Vision observation prompt must remain explicitly non-diagnostic"
);
assert.ok(
  visionPromptSource.includes("Do not infer hydration, barrier state, acne disease"),
  "Vision prompt must continue forbidding disease inference from visible cues"
);

assert.ok(
  explanationRouteSource.includes("You are writing explanation text only for products already selected"),
  "Product explanation prompt source moved; reassess the MOBILE-16D server prompt boundary"
);
assert.ok(
  !explanationRouteSource.includes("MOBILE-16D NON-MEDICAL CLAIM GUARD IMPLEMENTED"),
  "Update the readiness contract if an explicit server-side explanation guard is later implemented"
);

console.log("MOBILE_16D_PRODUCT_INTENT_NON_MEDICAL=PASS");
console.log("MOBILE_16D_VISION_NON_DIAGNOSTIC=PASS");
console.log("MOBILE_16D_MOBILE_RENDER_FAIL_CLOSED=PASS");
console.log("MOBILE_16D_IN_APP_DISCLAIMER=PASS");
console.log("MOBILE_16D_EXTERNAL_HEALTH_DECLARATIONS=PENDING");
