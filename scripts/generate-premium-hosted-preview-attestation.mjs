import { resolve } from "node:path";
import {
  HOSTED_ATTESTATION_VERSION,
  validateHostedDeploymentAttestation
} from "./premium-hosted-preview-contract-core.mjs";
import {
  assertPathInside,
  ensureSecureRunDirectories,
  resolveHostedRunPaths,
  secureWriteJson
} from "./premium-hosted-preview-security.mjs";
import { assertVercelPreviewIdentity } from "./premium-hosted-preview-vercel-target.mjs";

function requireValue(value, code) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function requirePositiveInteger(value, code) {
  const raw = requireValue(value, code);
  if (!/^\d+$/.test(raw)) throw new Error(code);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(code);
  return parsed;
}

async function fetchJson(url, token, code) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "bejewely-premium-hosted-verifier"
    }
  });
  if (response.status !== 200) throw new Error(`${code}:${response.status}`);
  return response.json();
}

const repository = "gycha0109-beep/K_beauty";
const [owner, repo] = repository.split("/");
const prNumber = requirePositiveInteger(process.env.PREMIUM_HOSTED_PR_NUMBER, "premium_hosted_pr_number_missing_or_invalid");
const githubDeploymentId = requireValue(process.env.PREMIUM_HOSTED_GITHUB_DEPLOYMENT_ID, "github_deployment_id_missing");
const vercelDeploymentId = requireValue(process.env.PREMIUM_HOSTED_VERCEL_DEPLOYMENT_ID, "vercel_deployment_id_missing");
const vercelProjectId = requireValue(process.env.PREMIUM_HOSTED_VERCEL_PROJECT_ID, "vercel_project_id_missing");
const githubToken = requireValue(process.env.GITHUB_TOKEN, "github_token_missing");
const vercelToken = requireValue(process.env.VERCEL_TOKEN, "vercel_token_missing");
const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();
const runId = requireValue(process.env.PREMIUM_HOSTED_RUN_ID, "run_id_missing");
const paths = resolveHostedRunPaths(runId);
await ensureSecureRunDirectories(paths);
const outputPath = assertPathInside(
  paths.credentialsDir,
  process.env.PREMIUM_HOSTED_ATTESTATION_OUTPUT || resolve(paths.credentialsDir, "deployment-attestation.json"),
  "attestation_output_outside_secure_root"
);

const apiRoot = "https://api.github.com";
const pr = await fetchJson(`${apiRoot}/repos/${owner}/${repo}/pulls/${prNumber}`, githubToken, "github_pr_lookup_failed");
const deployment = await fetchJson(`${apiRoot}/repos/${owner}/${repo}/deployments/${githubDeploymentId}`, githubToken, "github_deployment_lookup_failed");
const vercelQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
const vercel = await fetchJson(`https://api.vercel.com/v13/deployments/${encodeURIComponent(vercelDeploymentId)}${vercelQuery}`, vercelToken, "vercel_deployment_lookup_failed");

const prHeadSha = requireValue(pr.head?.sha, "github_pr_head_sha_missing");
const prHeadRef = requireValue(pr.head?.ref, "github_pr_head_ref_missing");
const vercelIdentity = assertVercelPreviewIdentity(vercel, {
  prNumber,
  headRef: prHeadRef,
  headSha: prHeadSha
});
const immutableUrl = vercel.url ? `https://${vercel.url}` : null;
const now = Date.now();
const attestation = {
  schemaVersion: HOSTED_ATTESTATION_VERSION,
  generatedBy: "authoritative-api",
  generatedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
  repository,
  prNumber,
  prState: pr.state,
  prDraft: pr.draft === true,
  prMerged: Boolean(pr.merged_at),
  prHeadSha,
  prHeadRef,
  githubDeploymentId: String(deployment.id),
  githubDeploymentSha: deployment.sha || null,
  githubEnvironment: deployment.environment || null,
  vercelProjectId: vercel.projectId || vercel.project?.id || null,
  vercelDeploymentId: vercel.id || vercel.uid || vercelDeploymentId,
  vercelRawTarget: vercelIdentity.vercelRawTarget,
  vercelTarget: vercelIdentity.vercelTarget,
  vercelTargetEvidence: vercelIdentity.vercelTargetEvidence,
  vercelSourcePrNumber: vercelIdentity.vercelSourcePrNumber,
  vercelSourceRef: vercelIdentity.vercelSourceRef,
  vercelState: vercel.readyState || vercel.state || null,
  vercelSourceCommitSha: vercelIdentity.vercelSourceCommitSha,
  immutableUrl
};

const validated = validateHostedDeploymentAttestation(attestation, {
  repository,
  prNumber,
  headSha: prHeadSha,
  vercelProjectId
});
await secureWriteJson(outputPath, validated);
console.log(JSON.stringify({
  status: "passed",
  outputPath,
  repository,
  prNumber,
  headSha: validated.prHeadSha,
  githubDeploymentId: validated.githubDeploymentId,
  vercelDeploymentId: validated.vercelDeploymentId,
  vercelTargetEvidence: attestation.vercelTargetEvidence,
  immutableHost: validated.immutableHost,
  expiresAt: validated.expiresAt
}, null, 2));
