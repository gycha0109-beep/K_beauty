import assert from "node:assert/strict";
import {
  HOSTED_FAILURE_CATEGORIES,
  REQUIRED_HOSTED_LANES,
  compareLocaleSemantics,
  evaluateHostedVerdict,
  parseHostedPrNumber,
  projectCanonicalEvidence,
  sanitizeEvidence,
  validateDeploymentAttestation,
  validateUiCaseFixture
} from "./premium-hosted-preview-core-v2.mjs";
import {
  HOSTED_ATTESTATION_VERSION,
  HOSTED_UI_FIXTURE_VERSION,
  deriveEvidenceStateV1,
  resolveTopPickIdentity
} from "./premium-hosted-preview-contract-core.mjs";
import { validateCredentialRoot, validateLoginEvidence } from "./premium-hosted-preview-security.mjs";
import {
  assertVercelPreviewIdentity,
  deriveVercelAttestationTarget
} from "./premium-hosted-preview-vercel-target.mjs";

function reportFixture(locale = "ko", overrides = {}) {
  return {
    decisionBundle: {
      version: "premium-decision-bundle-v5",
      locale,
      effectivePolicySource: "raw",
      functionalPolicy: { status: "now", reasonCodes: ["priority:dehydration"] },
      routinePolicy: {
        status: "available",
        reasonCodes: [],
        confidence: "high",
        productActions: [{ slotKey: "pm.treatment", productId: "p1", sourceState: "selected", action: "keep", reasonCodes: ["no_clear_routine_conflict"] }]
      },
      conditionPolicy: { status: "available", reasonCodes: [], confidence: "high" },
      consistency: { verdict: "consistent", reasonCodes: [], confidence: "high" }
    },
    freeResult: { topPick: { id: "p1", productId: "p1" } },
    meta: { snapshot: { fingerprint: "a".repeat(64) } },
    ...overrides
  };
}

const ko = projectCanonicalEvidence(reportFixture("ko"), { catalogHash: "b".repeat(64) });
const en = projectCanonicalEvidence(reportFixture("en"), { catalogHash: "b".repeat(64) });
assert.equal(ko.immutableFingerprint, en.immutableFingerprint);
assert.equal(ko.semanticFingerprint, en.semanticFingerprint);
assert.equal(compareLocaleSemantics(ko, en).passed, true);
assert.equal(ko.evidenceState, "complete");

const changedReason = structuredClone(reportFixture("en"));
changedReason.decisionBundle.conditionPolicy.reasonCodes = ["different"];
assert.equal(compareLocaleSemantics(ko, projectCanonicalEvidence(changedReason, { catalogHash: "b".repeat(64) })).passed, false);

const partial = structuredClone(reportFixture());
partial.decisionBundle.routinePolicy.productActions[0].sourceState = "not_in_db";
partial.decisionBundle.routinePolicy.productActions[0].action = "check_needed";
assert.equal(projectCanonicalEvidence(partial).evidenceState, "partial");
assert.equal(deriveEvidenceStateV1(projectCanonicalEvidence(partial)), "partial");

const insufficient = structuredClone(reportFixture());
insufficient.decisionBundle.consistency.verdict = "insufficient_context";
assert.equal(projectCanonicalEvidence(insufficient).evidenceState, "insufficient_context");

assert.deepEqual(resolveTopPickIdentity({ topPick: null }), { topPickPresence: "absent", topPickProductId: null });
assert.deepEqual(resolveTopPickIdentity({ topPick: { id: "p1", productId: "p1" } }), { topPickPresence: "present", topPickProductId: "p1" });
assert.throws(() => resolveTopPickIdentity({ topPick: { id: "p1", productId: "p2" } }), /canonical_top_pick_id_conflict/);
assert.throws(() => resolveTopPickIdentity({}), /canonical_top_pick_field_missing/);
assert.throws(() => projectCanonicalEvidence({}), (error) => error.category === "CANONICAL_PROJECTION_FAILURE");
const duplicateReason = structuredClone(reportFixture());
duplicateReason.decisionBundle.functionalPolicy.reasonCodes = ["x", "x"];
assert.throws(() => projectCanonicalEvidence(duplicateReason), (error) => error.category === "CANONICAL_PROJECTION_FAILURE");

const validFixture = {
  schemaVersion: HOSTED_UI_FIXTURE_VERSION,
  startPath: "/",
  actions: [
    { type: "uploadByRole", role: "button", name: "사진에서 선택", path: "images/normal-synthetic.png" },
    { type: "clickByRole", role: "button", name: "분석 시작" },
    { type: "expectHeading", name: "현재 쓰는 제품을 알려주세요" }
  ],
  resultMarker: { kind: "heading", name: "맞춤 스킨케어 플랜" }
};
const validatedFixture = validateUiCaseFixture(validFixture);
assert.equal(validatedFixture.startPath, "/");
assert.equal(validatedFixture.actions[0].type, "uploadByRole");
assert.equal(validatedFixture.actions[0].role, "button");
assert.throws(() => validateUiCaseFixture({ ...validFixture, requiredEvidence: [] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, startPath: "https://evil.example" }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, actions: [{ type: "evaluate", script: "1" }] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, actions: [{ type: "clickByRole", role: "document", name: "x" }] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, actions: [{ type: "uploadByLabel", label: "Photo", path: "../private.jpg" }] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, actions: [{ type: "uploadByRole", role: "link", name: "Upload", path: "images/normal.png" }] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, actions: [{ type: "uploadByRole", role: "button", name: "Upload", path: "../private.png" }] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");

assert.equal(parseHostedPrNumber("51"), 51);
assert.throws(() => parseHostedPrNumber(undefined), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");
assert.throws(() => parseHostedPrNumber("0"), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");
assert.throws(() => parseHostedPrNumber("38.5"), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");

const previewHeadSha = "c".repeat(40);
const previewExpected = {
  prNumber: 51,
  headRef: "agent/premium-hosted-preview-harness-hardening",
  headSha: previewHeadSha
};
const nullTargetPreview = {
  target: null,
  meta: {
    githubPrId: "51",
    githubCommitRef: previewExpected.headRef,
    githubCommitSha: previewHeadSha
  }
};
const derivedNullTarget = deriveVercelAttestationTarget(nullTargetPreview, previewExpected);
assert.equal(derivedNullTarget.vercelTarget, "preview");
assert.equal(derivedNullTarget.vercelTargetEvidence, "api-null-pr-bound-preview");
assert.equal(derivedNullTarget.vercelPrBound, true);
assert.equal(assertVercelPreviewIdentity(nullTargetPreview, previewExpected).vercelTarget, "preview");

const explicitPreview = structuredClone(nullTargetPreview);
explicitPreview.target = "preview";
assert.equal(assertVercelPreviewIdentity(explicitPreview, previewExpected).vercelTargetEvidence, "api-explicit-preview-pr-bound");

const wrongPrPreview = structuredClone(nullTargetPreview);
wrongPrPreview.meta.githubPrId = "52";
assert.throws(() => assertVercelPreviewIdentity(wrongPrPreview, previewExpected), /vercel_preview_pr_binding_invalid/);
const wrongRefPreview = structuredClone(nullTargetPreview);
wrongRefPreview.meta.githubCommitRef = "agent/other-branch";
assert.throws(() => assertVercelPreviewIdentity(wrongRefPreview, previewExpected), /vercel_preview_pr_binding_invalid/);
const wrongShaPreview = structuredClone(nullTargetPreview);
wrongShaPreview.meta.githubCommitSha = "d".repeat(40);
assert.throws(() => assertVercelPreviewIdentity(wrongShaPreview, previewExpected), /vercel_preview_pr_binding_invalid/);
const productionDeployment = structuredClone(nullTargetPreview);
productionDeployment.target = "production";
assert.throws(() => assertVercelPreviewIdentity(productionDeployment, previewExpected), /vercel_preview_target_invalid/);

const now = Date.now();
const attestation = {
  schemaVersion: HOSTED_ATTESTATION_VERSION,
  generatedBy: "authoritative-api",
  generatedAt: new Date(now - 1000).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString(),
  repository: "gycha0109-beep/K_beauty",
  prNumber: 51,
  prState: "open",
  prDraft: true,
  prMerged: false,
  prHeadSha: "c".repeat(40),
  githubDeploymentId: "gh-deployment-1",
  githubDeploymentSha: "c".repeat(40),
  githubEnvironment: "Preview",
  vercelProjectId: "project-1",
  vercelDeploymentId: "deployment-1",
  vercelTarget: "preview",
  vercelState: "READY",
  vercelSourceCommitSha: "c".repeat(40),
  immutableUrl: "https://deployment.example.vercel.app"
};
const expectedAttestation = { repository: "gycha0109-beep/K_beauty", prNumber: 51, headSha: "c".repeat(40), vercelProjectId: "project-1" };
assert.equal(validateDeploymentAttestation(attestation, expectedAttestation, { now }).immutableHost, "deployment.example.vercel.app");
assert.throws(() => validateDeploymentAttestation({ ...attestation, prNumber: 38 }, expectedAttestation, { now }), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");
assert.throws(() => validateDeploymentAttestation({ ...attestation, generatedBy: "manual" }, expectedAttestation, { now }), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");
assert.throws(() => validateDeploymentAttestation({ ...attestation, vercelTarget: "production" }, expectedAttestation, { now }), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");
assert.throws(() => validateDeploymentAttestation({ ...attestation, vercelState: "CANCELED" }, expectedAttestation, { now }), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");

assert.throws(() => validateCredentialRoot(process.cwd(), { repositoryRoot: process.cwd(), osTempRoot: process.cwd() }), /credential_root_inside_repository/);
const evidence = {
  schemaVersion: "premium-hosted-login-evidence-v2",
  accountKey: "A",
  userIdHash: "d".repeat(64),
  permanentUser: true,
  providerCategory: "google",
  deploymentId: "deployment-1",
  deploymentSha: "c".repeat(40),
  targetHost: "deployment.example.vercel.app",
  storageStateHash: "e".repeat(64),
  createdAt: new Date(now - 1000).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString()
};
const expectedEvidence = { accountKey: "A", userIdHash: "d".repeat(64), deploymentId: "deployment-1", deploymentSha: "c".repeat(40), targetHost: "deployment.example.vercel.app", storageStateHash: "e".repeat(64) };
assert.equal(validateLoginEvidence(evidence, expectedEvidence, { now }), true);
assert.throws(() => validateLoginEvidence({ ...evidence, providerCategory: "github" }, expectedEvidence, { now }), /login_evidence_provider_invalid/);

assert.throws(() => sanitizeEvidence({ accessToken: "secret" }), (error) => error.category === HOSTED_FAILURE_CATEGORIES.HARNESS);
assert.throws(() => sanitizeEvidence({ note: "user@example.com" }), (error) => error.category === HOSTED_FAILURE_CATEGORIES.HARNESS);
const rawUuid = "123e4567-e89b-12d3-a456-426614174000";
const sanitizedIdentifiers = sanitizeEvidence({ savedReportId: rawUuid, nested: { productId: rawUuid } });
assert.match(sanitizedIdentifiers.savedReportId, /^sha256:[0-9a-f]{64}$/);
assert.equal(sanitizedIdentifiers.savedReportId, sanitizedIdentifiers.nested.productId);
assert.notEqual(sanitizedIdentifiers.savedReportId, rawUuid);
assert.throws(() => sanitizeEvidence({ note: rawUuid }), (error) => error.category === HOSTED_FAILURE_CATEGORIES.HARNESS);
assert.deepEqual(sanitizeEvidence({ status: "passed", nested: { savedReportIdHash: "sha256:x" } }), { status: "passed", nested: { savedReportIdHash: "sha256:x" } });

const allPassed = REQUIRED_HOSTED_LANES.map((name) => ({ name, status: "passed", severity: "important" }));
assert.equal(evaluateHostedVerdict(allPassed).status, "passed");
assert.equal(evaluateHostedVerdict(allPassed.filter((lane) => lane.name !== "safe-5xx")).status, "failed");
assert.equal(evaluateHostedVerdict([...allPassed, allPassed[0]]).status, "failed");
const failed = structuredClone(allPassed);
failed[0].status = "unknown";
failed[0].severity = "critical";
assert.equal(evaluateHostedVerdict(failed).criticalCount, 1);

console.log("premium hosted preview contract verification passed");
