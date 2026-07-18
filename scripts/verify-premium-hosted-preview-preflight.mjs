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
  ensureSecureRunDirectories,
  hashFileSha256,
  validateLoginEvidence
} from "./premium-hosted-preview-security.mjs";
import { requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);

const attestationDocument = JSON.parse(await readFile(manifest.deploymentAttestationPath, "utf8"));
const attestation = validateDeploymentAttestation(attestationDocument, {
  repository: "gycha0109-beep/K_beauty",
  prNumber: 38,
  headSha: config.expectedSha,
  vercelProjectId: manifest.vercelProjectId
});
requireCondition(attestation.immutableHost === config.baseUrl.hostname, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "preflight", "immutable_host_mismatch");
requireCondition(attestation.prHeadSha === config.expectedSha, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "preflight", "attested_head_mismatch");

await ensureSecureRunDirectories(config.securePaths);
const runLock = await acquireHostedRunLock(
  config.securePaths,
  `${attestation.repository}:${attestation.vercelDeploymentId}:${manifest.accountA.expectedUserIdHash}:${manifest.accountB.expectedUserIdHash}`
);

try {
  requireCondition(typeof manifest.catalogHash === "string" && /^[0-9a-f]{64}$/i.test(manifest.catalogHash), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", "catalog_hash_missing_or_invalid");
  requireCondition(manifest.fixtureRoot && existsSync(manifest.fixtureRoot), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", "fixture_root_missing");
  for (const [name, path] of Object.entries(manifest.fixtures || {})) {
    requireCondition(existsSync(path), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", `fixture_missing_${name}`);
  }

  const accountHashes = [];
  for (const [accountKey, account] of [["accountA", manifest.accountA], ["accountB", manifest.accountB]]) {
    requireCondition(account.storageStatePath && existsSync(account.storageStatePath), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", "storage_state_missing");
    requireCondition(account.loginEvidencePath && existsSync(account.loginEvidencePath), HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "google_login_evidence_missing");
    const storageStateHash = await hashFileSha256(account.storageStatePath);
    const evidence = JSON.parse(await readFile(account.loginEvidencePath, "utf8"));
    validateLoginEvidence(evidence, {
      accountKey: accountKey === "accountA" ? "A" : "B",
      userIdHash: account.expectedUserIdHash,
      deploymentId: attestation.vercelDeploymentId,
      deploymentSha: attestation.prHeadSha,
      targetHost: attestation.immutableHost,
      storageStateHash
    });
    accountHashes.push(evidence.userIdHash);
    const state = JSON.parse(await readFile(account.storageStatePath, "utf8"));
    requireCondition(Array.isArray(state.cookies) && state.cookies.some((cookie) => String(cookie.name || "").includes("auth-token")), HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "google_session_cookie_missing");
  }
  requireCondition(new Set(accountHashes).size === 2, HOSTED_FAILURE_CATEGORIES.AUTH_EVIDENCE, "preflight", "account_identity_collision");

  const response = await fetch(config.baseUrl.origin, { redirect: "manual" }).catch(() => null);
  requireCondition(response && response.status < 500, HOSTED_FAILURE_CATEGORIES.INFRASTRUCTURE, "preflight", "preview_unreachable");
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    requireCondition(location, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "preflight", "preview_redirect_missing_location");
    requireCondition(new URL(location, config.baseUrl).hostname === config.baseUrl.hostname, HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION, "preflight", "preview_redirected_to_unexpected_origin");
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
