import { existsSync } from "node:fs";
import {
  HOSTED_FAILURE_CATEGORIES,
  REQUIRED_HOSTED_LANES,
  assertHostedArtifactsSafe,
  buildHostedRunManifest as buildLegacyRunManifest,
  evaluateHostedVerdict,
  loadHostedManifest as loadLegacyManifest,
  parseHostedConfig as parseLegacyConfig,
  sanitizeEvidence,
  writeHostedArtifacts
} from "./premium-hosted-preview-core.mjs";
import {
  HostedContractError,
  compareHostedLocaleSemantics,
  projectHostedCanonicalEvidence,
  validateHostedDeploymentAttestation,
  validateHostedUiCaseFixture
} from "./premium-hosted-preview-contract-core.mjs";
import { resolveHostedRunPaths } from "./premium-hosted-preview-security.mjs";
import { JourneyFailure, requireCondition } from "./premium-browser-journey-core.mjs";

export {
  HOSTED_FAILURE_CATEGORIES,
  REQUIRED_HOSTED_LANES,
  assertHostedArtifactsSafe,
  evaluateHostedVerdict,
  sanitizeEvidence,
  writeHostedArtifacts
};

function wrap(error, category, step, fallbackCode) {
  if (error instanceof JourneyFailure) return error;
  if (error instanceof HostedContractError) {
    return new JourneyFailure(category, step, error.code, error.detail == null ? error.code : String(error.detail));
  }
  return new JourneyFailure(category, step, fallbackCode, error?.message || fallbackCode);
}

export function parseHostedConfig(env = process.env) {
  const legacy = parseLegacyConfig(env);
  let securePaths;
  try {
    securePaths = resolveHostedRunPaths(legacy.runId, env);
  } catch (error) {
    throw wrap(error, "CREDENTIAL_STORAGE_FAILURE", "configuration", "secure_run_path_invalid");
  }
  return { ...legacy, artifactDir: securePaths.artifactsDir, securePaths };
}

export async function loadHostedManifest(path) {
  const manifest = await loadLegacyManifest(path);
  requireCondition(
    manifest.accountA.expectedUserIdHash !== manifest.accountB.expectedUserIdHash,
    "AUTH_EVIDENCE_FAILURE",
    "configuration",
    "account_hashes_must_differ"
  );
  requireCondition(
    manifest.deploymentAttestationPath && existsSync(manifest.deploymentAttestationPath),
    "PREVIEW_ATTESTATION_FAILURE",
    "configuration",
    "deployment_attestation_missing"
  );
  return manifest;
}

export function compareLocaleSemantics(ko, en) {
  return compareHostedLocaleSemantics(ko, en);
}

export function projectCanonicalEvidence(body, options = {}) {
  try {
    return projectHostedCanonicalEvidence(body, options);
  } catch (error) {
    throw wrap(error, "CANONICAL_PROJECTION_FAILURE", "canonical-projection", "canonical_projection_failed");
  }
}

export function validateUiCaseFixture(value) {
  try {
    return validateHostedUiCaseFixture(value);
  } catch (error) {
    throw wrap(error, "FIXTURE_CONTRACT_FAILURE", "fixture-contract", "fixture_contract_failed");
  }
}

export function validateDeploymentAttestation(value, expected) {
  try {
    return validateHostedDeploymentAttestation(value, expected);
  } catch (error) {
    throw wrap(error, "PREVIEW_ATTESTATION_FAILURE", "deployment-attestation", "deployment_attestation_failed");
  }
}

export function buildHostedRunManifest(config, manifest, attestation = null) {
  return {
    ...buildLegacyRunManifest(config, manifest),
    deploymentSha: attestation?.prHeadSha || config.deploymentSha,
    deploymentId: attestation?.vercelDeploymentId || null,
    immutableHost: attestation?.immutableHost || null
  };
}
