import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parseHostedConfig, loadHostedManifest, buildHostedRunManifest, HOSTED_FAILURE_CATEGORIES } from "./premium-hosted-preview-core.mjs";
import { requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);

for (const [name, path] of Object.entries(manifest.fixtures || {})) {
  requireCondition(existsSync(path), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", `fixture_missing_${name}`);
}
for (const [accountKey, account] of [["accountA", manifest.accountA], ["accountB", manifest.accountB]]) {
  requireCondition(account.storageStatePath && existsSync(account.storageStatePath), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "preflight", "storage_state_missing");
  requireCondition(account.loginEvidencePath && existsSync(account.loginEvidencePath), HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "google_login_evidence_missing");
  const state = JSON.parse(await readFile(account.storageStatePath, "utf8"));
  requireCondition(Array.isArray(state.cookies) && state.cookies.some((cookie) => String(cookie.name || "").includes("auth-token")), HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "google_session_cookie_missing");
  const evidence = JSON.parse(await readFile(account.loginEvidencePath, "utf8"));
  requireCondition(evidence.status === "passed" && evidence.account === accountKey, HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "google_login_evidence_invalid");
  requireCondition(evidence.targetHost === config.baseUrl.hostname && evidence.deploymentSha === config.deploymentSha, HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "google_login_evidence_target_mismatch");
}

const response = await fetch(config.baseUrl.origin, { redirect: "manual" }).catch(() => null);
requireCondition(response && response.status < 500, HOSTED_FAILURE_CATEGORIES.INFRASTRUCTURE, "preflight", "preview_unreachable");
requireCondition(![301, 302, 307, 308].includes(response.status) || new URL(response.headers.get("location"), config.baseUrl).hostname === config.baseUrl.hostname, HOSTED_FAILURE_CATEGORIES.OAUTH, "preflight", "preview_redirected_to_unexpected_origin");

const output = {
  ...buildHostedRunManifest(config, manifest),
  status: "passed",
  checks: {
    previewReachable: true,
    fixtureCount: Object.keys(manifest.fixtures || {}).length,
    accountStorageStates: 2,
    googleLoginEvidence: 2,
    productCaseCount: manifest.currentProductCases.length
  }
};
console.log(JSON.stringify(output, null, 2));
