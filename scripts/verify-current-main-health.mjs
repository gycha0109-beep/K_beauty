#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;

function run(label, command, args, env = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

run("Current verifier syntax", node, ["--check", "scripts/verify-current-main-health.mjs"]);
run("Current Recommendation verifier syntax", node, ["--check", "scripts/verify-current-recommendation-health.mjs"]);
run("Repository hygiene verifier syntax", node, ["--check", "scripts/verify-current-repository-hygiene.mjs"]);
run("Document locale contract", node, ["--experimental-default-type=module", "scripts/verify-document-locale-contract.mjs"]);
run("Shared survey input contract", node, ["--experimental-default-type=module", "scripts/verify-shared-survey-contract.mjs"]);
run("Free survey decision intake", node, ["--experimental-default-type=module", "scripts/verify-free-survey-decision-intake.mjs"]);
run("Premium intake v1", node, ["--experimental-default-type=module", "scripts/verify-premium-intake-v1.mjs"]);
run("My monthly diary data contract", node, ["--experimental-default-type=module", "scripts/verify-my-monthly-diary.mjs"]);
run("My diary day detail contract", node, ["--experimental-default-type=module", "scripts/verify-my-diary-day-detail.mjs"]);
run("My saved report history contract", node, ["--experimental-default-type=module", "scripts/verify-my-saved-report-history.mjs"]);
run("My skin profile baseline contract", node, ["--experimental-default-type=module", "scripts/verify-my-skin-profile-baseline.mjs"]);
run("My account/session UX contract", node, ["--experimental-default-type=module", "scripts/verify-my-account-session-ux.mjs"]);
run("My adversarial E2E harness contract", node, ["--experimental-default-type=module", "scripts/verify-my-adversarial-e2e-contract.mjs"]);
run("TRUST Phase 1 intake contract", node, ["scripts/verify-trust-intake-foundation.mjs"]);
run("TRUST Phase 2 subject resolution contract", node, ["scripts/verify-trust-subject-resolution.mjs"]);
run("TRUST Phase 2 presentation hardening", node, ["scripts/verify-trust-subject-resolution-presentation-hardening.mjs"]);
run("TRUST Phase 3 research worker contract", node, ["scripts/verify-trust-research-worker.mjs"]);
run("TRUST Phase 4 controlled evidence adoption", node, ["scripts/verify-trust-phase4-controlled-evidence-adoption.mjs"]);
run("Product Fact controlled-write authority", node, ["scripts/verify-product-fact-controlled-write-v1.mjs"]);
run("Product Fact Subject authority", node, ["scripts/verify-product-fact-subject-registration-v1.mjs"]);
run("TRUST Phase 5 admin queue contract", node, ["scripts/verify-trust-phase5-admin-queue.mjs"]);
run("TRUST Phase 5B subject registration contract", node, ["scripts/verify-trust-phase5b-subject-registration.mjs"]);
run("TRUST Phase 5C formulation conflict HOLD", node, ["scripts/product-evidence/verify-trust-phase5c-fation-formulation-conflict-v1.mjs"]);
run("TRUST Phase 6A reentry contract", node, ["scripts/verify-trust-phase6a-reentry.mjs"]);
run("TRUST Phase 6B reentry detector contract", node, ["scripts/verify-trust-phase6b-reentry-detectors.mjs"]);
run("TRUST Phase 7A legacy backfill preflight", node, ["scripts/verify-trust-phase7a-legacy-backfill-preflight.mjs"]);
run("TRUST Phase 7B legacy backfill materialization", node, ["scripts/verify-trust-phase7b-legacy-backfill-materialization.mjs"]);
run("TRUST Phase 7C legacy research readiness", node, ["scripts/verify-trust-phase7c-legacy-research-readiness.mjs"]);
run("TRUST Phase 7C Phase4 legacy adoption compatibility", node, ["scripts/verify-trust-phase7c-phase4-legacy-compat.mjs"]);
run("TRUST Phase 7D relational fact adoption", node, ["scripts/verify-trust-phase7d-relational-adoption.mjs"]);
run("TRUST Phase 8A revalidation contract", node, ["scripts/verify-trust-phase8a-revalidation-contract.mjs"]);

run("Architecture guard", npm, ["run", "architecture:guard"]);
run("Shared skin decision context", npm, ["run", "verify:shared-skin-decision-context"]);
run("Premium integrated deterministic evaluation", npm, ["run", "verify:premium-integrated-evaluation-v2"]);
run("Unified Vision pipeline", npm, ["run", "verify:unified-vision-pipeline"]);
run("Skin decision persistence and reentry", npm, ["run", "verify:skin-decision-persistence-reentry"]);
run("Canonical 164x12 current Recommendation semantic health", node, ["scripts/verify-current-recommendation-health.mjs"]);

run("CandidatePolicy current semantic invariant", npm, ["run", "verify:candidate-exposure-policy-shadow"]);
run("Product Evidence presentation contract", node, ["scripts/verify-product-evidence-presentation-contract.mjs"]);
run("Product Evidence presentation provider", node, ["scripts/verify-product-evidence-presentation-provider.mjs"]);
run("Product Evidence Free Result V2 UI", node, ["scripts/verify-free-result-v2-product-evidence-ui.mjs"]);
run("Product Evidence review observation readiness", node, ["scripts/verify-product-evidence-review-observation-readiness.mjs"]);
run("Current Product Decision Axis contract", node, ["scripts/product-evidence/verify-exfoliation-non-numeric-pda-contract-v1.mjs"]);
run("Current Production SHADOW wiring", node, ["--experimental-default-type=module", "scripts/product-evidence/verify-exfoliation-normative-policy-production-shadow-wiring-v1.mjs"]);
run(
  "Current Production activation/runtime safety",
  node,
  ["scripts/product-evidence/verify-exfoliation-normative-policy-activation-authorization-runtime-safety-v1.mjs"],
  { V21_9D_REQUIRE_CHECKED_IN: "1" },
);
run("G2 initial admission grant contract", node, ["scripts/product-evidence/verify-initial-admission-grant-policy-v1.mjs"]);
run("G3A Product Fact authority read contract", node, ["scripts/verify-v21-admission-g3a-pf-authority-reader-v1.mjs"]);
run("G3 production candidate admission contract", node, ["scripts/verify-v21-admission-g3-production-candidate-gate-v1.mjs"]);
run("DATA-TAXONOMY1 shadow catalog taxonomy foundation", node, ["scripts/verify-data-taxonomy1-shadow-catalog-taxonomy-foundation-v1.mjs"]);
run("DATA-TAXONOMY2 candidate manual classification", node, ["scripts/verify-data-taxonomy2-candidate-manual-classification-v1.mjs"]);
run("DATA-TAXONOMY4 recommendation shadow parity", node, ["--experimental-strip-types", "scripts/product-evidence/verify-data-taxonomy4-recommendation-shadow-parity-v1.mjs"]);
run("DATA-TAXONOMY5 production recommendation parity foundation", node, ["scripts/product-evidence/verify-data-taxonomy5-production-recommendation-parity-foundation-v1.mjs"]);
run("DATA-TAXONOMY5 production recommendation parity runtime", node, ["scripts/product-evidence/verify-data-taxonomy5-production-recommendation-parity-runtime-v1.mjs"]);
run("DATA-TAXONOMY15 recommendation parity catalog-only v2", node, ["scripts/product-evidence/verify-data-taxonomy15-recommendation-parity-catalog-only-v2.mjs"]);
run("DATA-TAXONOMY6 product identity decoupling preflight", node, ["scripts/product-evidence/verify-data-taxonomy6-product-identity-decoupling-preflight-v1.mjs"]);
run("DATA-TAXONOMY7 legacy projection compatibility", node, ["scripts/product-evidence/verify-data-taxonomy7-legacy-projection-compatibility-v1.mjs"]);
run("DATA-TAXONOMY8 nullable legacy category projection", node, ["scripts/product-evidence/verify-data-taxonomy8-nullable-legacy-category-projection-v1.mjs"]);
run("DATA-TAXONOMY10 catalog-only product promotion eligibility", node, ["scripts/product-evidence/verify-data-taxonomy10-catalog-only-product-promotion-eligibility-v1.mjs"]);
run("DATA-TAXONOMY11 catalog-only transactional adoption", node, ["scripts/product-evidence/verify-data-taxonomy11-catalog-only-transactional-adoption-v1.mjs"]);
run("Catalog taxonomy shadow reader syntax", node, ["--check", "lib/catalog-taxonomy-recommendation-shadow-reader.js"]);
run("Catalog taxonomy shadow replay syntax", node, ["--check", "lib/catalog-taxonomy-recommendation-shadow-replay.js"]);
run("Catalog taxonomy shadow cardinality syntax", node, ["--check", "lib/catalog-taxonomy-recommendation-shadow-cardinality-v2.mjs"]);
run("Catalog taxonomy replay route syntax", node, ["--check", "app/api/internal/catalog-taxonomy-recommendation-shadow-replay/route.js"]);

run("DATA-AI3 product-query shadow contract", node, ["scripts/verify-data-ai3-product-query-shadow.mjs"]);
run("DATA-AI4 provider-backed shadow contract", node, ["scripts/verify-data-ai4-provider-shadow.mjs"]);
run("DATA-AI5 activation-readiness shadow contract", node, ["scripts/verify-data-ai5-activation-readiness.mjs"]);
run("DATA-AI6 controlled product-query preview contract", node, ["scripts/verify-data-ai6-product-query-preview.mjs"]);
run("DATA-AI7 test/stage repeatability canary contract", node, ["scripts/verify-data-ai7-stage-canary.mjs"]);
run("DATA-AI7 test/stage repeatability canary runtime", node, ["scripts/verify-data-ai7-stage-canary-runtime.mjs"]);
run("DATA-AI7 Production fail-closed deployed probe contract", node, ["scripts/verify-data-ai7-production-fail-closed.mjs"]);
run("DATA-AI8 release-readiness evidence boundary", node, ["scripts/verify-data-ai8-release-readiness.mjs"]);
run("DATA-AI9 hosted authenticated Preview acceptance harness", node, ["scripts/verify-data-ai9-hosted-preview-acceptance.mjs"]);
run("DATA-AI10 hosted Preview evidence closure", node, ["scripts/verify-data-ai10-hosted-preview-evidence.mjs"]);
run("DATA-AI11 Production activation safety contract", node, ["scripts/verify-data-ai11-production-activation-safety.mjs"]);
run("DATA-AI12 Production canary operational preflight", node, ["scripts/verify-data-ai12-production-canary-preflight.mjs"]);
run("DATA-AI13 controlled Production canary runtime", node, ["scripts/verify-data-ai13-production-canary-runtime.mjs"]);
run("DATA-AI14 Production canary execution harness", node, ["scripts/verify-data-ai14-production-canary-harness.mjs"]);
run("DATA-AI15 six-hour Production canary activation", node, ["scripts/verify-data-ai15-production-canary-activation.mjs"]);
run("DATA-AI16 Production canary closure", node, ["scripts/verify-data-ai16-production-canary-closure.mjs"]);
run("DATA-AI17 authenticated limited-beta design", node, ["scripts/verify-data-ai17-authenticated-limited-beta-design.mjs"]);
run("DATA-AI18 authenticated beta runtime default-off", node, ["scripts/verify-data-ai18-authenticated-beta-runtime.mjs"]);
run("DATA-AI19 authenticated beta activation preflight", node, ["scripts/verify-data-ai19-authenticated-beta-activation-preflight.mjs"]);
run("DATA-AI20 authenticated limited-beta controlled activation", node, ["scripts/verify-data-ai20-authenticated-beta-controlled-activation.mjs"]);
run("DATA-AI21 three-account limited-beta evidence closure", node, ["scripts/verify-data-ai21-limited-beta-evidence-closure.mjs"]);
run("DATA-AI22 product-query quality evaluation", node, ["scripts/verify-data-ai22-product-query-quality.mjs"]);
run("DATA-AI22 product-query quality canonical baseline", node, ["scripts/run-data-ai22-product-query-quality-evaluation.mjs", "--expected-baseline"]);
run("DATA-AI22 live provider acceptance boundary", node, ["scripts/verify-data-ai22-live-provider-acceptance.mjs"]);

run("Legacy offer classifier", npm, ["--prefix", "crawler", "run", "verify:legacy-offer-classifier"]);
run("Legacy offer migration manifest and dry-run", npm, ["--prefix", "crawler", "run", "verify:legacy-offer-migration"]);
run("Product identity resolver", npm, ["--prefix", "crawler", "run", "verify:identity-resolution"]);
run("Product identity adoption plan", npm, ["--prefix", "crawler", "run", "verify:identity-adoption-plan"]);
run("Product identity key repair plan", npm, ["--prefix", "crawler", "run", "verify:identity-key-repair-plan"]);
run("Crawler TypeScript boundary", npm, ["--prefix", "crawler", "run", "typecheck"]);
run("Hwahae review capture provenance", node, ["scripts/verify-hwahae-review-capture-provenance.mjs"]);
run("Crawler canonical adoption authority / no-auto-adoption", node, ["scripts/verify-crawler-canonical-adoption-authority-remediation-v1.mjs"]);

run("Admin current-main integration static contract", node, ["scripts/verify-admin-product-current-main-integration.mjs"]);

run("Mobile auth static contract", node, ["scripts/verify-mobile-auth-foundation.mjs"]);
run("Mobile initial-entry routing static contract", node, ["scripts/verify-mobile-initial-entry-routing.mjs"]);
run("Mobile camera static contract", node, ["scripts/verify-mobile-camera-foundation.mjs"]);
run("Mobile face-guidance static contract", node, ["scripts/verify-mobile-face-guidance.mjs"]);
run("Mobile analyze static contract", node, ["scripts/verify-mobile-analyze-integration.mjs"]);
run("Mobile saved-report static contract", node, ["scripts/verify-mobile-saved-report-reentry.mjs"]);
run("Mobile public-share static contract", node, ["scripts/verify-mobile-public-share.mjs"]);
run("Mobile public-result deep-link static contract", node, ["scripts/verify-mobile-public-result-deep-link.mjs"]);
run("Mobile premium-entry static contract", node, ["scripts/verify-mobile-premium-entry.mjs"]);
run("Mobile My Skin Diary static contract", node, ["scripts/verify-mobile-my-skin-diary.mjs"]);
run("Offer presentation read path", node, ["scripts/verify-product-offer-read-path-v1.mjs"]);
run("Skin match decision wrapper syntax", node, ["--check", "lib/skin-match-decision-engine.js"]);
run("Seller listing observation contract", node, ["scripts/verify-seller-listing-observation-v1.mjs"]);
run("Seller listing observation contract syntax", node, ["--check", "lib/seller-listing-observation-v1.js"]);
run("Seller listing observation persistence contract", node, ["scripts/verify-seller-listing-observation-persistence-v1.mjs"]);
run("Seller listing capture adapter authority", node, ["scripts/verify-seller-listing-capture-adapter-v1.mjs"]);
run("Seller listing capture evidence authority", node, ["scripts/verify-seller-listing-capture-evidence-v1.mjs"]);
run("Seller listing evidence-first capture wiring", node, ["scripts/verify-seller-listing-capture-with-evidence-v1.mjs"]);
run("Seller listing parser fixture admission", node, ["scripts/verify-seller-listing-parser-fixture-v1.mjs"]);
run("Olive Young bounded public capture policy", node, ["scripts/verify-oliveyoung-public-listing-capture-v1.mjs"]);
run("Olive Young capture attempt artifact verifier syntax", node, ["--check", "scripts/verify-oliveyoung-public-capture-attempt-artifact-v1.mjs"]);
run("Torriden bounded public capture policy", node, ["scripts/verify-torriden-public-listing-capture-v1.mjs"]);
run("Torriden capture attempt artifact verifier syntax", node, ["--check", "scripts/verify-torriden-public-capture-attempt-artifact-v1.mjs"]);
run("Torriden captured-source parser", node, ["scripts/verify-torriden-public-listing-parser-v1.mjs"]);
run("Torriden live parser verifier syntax", node, ["--check", "scripts/verify-torriden-public-listing-parser-live-v1.mjs"]);
run("Torriden Product binding unresolved authority", node, ["scripts/verify-data-offer12-torriden-binding-decision-v1.mjs"]);
run("Torriden distinct Product identity convergence candidate", node, ["scripts/verify-data-offer13-torriden-identity-convergence-v1.mjs"]);
run("Manual catalog identity-review queue ingress", node, ["scripts/verify-data-offer14-manual-catalog-review-intake-v1.mjs"]);
run("DATA-OFFER15 catalog source/offer closure", node, ["scripts/verify-data-offer15-catalog-source-offer-closure-v1.mjs"]);
run("DATA-OFFER16 governed Offer presentation authority", node, ["scripts/verify-data-offer16-offer-presentation-authority-v1.mjs"]);
run("DATA-OFFER17 Offer runtime observability", node, ["scripts/verify-data-offer17-offer-runtime-observability-v1.mjs"]);
run("DATA-OFFER17 observability verifier syntax", node, ["--check", "scripts/verify-data-offer17-offer-runtime-observability-v1.mjs"]);
run("DATA-OFFER17 observability module syntax", node, ["--check", "lib/product-offer-runtime-observability.js"]);
run("DATA-OFFER17 offer read service syntax", node, ["--check", "lib/server/product-offer-read-service.js"]);
run("DATA-OFFER17 controlled Offer RPC diagnostic", node, ["scripts/verify-data-offer17-controlled-offer-rpc-diagnostic-v1.mjs"]);

run("Face Lab archetype scoring contract", npm, ["run", "verify:face-lab-archetype-scoring"]);
run("Face Lab target-axis contract", npm, ["run", "verify:face-lab-target-axis-definitions"]);
run("Face Lab independent Human cue protocol", npm, ["run", "verify:face-lab-independent-human-cue-protocol"]);
run("Face Lab Human evaluation contract", npm, ["run", "verify:face-lab-archetype-human-evaluation"]);
run("Face Lab Korean offline review UI", npm, ["run", "verify:face-lab-independent-human-cue-review-ui-ko"]);
run("Face Lab home transfer builder syntax", node, ["--check", "scripts/build-face-lab-home-transfer-v1.mjs"]);
run("Face Lab home transfer verifier syntax", node, ["--check", "scripts/check-face-lab-home-transfer-v1.mjs"]);
run("Face Lab hosted set authority", npm, ["run", "verify:face-lab-independent-human-cue-hosted-set"]);
run("Face Lab hosted response contract", npm, ["run", "verify:face-lab-independent-human-cue-hosted-response"]);
run("Face Lab hosted UI security boundary", npm, ["run", "verify:face-lab-independent-human-cue-hosted-ui"]);
run("Face Lab neutral face-count shared stage", node, ["scripts/check-face-lab-neutral-face-count-stage-v1.mjs"]);
run("Face Lab neutral face-count contract syntax", node, ["--check", "lib/face-lab-neutral-face-count-contract.mjs"]);
run("Face Lab neutral face-count intake syntax", node, ["--check", "lib/face-lab-neutral-face-count-intake.js"]);
run("Face Lab neutral face-count review HTML syntax", node, ["--check", "lib/face-lab-neutral-face-count-review-html.js"]);
run("Face Lab neutral review submit route syntax", node, ["--check", "app/api/facelab/review/neutral/submit/route.js"]);
run("Face Lab review submit route syntax", node, ["--check", "app/api/facelab/review/submit/route.js"]);
run("Face Lab review route syntax", node, ["--check", "app/facelab/review/route.js"]);
run("Face Lab synthetic evaluation workspace", npm, ["run", "synthetic:verify"]);
run("Face Lab neutral review operator safety", node, ["scripts/check-face-lab-neutral-review-operator-v1.mjs"]);
run("Face Lab neutral review operator syntax", node, ["--check", "scripts/face-lab-neutral-review-operator.mjs"]);
run("Face Lab neutral review operator Vercel compatibility launcher syntax", node, ["--check", "scripts/face-lab-neutral-review-operator-vercel-cli-compat.mjs"]);
run("Face Lab neutral review operator Vercel compatibility verifier syntax", node, ["--check", "scripts/check-face-lab-neutral-review-operator-vercel-cli-compat-v1.mjs"]);
run("Face Lab neutral review operator Vercel CLI compatibility", node, ["scripts/check-face-lab-neutral-review-operator-vercel-cli-compat-v1.mjs"]);

run(
  "Persona EVAL-R1 current grounding regression probes",
  node,
  ["scripts/verify-eval-r1-grounding-probes-v1.mjs"],
  {
    EVAL_R1_P3_REFERENCE_ROOT: ".",
    EVAL_R1_RECOMMENDATION_REFERENCE_ROOT: ".",
  },
);

run("Analysis RLS boundary", node, ["scripts/verify-analysis-rls-contract.mjs"]);
run("Anonymous write-grant boundary", node, ["scripts/verify-anonymous-write-grant-v2.mjs"]);
run("Image upload boundary", node, ["scripts/verify-sec08-image-upload-boundary.mjs"]);
run("Public result read boundary", node, ["scripts/verify-sec09-public-result-read-boundary.mjs"]);
run("Security headers and purchase-anchor boundary", node, ["scripts/verify-sec10-security-headers.mjs"]);
run("Admin/security boundary", npm, ["run", "verify:admin-access-foundation"]);
run("SEC-11 origin normalization", npm, ["run", "check:sec11-origin-normalization"]);
run("CI trigger topology", node, ["scripts/verify-ci-trigger-topology.mjs"]);
run("CI workflow responsibility map", node, ["scripts/verify-ci-workflow-responsibility-map.mjs"]);
run("Repository hygiene, secret and authority shortcut scan", npm, ["run", "verify:current-repository-hygiene"]);
run("Production build", npm, ["run", "build"]);

console.log("\nBEJEWELY Current Main Health: PASS");
