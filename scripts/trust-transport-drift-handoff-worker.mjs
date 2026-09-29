import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { qualifyOfficialSourceIdentity } from "../lib/trust/official-source-identity-qualification.mjs";
import { observeQualificationCandidate } from "./trust-source-identity-qualification.mjs";
import { runRediscoveryQualificationBatch } from "./trust-source-rediscovery.mjs";

export const HANDOFF_CONTRACT = "trust-phase8i3-transport-drift-handoff-result-v1";
export const POLICY_REGISTRY_CONTRACT =
  "trust-phase8i3-transport-drift-evaluation-policy-registry-v1";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableDigest(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function parseBoolean(value, name) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name}=true|false is required`);
}

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function rpcOrThrow(client, fn, args = {}) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}:${error.code || "RPC_ERROR"}:${error.message}`);
  return data;
}

function validateRegistry(registry) {
  if (
    !registry ||
    registry.contract !== POLICY_REGISTRY_CONTRACT ||
    typeof registry.version !== "string" ||
    !Array.isArray(registry.policies)
  ) {
    throw new Error("TRUST_PHASE8I3_POLICY_REGISTRY_INVALID");
  }

  const keys = new Set();
  const scopes = new Set();
  for (const policy of registry.policies) {
    if (
      !policy?.policy_key ||
      !policy?.product_id ||
      !policy?.subject_id ||
      !Array.isArray(policy?.historical_source_ids) ||
      !policy?.direct_qualification_template ||
      !policy?.rediscovery_case_template
    ) {
      throw new Error("TRUST_PHASE8I3_POLICY_INVALID");
    }

    const scope = `${policy.product_id}:${policy.subject_id}`;
    if (keys.has(policy.policy_key) || scopes.has(scope)) {
      throw new Error("TRUST_PHASE8I3_POLICY_DUPLICATE");
    }
    keys.add(policy.policy_key);
    scopes.add(scope);
  }

  const retryHours = Number(registry.retry_interval_hours ?? 6);
  if (!Number.isFinite(retryHours) || retryHours <= 0 || retryHours > 168) {
    throw new Error("TRUST_PHASE8I3_RETRY_INTERVAL_INVALID");
  }
}

function policyMap(registry) {
  return new Map(
    registry.policies.map((policy) => [
      `${policy.product_id}:${policy.subject_id}`,
      policy,
    ]),
  );
}

function lineageMatches(caseRow, policy) {
  if (!policy) return false;
  if (
    caseRow.product_id !== policy.product_id ||
    caseRow.subject_id !== policy.subject_id
  ) {
    return false;
  }

  const caseSources = [...(caseRow.source_ids || [])].map(String).sort();
  const policySources = [...(policy.historical_source_ids || [])].map(String).sort();
  if (caseSources.length === 0) return false;
  if (!caseSources.every((sourceId) => policySources.includes(sourceId))) return false;

  const directHistorical = policy.direct_qualification_template?.historical_source;
  const rediscoveryHistorical =
    policy.rediscovery_case_template?.qualification_template?.historical_source;
  if (!directHistorical || !rediscoveryHistorical) return false;
  if (!caseSources.includes(String(directHistorical.source_id))) return false;

  return (
    String(directHistorical.canonical_locator) === String(caseRow.effective_locator) &&
    String(rediscoveryHistorical.canonical_locator) === String(caseRow.effective_locator)
  );
}

function latestEvaluationGate(caseRow, policy, registry, now, retryHours) {
  const latest = caseRow.latest_evaluation || null;
  if (!latest) return { evaluate: true, reason: "NO_PRIOR_EVALUATION" };

  const currentPolicyKey = policy
    ? policy.policy_key
    : `unconfigured:${caseRow.product_id}:${caseRow.subject_id}`;
  const samePolicy =
    latest.policy_key === currentPolicyKey &&
    latest.policy_version === registry.version;

  if (!samePolicy) {
    return { evaluate: true, reason: "POLICY_CHANGED" };
  }

  if (latest.result_kind === "READY_FOR_8I4") {
    return { evaluate: false, reason: "READY_FOR_8I4_STABLE" };
  }
  if (latest.result_kind === "HOLD") {
    return { evaluate: false, reason: "HOLD_STABLE_UNTIL_POLICY_OR_NEW_CASE" };
  }
  if (latest.result_kind === "POLICY_REQUIRED" && !policy) {
    return { evaluate: false, reason: "POLICY_REQUIRED_STABLE" };
  }

  if (latest.result_kind === "RETRYABLE") {
    const createdAt = Date.parse(latest.created_at);
    if (Number.isFinite(createdAt)) {
      const ageMs = now.getTime() - createdAt;
      if (ageMs < retryHours * 60 * 60 * 1000) {
        return { evaluate: false, reason: "RETRY_INTERVAL_NOT_REACHED" };
      }
    }
  }

  return { evaluate: true, reason: "RETRY_OR_POLICY_AVAILABLE" };
}

function directQualificationInput(caseRow, policy) {
  const template = policy.direct_qualification_template;
  return {
    contract: template.contract,
    case_id: `phase8i3:${caseRow.case_id}:direct`,
    historical_source: template.historical_source,
    governed_subject: template.governed_subject,
    reviewed_binding: template.reviewed_binding ?? null,
    requirements: template.requirements,
    candidate: {
      candidate_locator: caseRow.confirmed_final_locator,
      discovery_method: "official_http_redirect",
      publisher: template.candidate_defaults.publisher,
      market: template.candidate_defaults.market ?? null,
      source_kind: template.candidate_defaults.source_kind,
    },
    observation: {},
  };
}

function rediscoveryBatch(caseRow, policy) {
  const template = structuredClone(policy.rediscovery_case_template);
  template.case_id = `phase8i3:${caseRow.case_id}:rediscovery`;
  template.historical_source_ids = [...caseRow.source_ids];
  return {
    contract: "trust-phase8h-official-source-rediscovery-batch-v1",
    case_count: 1,
    cases: [template],
  };
}

function exactRediscoveryQualification(rediscoveryResult) {
  const row = rediscoveryResult?.results?.[0];
  if (!row) return null;
  for (const candidate of row.qualifications || []) {
    if (candidate.qualification?.disposition === "QUALIFIED_EXACT") {
      return candidate;
    }
  }
  return null;
}

function rediscoveryRetryable(rediscoveryResult) {
  const row = rediscoveryResult?.results?.[0];
  if (!row) return false;
  if (row.rediscovery?.disposition === "TRANSIENT_FAILURE") return true;
  const qualifications = row.qualifications || [];
  return (
    qualifications.length > 0 &&
    qualifications.every(
      (entry) => entry.qualification?.disposition === "TRANSIENT_FAILURE",
    )
  );
}

function summarizeQualification(qualification) {
  if (!qualification) return null;
  return {
    contract: qualification.contract,
    historical_source_id: qualification.historical_source_id ?? null,
    historical_locator: qualification.historical_locator ?? null,
    product_id: qualification.product_id ?? null,
    subject_id: qualification.subject_id ?? null,
    disposition: qualification.disposition,
    reason: qualification.reason,
    qualification_digest: qualification.qualification_digest,
    candidate_locator: qualification.candidate_locator,
    candidate_source_kind: qualification.candidate_source_kind ?? null,
    discovery_method: qualification.discovery_method ?? null,
    mutation_policy: qualification.mutation_policy ?? null,
    authority: qualification.authority,
  };
}

function qualifiedHistoricalSourceId(caseRow, qualification) {
  const sourceId = qualification?.historical_source_id
    ? String(qualification.historical_source_id)
    : null;
  if (
    !sourceId ||
    !(caseRow.source_ids || []).map(String).includes(sourceId)
  ) {
    throw new Error("TRUST_PHASE8I3_READY_FOR_8I4_QUALIFIED_SOURCE_LINEAGE_INVALID");
  }
  return sourceId;
}

function summarizeRediscovery(result) {
  const row = result?.results?.[0];
  if (!row) return null;
  return {
    contract: result.contract,
    case_id: row.case_id,
    disposition: row.disposition,
    rediscovery_disposition: row.rediscovery?.disposition ?? null,
    candidate_count: row.rediscovery?.candidate_count ?? 0,
    exact_candidate_count: row.exact_candidate_count ?? 0,
    qualifications: (row.qualifications || []).map((entry) => ({
      candidate_locator: entry.candidate?.candidate_locator ?? null,
      discovery_method: entry.candidate?.discovery_method ?? null,
      qualification: summarizeQualification(entry.qualification),
    })),
    authority: result.authority,
  };
}

function buildEvaluationPayload({
  caseRow,
  policy,
  registry,
  directQualification,
  rediscoveryResult,
  resultKind,
  candidateLocator,
  qualificationDigest,
  qualifiedHistoricalSourceId = null,
  qualifiedExact = null,
  reason,
}) {
  return {
    contract: "trust-phase8i3-transport-drift-evaluation-v1",
    case_id: caseRow.case_id,
    case_key: caseRow.case_key,
    incident_kind: caseRow.incident_kind,
    route_hint: caseRow.route_hint,
    product_id: caseRow.product_id,
    subject_id: caseRow.subject_id,
    source_ids: caseRow.source_ids,
    incident_ids: caseRow.incident_ids,
    effective_locator: caseRow.effective_locator,
    confirmed_final_locator: caseRow.confirmed_final_locator,
    policy_key: policy?.policy_key ?? null,
    policy_version: registry.version,
    direct_qualification: summarizeQualification(directQualification),
    rediscovery: summarizeRediscovery(rediscoveryResult),
    result_kind: resultKind,
    candidate_locator: candidateLocator,
    qualification_digest: qualificationDigest,
    qualified_historical_source_id: qualifiedHistoricalSourceId,
    qualified_exact: summarizeQualification(qualifiedExact),
    reason,
    authority:
      resultKind === "READY_FOR_8I4"
        ? "CANDIDATE_ONLY_REQUIRES_8I4_GOVERNED_RELOCATION"
        : "NO_RELOCATION_OR_SEMANTIC_AUTHORITY",
  };
}

async function evaluateCase(caseRow, policy, registry, {
  observeCandidate,
  runRediscovery,
}) {
  if (!policy || !lineageMatches(caseRow, policy)) {
    const reason = !policy
      ? "POLICY_NOT_CONFIGURED"
      : "POLICY_LINEAGE_MISMATCH";
    return {
      resultKind: "POLICY_REQUIRED",
      evaluationMode:
        caseRow.incident_kind === "CONFIRMED_MISSING"
          ? "REDISCOVERY"
          : "REDIRECT_DIRECT",
      candidateLocator: null,
      qualificationDigest: null,
      networkUsed: false,
      payload: buildEvaluationPayload({
        caseRow,
        policy,
        registry,
        directQualification: null,
        rediscoveryResult: null,
        resultKind: "POLICY_REQUIRED",
        candidateLocator: null,
        qualificationDigest: null,
        reason,
      }),
    };
  }

  let directQualification = null;
  let rediscoveryResult = null;

  if (caseRow.incident_kind === "CONFIRMED_REDIRECT") {
    if (!caseRow.confirmed_final_locator) {
      throw new Error("TRUST_PHASE8I3_REDIRECT_FINAL_LOCATOR_MISSING");
    }

    const directInput = directQualificationInput(caseRow, policy);
    const observation = await observeCandidate(caseRow.confirmed_final_locator);
    directQualification = qualifyOfficialSourceIdentity({
      ...directInput,
      observation,
    });

    if (directQualification.disposition === "QUALIFIED_EXACT") {
      const payload = buildEvaluationPayload({
        caseRow,
        policy,
        registry,
        directQualification,
        rediscoveryResult: null,
        resultKind: "READY_FOR_8I4",
        candidateLocator: directQualification.candidate_locator,
        qualificationDigest: directQualification.qualification_digest,
        qualifiedHistoricalSourceId: qualifiedHistoricalSourceId(
          caseRow,
          directQualification,
        ),
        qualifiedExact: directQualification,
        reason: "DIRECT_REDIRECT_CANDIDATE_QUALIFIED_EXACT",
      });
      return {
        resultKind: "READY_FOR_8I4",
        evaluationMode: "REDIRECT_DIRECT",
        candidateLocator: directQualification.candidate_locator,
        qualificationDigest: directQualification.qualification_digest,
        networkUsed: true,
        payload,
      };
    }

    if (directQualification.disposition === "TRANSIENT_FAILURE") {
      return {
        resultKind: "RETRYABLE",
        evaluationMode: "REDIRECT_DIRECT",
        candidateLocator: null,
        qualificationDigest: null,
        networkUsed: true,
        payload: buildEvaluationPayload({
          caseRow,
          policy,
          registry,
          directQualification,
          rediscoveryResult: null,
          resultKind: "RETRYABLE",
          candidateLocator: null,
          qualificationDigest: null,
          reason: "DIRECT_QUALIFICATION_TRANSIENT",
        }),
      };
    }
  }

  rediscoveryResult = await runRediscovery(rediscoveryBatch(caseRow, policy));
  const exact = exactRediscoveryQualification(rediscoveryResult);

  if (exact) {
    const candidateLocator = exact.candidate.candidate_locator;
    const qualificationDigest = exact.qualification.qualification_digest;
    return {
      resultKind: "READY_FOR_8I4",
      evaluationMode: "REDISCOVERY",
      candidateLocator,
      qualificationDigest,
      networkUsed: true,
      payload: buildEvaluationPayload({
        caseRow,
        policy,
        registry,
        directQualification,
        rediscoveryResult,
        resultKind: "READY_FOR_8I4",
        candidateLocator,
        qualificationDigest,
        qualifiedHistoricalSourceId: qualifiedHistoricalSourceId(
          caseRow,
          exact.qualification,
        ),
        qualifiedExact: exact.qualification,
        reason: "REDISCOVERY_CANDIDATE_QUALIFIED_EXACT",
      }),
    };
  }

  if (rediscoveryRetryable(rediscoveryResult)) {
    return {
      resultKind: "RETRYABLE",
      evaluationMode: "REDISCOVERY",
      candidateLocator: null,
      qualificationDigest: null,
      networkUsed: true,
      payload: buildEvaluationPayload({
        caseRow,
        policy,
        registry,
        directQualification,
        rediscoveryResult,
        resultKind: "RETRYABLE",
        candidateLocator: null,
        qualificationDigest: null,
        reason: "REDISCOVERY_TRANSIENT",
      }),
    };
  }

  return {
    resultKind: "HOLD",
    evaluationMode: "REDISCOVERY",
    candidateLocator: null,
    qualificationDigest: null,
    networkUsed: true,
    payload: buildEvaluationPayload({
      caseRow,
      policy,
      registry,
      directQualification,
      rediscoveryResult,
      resultKind: "HOLD",
      candidateLocator: null,
      qualificationDigest: null,
      reason: "NO_QUALIFIED_EXACT_CANDIDATE",
    }),
  };
}

export async function runTransportDriftHandoff({
  client,
  registry,
  runId,
  limit = 100,
  record,
  now = () => new Date(),
  retryHours = null,
  observeCandidate = observeQualificationCandidate,
  runRediscovery = runRediscoveryQualificationBatch,
} = {}) {
  if (!client) throw new Error("client is required");
  validateRegistry(registry);
  if (!runId || !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)) {
    throw new Error("runId must be 1-120 safe characters");
  }
  if (typeof record !== "boolean") {
    throw new Error("record must be explicitly set to true or false");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("limit must be an integer between 1 and 1000");
  }

  const retryIntervalHours = Number(
    retryHours ?? registry.retry_interval_hours ?? 6,
  );
  if (
    !Number.isFinite(retryIntervalHours) ||
    retryIntervalHours <= 0 ||
    retryIntervalHours > 168
  ) {
    throw new Error("retryHours must be >0 and <=168");
  }

  const listed = await rpcOrThrow(
    client,
    "get_trust_official_source_transport_drift_cases_v1",
    { p_limit: limit },
  );
  const cases = Array.isArray(listed?.cases) ? listed.cases : [];
  const policies = policyMap(registry);
  const rows = [];
  let networkEvaluationCount = 0;
  let recordedCount = 0;
  let skippedCount = 0;
  const resultCounts = {};

  for (const caseRow of cases) {
    const policy = policies.get(
      `${caseRow.product_id}:${caseRow.subject_id}`,
    ) || null;
    const gate = latestEvaluationGate(
      caseRow,
      policy,
      registry,
      now(),
      retryIntervalHours,
    );

    if (!gate.evaluate) {
      skippedCount += 1;
      rows.push({
        case_id: caseRow.case_id,
        case_key: caseRow.case_key,
        status: "SKIPPED",
        skip_reason: gate.reason,
        latest_result_kind: caseRow.latest_evaluation?.result_kind ?? null,
      });
      continue;
    }

    const evaluation = await evaluateCase(caseRow, policy, registry, {
      observeCandidate,
      runRediscovery,
    });
    if (evaluation.networkUsed) networkEvaluationCount += 1;

    const inputDigest = stableDigest({
      contract: "trust-phase8i3-transport-drift-evaluation-input-v1",
      case: {
        case_id: caseRow.case_id,
        case_key: caseRow.case_key,
        case_digest: caseRow.case_digest,
        incident_kind: caseRow.incident_kind,
        product_id: caseRow.product_id,
        subject_id: caseRow.subject_id,
        source_ids: caseRow.source_ids,
        incident_ids: caseRow.incident_ids,
        effective_locator: caseRow.effective_locator,
        confirmed_final_locator: caseRow.confirmed_final_locator,
      },
      policy: policy ?? null,
      registry_version: registry.version,
    });
    const resultDigest = stableDigest(evaluation.payload);
    const requestId = `phase8i3:${runId}:${caseRow.case_id}`;
    const policyKey =
      policy?.policy_key ??
      `unconfigured:${caseRow.product_id}:${caseRow.subject_id}`;

    let recorderResult = null;
    if (record) {
      recorderResult = await rpcOrThrow(
        client,
        "record_trust_official_source_transport_drift_evaluation_v1",
        {
          p_request_id: requestId,
          p_case_id: caseRow.case_id,
          p_policy_key: policyKey,
          p_policy_version: registry.version,
          p_evaluation_mode: evaluation.evaluationMode,
          p_result_kind: evaluation.resultKind,
          p_candidate_locator: evaluation.candidateLocator,
          p_qualification_digest: evaluation.qualificationDigest,
          p_input_digest: inputDigest,
          p_result_digest: resultDigest,
          p_result_payload: evaluation.payload,
        },
      );
      recordedCount += 1;
    }

    resultCounts[evaluation.resultKind] =
      (resultCounts[evaluation.resultKind] || 0) + 1;
    rows.push({
      case_id: caseRow.case_id,
      case_key: caseRow.case_key,
      status: "EVALUATED",
      gate_reason: gate.reason,
      policy_key: policyKey,
      policy_version: registry.version,
      evaluation_mode: evaluation.evaluationMode,
      result_kind: evaluation.resultKind,
      candidate_locator: evaluation.candidateLocator,
      qualification_digest: evaluation.qualificationDigest,
      input_digest: inputDigest,
      result_digest: resultDigest,
      network_used: evaluation.networkUsed,
      recorder_result: recorderResult,
      result_payload: evaluation.payload,
    });
  }

  return {
    contract: HANDOFF_CONTRACT,
    run_id: runId,
    record,
    registry_contract: registry.contract,
    registry_version: registry.version,
    case_count: cases.length,
    evaluated_count: rows.filter((row) => row.status === "EVALUATED").length,
    skipped_count: skippedCount,
    network_evaluation_count: networkEvaluationCount,
    recorded_count: recordedCount,
    result_counts: resultCounts,
    rows,
    authority: "NO_AUTOMATIC_RELOCATION_OR_PRODUCT_FACT_MUTATION",
  };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const registryPath = argValue("registry");
  const runId = argValue("run-id");
  const record = parseBoolean(argValue("record"), "--record");
  const limit = Number(argValue("limit") || "100");
  const retryHoursRaw = argValue("retry-hours");
  const retryHours = retryHoursRaw === null ? null : Number(retryHoursRaw);

  if (!registryPath || !runId) {
    throw new Error(
      "Usage: node scripts/trust-transport-drift-handoff-worker.mjs --registry=<json> --run-id=<id> --record=true|false [--limit=100] [--retry-hours=6]",
    );
  }

  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await runTransportDriftHandoff({
    client,
    registry,
    runId,
    limit,
    record,
    retryHours,
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
