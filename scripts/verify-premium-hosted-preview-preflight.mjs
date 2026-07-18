import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  parseHostedConfig,
  loadHostedManifest,
  buildHostedRunManifest,
  HOSTED_FAILURE_CATEGORIES,
  validateDeploymentAttestation
} from "./premium-hosted-preview-core-v2.mjs";
import {
  acquireHostedRunLock,
  assertPathInside,
  ensureSecureRunDirectories,
  hashFileSha256,
  validateLoginEvidence
} from "./premium-hosted-preview-security.mjs";
import { JourneyFailure, requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);

const attestationDocument = JSON.parse(await readFile(manifest.deploymentAttestationPath, "utf8"));
const attestation = validateDeploymentAttestation(attestationDocument, {
  repository: "gycha0109-beep/K_beauty",
  prNumber: config.prNumber,
  headSha: config.expectedSha,
  vercelProjectId: manifest.vercelProjectId
});
requireCondition(attestation.immutableHost === config.baseUrl.hostname, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "preflight", "immutable_host_mismatch");
requireCondition(attestation.prHeadSha === config.expectedSha, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "preflight", "attested_head_mismatch");

await ensureSecureRunDirectories(config.securePaths);
const runLock = await acquireHostedRunLock(
  config.securePaths,
  `${attestation.repository}:${attestation.prNumber}:${attestation.vercelDeploymentId}:${manifest.accountA.expectedUserIdHash}:${manifest.accountB.expectedUserIdHash}`
);

function credentialPath(path, code) {
  try {
    return assertPathInside(config.securePaths.credentialsDir, path, code);
  } catch (error) {
    throw new JourneyFailure(HOSTED_FAILURE_CATEGORIES.CREDENTIAL_STORAGE, "preflight", error.code || code);
  }
}

try {
  for (const [name, path] of Object.entries(manifest.fixtures || {})) {
    requireCondition(existsSync(path), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", `fixture_missing_${name}`);
  }

  const accountHashes = [];
  for (const [accountKey, account] of [["accountA", manifest.accountA], ["accountB", manifest.accountB]]) {
    const storageStatePath = credentialPath(account.storageStatePath, "storage_state_path_outside_secure_root");
    const loginEvidencePath = credentialPath(account.loginEvidencePath, "login_evidence_path_outside_secure_root");
    requireCondition(existsSync(storageStatePath), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", "storage_state_missing");
    requireCondition(existsSync(loginEvidencePath), HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "google_login_evidence_missing");
    const storageStateHash = await hashFileSha256(storageStatePath);
    const evidence = JSON.parse(await readFile(loginEvidencePath, "utf8"));
    validateLoginEvidence(evidence, {
      accountKey: accountKey === "accountA" ? "A" : "B",
      userIdHash: account.expectedUserIdHash,
      deploymentId: attestation.vercelDeploymentId,
      deploymentSha: attestation.prHeadSha,
      targetHost: attestation.immutableHost,
      storageStateHash
    });
    accountHashes.push(evidence.userIdHash);
    const state = JSON.parse(await readFile(storageStatePath, "utf8"));
    requireCondition(
      Array.isArray(state.cookies) && state.cookies.some((cookie) => String(cookie.name || "").includes("auth-token")),
      HOSTED_FAILURE_CATEGORIES.OAUTH,
      "preflight",
      "google_session_cookie_missing"
    );
  }
  requireCondition(new Set(accountHashes).size === 2, HOSTED_FAILURE_CATEGORIES.AUTH_EVIDENCE, "preflight", "account_identity_collision");

  const response = await fetch(config.baseUrl.origin, { redirect: "manual" }).catch(() => null);
  requireCondition(response && response.status < 500, HOSTED_FAILURE_CATEGORIES.INFRASTRUCTURE, "preflight", "preview_unreachable");
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    requireCondition(location, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "preflight", "preview_redirect_missing_location");
    requireCondition(
      new URL(location, config.baseUrl).hostname === config.baseUrl.hostname,
      HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION,
      "preflight",
      "preview_redirected_to_unexpected_origin"
    );
  }

  const output = {
    ...buildHostedRunManifest(config, manifest, attestation),
    status: "passed",
    checks: {
      authoritativeDeployment: true,
      immutableHost: true,
      previewReachable: true,
      fixtureCount: Object.keys(manifest.fixtures || {}).length,
      accountStorageStates: 2,
      googleLoginEvidence: 2,
      productCaseCount: manifest.currentProductCases.length,
      catalogBound: true
    }
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  await runLock.release();
}
