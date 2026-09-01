import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FACE_LAB_REVIEW_PRODUCTION_ORG_ID,
  rotateFaceLabNeutralReviewAccess
} from "./face-lab-neutral-review-operator.mjs";

const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const VERCEL_HOST_PATTERN = /^[a-z0-9.-]+\.vercel\.app$/i;

function parseArgs(argv = process.argv.slice(2)) {
  const result = { apply: false, confirmEmptyReviewCampaign: false };
  for (const value of argv) {
    if (value === "--apply") {
      result.apply = true;
      continue;
    }
    if (value === "--confirm-empty-review-campaign") {
      result.confirmEmptyReviewCampaign = true;
      continue;
    }
    throw new Error(`unsupported_argument:${value}`);
  }
  return result;
}

function getVercelCommandIndex(args) {
  return Array.isArray(args) ? args.findIndex((value) => value === "vercel") : -1;
}

function isProductionListCall(args) {
  const index = getVercelCommandIndex(args);
  return (
    index >= 0 &&
    args[index + 1] === "list" &&
    args.includes("--prod") &&
    args.includes("--format") &&
    args.includes("json")
  );
}

function failedEnrichmentResult(apiResult) {
  return {
    status: 1,
    stdout: "",
    stderr: "vercel_deployment_id_enrichment_failed",
    error: apiResult?.error
  };
}

function parseDeploymentApiResponse(output, expectedHostname) {
  let parsed;
  try {
    parsed = JSON.parse(String(output || "").trim());
  } catch {
    throw new Error("vercel_deployment_id_enrichment_json_invalid");
  }

  const id = String(parsed?.id || "").trim();
  const hostname = String(parsed?.url || "").trim().toLowerCase();
  const readyState = String(parsed?.readyState || parsed?.state || "").toUpperCase();

  if (!DEPLOYMENT_ID_PATTERN.test(id)) {
    throw new Error("vercel_deployment_id_enrichment_attestation_invalid");
  }
  if (parsed?.target != null && parsed.target !== "production") {
    throw new Error("vercel_deployment_id_enrichment_attestation_invalid");
  }
  if (readyState && readyState !== "READY") {
    throw new Error("vercel_deployment_id_enrichment_attestation_invalid");
  }
  if (hostname && hostname !== expectedHostname) {
    throw new Error("vercel_deployment_id_enrichment_attestation_invalid");
  }

  return id;
}

export function createVercelDeploymentIdCompatSpawn(baseSpawn = spawnSync) {
  return (command, args, options = {}) => {
    const result = baseSpawn(command, args, options);
    if (
      result?.error ||
      result?.status !== 0 ||
      !isProductionListCall(args)
    ) {
      return result;
    }

    let parsed;
    try {
      parsed = JSON.parse(String(result.stdout || "").trim());
    } catch {
      return result;
    }
    if (!Array.isArray(parsed?.deployments)) return result;

    const vercelIndex = getVercelCommandIndex(args);
    const invocationPrefix = args.slice(0, vercelIndex + 1);
    let changed = false;

    for (const candidate of parsed.deployments) {
      if (DEPLOYMENT_ID_PATTERN.test(String(candidate?.id || "").trim())) {
        continue;
      }
      if (
        String(candidate?.state || "").toUpperCase() !== "READY" ||
        candidate?.target !== "production"
      ) {
        continue;
      }

      const hostname = String(candidate?.url || "").trim().toLowerCase();
      if (!VERCEL_HOST_PATTERN.test(hostname)) continue;

      const endpoint =
        `/v13/deployments/${hostname}` +
        `?withGitRepoInfo=true&teamId=${FACE_LAB_REVIEW_PRODUCTION_ORG_ID}`;
      const apiResult = baseSpawn(
        command,
        [...invocationPrefix, "api", endpoint],
        { ...options, input: undefined }
      );
      if (apiResult?.error || apiResult?.status !== 0) {
        return failedEnrichmentResult(apiResult);
      }

      try {
        candidate.id = parseDeploymentApiResponse(apiResult.stdout, hostname);
      } catch {
        return failedEnrichmentResult(apiResult);
      }
      changed = true;
    }

    if (!changed) return result;
    return { ...result, stdout: JSON.stringify(parsed) };
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const result = rotateFaceLabNeutralReviewAccess({
    apply: args.apply,
    confirmEmptyReviewCampaign: args.confirmEmptyReviewCampaign,
    spawnFn: createVercelDeploymentIdCompatSpawn()
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
