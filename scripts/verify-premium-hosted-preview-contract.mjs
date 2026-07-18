import assert from "node:assert/strict";
import {
  HOSTED_FAILURE_CATEGORIES,
  REQUIRED_HOSTED_LANES,
  compareLocaleSemantics,
  evaluateHostedVerdict,
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

function reportFixture(locale = "ko", overrides = {}) {
  const body = {
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
  return body;
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
assert.throws(() => projectCanonicalEvidence({}), (error) => error.category === "CANONICAL_PROJECTION_FAILURE");
const duplicateReason = structuredClone(reportFixture());
duplicateReason.decisionBundle.functionalPolicy.reasonCodes = ["x", "x"];
assert.throws(() => projectCanonicalEvidence(duplicateReason), (error) => error.category === "CANONICAL_PROJECTION_FAILURE");

const validFixture = {
  schemaVersion: HOSTED_UI_FIXTURE_VERSION,
  startPath: "/premium",
  actions: [
    { type: "fillByLabel", label: "Skin type", value: "combination" },
    { type: "clickByRole", role: "button", name: "View report" }
  ],
  resultMarker: { kind: "heading", name: "Premium report" }
};
assert.equal(validateUiCaseFixture(validFixture).startPath, "/premium");
assert.throws(() => validateUiCaseFixture({ ...validFixture, requiredEvidence: [] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, startPath: "https://evil.example" }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, actions: [{ type: "evaluate", script: "1" }] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");
assert.throws(() => validateUiCaseFixture({ ...validFixture, actions: [{ type: "uploadByLabel", label: "Photo", path: "../private.jpg" }] }), (error) => error.category === "FIXTURE_CONTRACT_FAILURE");

const attestation = {
  schemaVersion: HOSTED_ATTESTATION_VERSION,
  repository: "gycha0109-beep/K_beauty",
  prNumber: 38,
  prState: "open",
  prDraft: true,
  prMerged: false,
  prHeadSha: "c".repeat(40),
  githubDeploymentSha: "c".repeat(40),
  githubEnvironment: "Preview",
  vercelProjectId: "project-1",
  vercelDeploymentId: "deployment-1",
  vercelTarget: "preview",
  vercelState: "READY",
  vercelSourceCommitSha: "c".repeat(40),
  immutableUrl: "https://deployment.example.vercel.app"
};
assert.equal(validateDeploymentAttestation(attestation, { repository: "gycha0109-beep/K_beauty", prNumber: 38, headSha: "c".repeat(40), vercelProjectId: "project-1" }).immutableHost, "deployment.example.vercel.app");
assert.throws(() => validateDeploymentAttestation({ ...attestation, vercelTarget: "production" }, { repository: "gycha0109-beep/K_beauty", prNumber: 38, headSha: "c".repeat(40), vercelProjectId: "project-1" }), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");
assert.throws(() => validateDeploymentAttestation({ ...attestation, vercelState: "CANCELED" }, { repository: "gycha0109-beep/K_beauty", prNumber: 38, headSha: "c".repeat(40), vercelProjectId: "project-1" }), (error) => error.category === "PREVIEW_ATTESTATION_FAILURE");

assert.throws(() => validateCredentialRoot(process.cwd(), { repositoryRoot: process.cwd(), osTempRoot: process.cwd() }), /credential_root_inside_repository/);
const now = Date.now();
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
assert.equal(validateLoginEvidence(evidence, { accountKey: "A", userIdHash: "d".repeat(64), deploymentId: "deployment-1", deploymentSha: "c".repeat(40), targetHost: "deployment.example.vercel.app", storageStateHash: "e".repeat(64) }, { now }), true);
assert.throws(() => validateLoginEvidence({ ...evidence, providerCategory: "github" }, { accountKey: "A", userIdHash: "d".repeat(64), deploymentId: "deployment-1", deploymentSha: "c".repeat(40), targetHost: "deployment.example.vercel.app", storageStateHash: "e".repeat(64) }, { now }), /login_evidence_provider_invalid/);

assert.throws(() => sanitizeEvidence({ accessToken: "secret" }), (error) => error.category === HOSTED_FAILURE_CATEGORIES.HARNESS);
assert.deepEqual(sanitizeEvidence({ status: "passed", nested: { savedReportIdHash: "sha256:x" } }), { status: "passed", nested: { savedReportIdHash: "sha256:x" } });

const allPassed = REQUIRED_HOSTED_LANES.map((name) => ({ name, status: "passed", severity: "important" }));
assert.equal(evaluateHostedVerdict(allPassed).status, "passed");
assert.equal(evaluateHostedVerdict(allPassed.filter((lane) => lane.name !== "safe-5xx")).status, "failed");
const failed = structuredClone(allPassed);
failed[0].status = "unknown";
failed[0].severity = "critical";
assert.equal(evaluateHostedVerdict(failed).criticalCount, 1);

console.log("premium hosted preview contract verification passed");
