import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "analyze-no-write-boundary.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "analyze-no-write-boundary.md");

const FILES = {
  analyzeRoute: "app/api/analyze/route.js",
  functionalShadowCapture: "lib/functional-shadow-capture.js",
  decisionEngine: "lib/skin-match-decision-engine.js",
  productSource: "lib/product-source.js",
  analysisGuard: "lib/security/analysis-request-guard.js",
  premiumSession: "lib/premium-report-session.js",
  surveyAudit: "lib/survey-input-contract-dev-audit.js",
  devTargetRunner: "scripts/run-dev-target-scenario-captures.mjs"
};

function normalizePath(file) {
  return file.replace(/\\/g, "/");
}

function lineNumberFor(source, token) {
  const index = source.indexOf(token);
  if (index < 0) return null;
  return source.slice(0, index).split(/\r?\n/).length;
}

function sourceLocation(file, source, token, label, type = "unknown") {
  return {
    label,
    file: normalizePath(file),
    line: lineNumberFor(source, token),
    token,
    type
  };
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortDeep(item)])
    );
  }
  return value;
}

async function readSources() {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => [
      key,
      {
        file,
        source: await readFile(path.join(ROOT, file), "utf8")
      }
    ])
  );

  return Object.fromEntries(entries);
}

function buildPureAnalysisBoundary(sources) {
  const route = sources.analyzeRoute;
  const engine = sources.decisionEngine;
  const productSource = sources.productSource;

  return [
    {
      stage: "request_parse_and_validate",
      description: "Parses multipart form fields, validates required survey fields, and validates the uploaded file before building formInput.",
      locations: [
        sourceLocation(route.file, route.source, "const formData = await request.formData();", "form_data_parse", "route_parse"),
        sourceLocation(route.file, route.source, "const imageValidation = validateImageUpload(image);", "upload_validation", "route_validation"),
        sourceLocation(route.file, route.source, "const formInput = {", "form_input_normalization", "route_normalization")
      ]
    },
    {
      stage: "survey_contract_parallel_audit",
      description: "Builds the SurveyInputContract in development for audit visibility. The helper also has a local file append path, so it is not part of a strict no-write route.",
      locations: [
        sourceLocation(route.file, route.source, "logSurveyInputContractParallel(formInput", "contract_parallel_call", "local_dev_audit"),
        sourceLocation(sources.surveyAudit.file, sources.surveyAudit.source, "appendFileSync", "contract_audit_local_append", "local_file_write")
      ]
    },
    {
      stage: "photo_analysis_boundary",
      description: "Uses deterministic fallback when no model key is available, otherwise calls the remote model endpoint before recommendation generation.",
      locations: [
        sourceLocation(route.file, route.source, "let photoAnalysis = buildFallbackPhotoAnalysis(locale);", "fallback_photo_analysis", "pure_fallback"),
        sourceLocation(route.file, route.source, "extractPhotoAnalysis({", "optional_remote_photo_analysis", "remote_call")
      ]
    },
    {
      stage: "product_read_boundary",
      description: "Loads current product snapshots and recommendation products through product-source read paths.",
      locations: [
        sourceLocation(route.file, route.source, "fetchCurrentProductSnapshotsByIds(", "current_product_snapshot_read", "read_query"),
        sourceLocation(productSource.file, productSource.source, '.from("products")', "products_table_read_query", "read_query")
      ]
    },
    {
      stage: "base_recommendation_generation",
      description: "Calls the shared recommendation decision engine. When shadow capture is enabled, diagnostics include the existing candidate source boundary.",
      locations: [
        sourceLocation(route.file, route.source, "buildSkinMatchDecisionBundle(formInput", "decision_bundle_generation", "pure_recommendation_boundary"),
        sourceLocation(engine.file, engine.source, "buildExistingRecommendationCandidateSource", "candidate_source_diagnostics", "diagnostic_boundary")
      ]
    },
    {
      stage: "post_decision_public_payload",
      description: "Applies optional explanation text and then builds the existing public free decision payload.",
      locations: [
        sourceLocation(route.file, route.source, "generateProductExplanations({", "optional_remote_explanation", "remote_call"),
        sourceLocation(route.file, route.source, "const publicDecision = buildFreeDecisionPayload(decision);", "public_decision_payload", "response_payload_boundary")
      ]
    }
  ];
}

function buildMutationBoundary(sources) {
  const route = sources.analyzeRoute;
  const guard = sources.analysisGuard;
  const premium = sources.premiumSession;
  const surveyAudit = sources.surveyAudit;
  const capture = sources.functionalShadowCapture;

  const mutationCalls = [
    sourceLocation(route.file, route.source, "guardAnalysisRequest({", "analysis_guard_entered_before_recommendation_generation", "db_mutation_risk"),
    sourceLocation(guard.file, guard.source, 'rpc("claim_analysis_idempotency"', "idempotency_claim_rpc", "db_mutation"),
    sourceLocation(guard.file, guard.source, 'rpc("consume_analysis_rate_limits"', "rate_limit_consume_rpc", "db_mutation"),
    sourceLocation(guard.file, guard.source, 'rpc("complete_analysis_idempotency"', "idempotency_complete_rpc", "db_mutation"),
    sourceLocation(guard.file, guard.source, 'rpc("fail_analysis_idempotency"', "idempotency_fail_rpc", "db_mutation"),
    sourceLocation(route.file, route.source, "createPremiumReportSession({", "premium_report_store_call", "db_mutation_risk"),
    sourceLocation(premium.file, premium.source, ".insert({", "premium_report_store_insert", "db_mutation"),
    sourceLocation(premium.file, premium.source, ".delete()", "premium_report_store_prune_delete", "db_mutation"),
    sourceLocation(surveyAudit.file, surveyAudit.source, "appendFileSync", "survey_contract_local_audit_append", "local_file_write"),
    sourceLocation(capture.file, capture.source, "writeFile", "functional_shadow_fixture_write", "intended_local_capture_write")
  ].filter((item) => item.line !== null);

  return {
    summary: "The current route enters analysis guard mutation before recommendation generation, stores/prunes premium report state after public payload creation, completes guard state before capture, and writes local audit/capture artifacts in development.",
    mutationCalls,
    firstDbMutationBeforePureDecision: true,
    currentShadowCapturePosition: {
      description: "The current functional shadow capture call runs after premium report session storage and guard completion.",
      locations: [
        sourceLocation(route.file, route.source, "await captureFunctionalShadowIfEnabled({", "current_shadow_capture_call", "capture_after_mutation")
      ]
    }
  };
}

function buildCaptureInsertionCandidates(sources) {
  const route = sources.analyzeRoute;
  const engine = sources.decisionEngine;

  return [
    {
      id: "after_decision_before_premium_store",
      point: "Immediately after publicDecision is built and before premium report session storage.",
      locations: [
        sourceLocation(route.file, route.source, "const publicDecision = buildFreeDecisionPayload(decision);", "public_decision_ready", "candidate_capture_point"),
        sourceLocation(route.file, route.source, "const premiumReport = sanitizePremiumReport(decision.premiumReport);", "premium_store_starts_after_this", "mutation_boundary")
      ],
      advantages: [
        "Has formInput, public decision, full decision diagnostics, and candidate source.",
        "Avoids premium store write if the route can return or capture before that block in a dev-only mode."
      ],
      risks: [
        "Analysis guard mutation has already happened earlier in the current route.",
        "Still includes optional remote model calls unless separately controlled."
      ],
      changeScope: "medium route guardrail if implemented later",
      runtimeImpactPotential: "high if not strictly dev-only and response-isolated",
      recommendation: "use only after a separate dev-only no-write route design"
    },
    {
      id: "after_candidate_source_generation_inside_decision_engine",
      point: "Inside or immediately after buildSkinMatchDecisionBundle when candidate source diagnostics exist.",
      locations: [
        sourceLocation(engine.file, engine.source, "buildExistingRecommendationCandidateSource", "candidate_source_boundary", "candidate_source_point")
      ],
      advantages: [
        "Closest point to actual existing candidate source.",
        "Can preserve product_row completeness without waiting for response/premium store work."
      ],
      risks: [
        "Requires helper extraction or diagnostic return path review.",
        "May not include final public payload unless additional pure output is constructed."
      ],
      changeScope: "medium pure helper extraction if implemented later",
      runtimeImpactPotential: "low if kept script-only or helper-only",
      recommendation: "preferred for a pure replay runner"
    },
    {
      id: "route_external_pure_engine_replay",
      point: "A script builds formInput and invokes the pure decision engine with diagnostics, then calls the capture sanitizer.",
      locations: [
        sourceLocation(route.file, route.source, "buildSkinMatchDecisionBundle(formInput", "route_uses_same_engine", "replay_reference")
      ],
      advantages: [
        "Avoids route guard/session writes entirely.",
        "Does not change API behavior or response shape."
      ],
      risks: [
        "May diverge from the exact route if photo/explanation/session side effects matter.",
        "Needs clear fixture marking as replay-generated, not API-captured."
      ],
      changeScope: "low to medium script-only implementation",
      runtimeImpactPotential: "low",
      recommendation: "best next step for no-write evidence expansion"
    },
    {
      id: "isolated_dev_db_route_execution",
      point: "Run the current route unchanged against an isolated dev database where guard/session mutations are allowed.",
      locations: [
        sourceLocation(route.file, route.source, "guardAnalysisRequest({", "existing_route_guard_path", "existing_mutating_path")
      ],
      advantages: [
        "Highest parity with the existing route.",
        "No runtime code changes."
      ],
      risks: [
        "Requires isolated environment discipline.",
        "Still performs DB writes by design."
      ],
      changeScope: "environment/runbook only",
      runtimeImpactPotential: "low to production if environment isolation is strict",
      recommendation: "acceptable only with explicit isolated DB approval"
    }
  ];
}

function buildOptionsComparison() {
  return [
    {
      optionId: "option_1_dev_only_no_write_analyze_capture_mode",
      name: "No-write analyze capture mode",
      description: "Add an explicit development-only route flag that skips guard/session mutation blocks and writes only sanitized capture artifacts.",
      advantages: [
        "Can preserve the /api/analyze request contract.",
        "Can generate target scenario captures without DB mutation."
      ],
      risks: [
        "Touches the protected route and must not alter production behavior.",
        "Must prove response shape isolation and no accidental public exposure.",
        "Must decide how to handle guard response state, write tokens, premium report state, and optional remote model calls."
      ],
      guardrailsRequired: [
        "NODE_ENV=development",
        "explicit no-write env flag",
        "no API response field additions",
        "no production import side effects",
        "capture failure swallowed"
      ],
      recommendation: "not first; implement only as a separately approved route-boundary task"
    },
    {
      optionId: "option_2_pure_engine_replay_runner",
      name: "Pure engine replay runner",
      description: "Build a script-only runner that creates formInput, invokes the existing decision engine with candidate diagnostics, and writes sanitized shadow artifacts without route/session/guard writes.",
      advantages: [
        "Avoids DB mutation and API response changes.",
        "Lowest runtime risk.",
        "Can target the four scenario inputs quickly."
      ],
      risks: [
        "Not an exact /api/analyze request execution.",
        "Must document any route parity gaps such as analysis guard, premium session, and optional remote explanation text."
      ],
      guardrailsRequired: [
        "script-only output path",
        "explicit replay source marker",
        "same survey contract normalization where possible",
        "no synthetic product rows",
        "read-only product source only"
      ],
      recommendation: "recommended next step"
    },
    {
      optionId: "option_3_isolated_dev_db_write_allowed_capture",
      name: "Isolated dev DB write-allowed capture",
      description: "Run the existing route unchanged against an isolated development database where analysis guard and premium session mutations are allowed.",
      advantages: [
        "Highest route parity.",
        "No route code change."
      ],
      risks: [
        "Still performs writes.",
        "Requires strong environment separation and cleanup expectations.",
        "Not acceptable when a task forbids all DB/Supabase mutation."
      ],
      guardrailsRequired: [
        "explicit isolated DB approval",
        "no production credentials",
        "capture output sanitized",
        "response leak verification"
      ],
      recommendation: "valid operational path only after environment approval"
    }
  ];
}

function makeMarkdown(artifact) {
  const mutationRows = artifact.mutationCalls
    .map((item) => `| ${item.label} | ${item.file}:${item.line || "n/a"} | ${item.type} |`)
    .join("\n");
  const candidateRows = artifact.captureInsertionCandidates
    .map((item) => `| ${item.id} | ${item.changeScope} | ${item.runtimeImpactPotential} | ${item.recommendation} |`)
    .join("\n");
  const optionRows = artifact.optionsComparison
    .map((item) => `| ${item.optionId} | ${item.name} | ${item.recommendation} |`)
    .join("\n");

  return `# Analyze No-write Capture Boundary

This document is a write-boundary design note for analyze capture. It is not runtime policy approval.

## Phase 20 Skip Reason

Phase 20 stopped with \`capture_run_not_executed_db_mutating_guard_path\` because the current analyze route reaches guard/session mutation paths during a successful request.

## Pure Analysis Boundary

The route parses and validates request fields, builds \`formInput\`, optionally produces photo evidence, reads product data, calls \`buildSkinMatchDecisionBundle\`, and builds the public free decision payload.

## Mutation Boundary

| Call | Location | Type |
| --- | --- | --- |
${mutationRows}

## Capture Insertion Candidates

| Candidate | Change scope | Runtime impact potential | Recommendation |
| --- | --- | --- | --- |
${candidateRows}

## Option Comparison

| Option | Name | Recommendation |
| --- | --- | --- |
${optionRows}

## Recommended Next Step

${artifact.recommendedNextStep.summary}

Runtime mutation: ${artifact.runtimeMutation}
`;
}

export async function inspectAnalyzeNoWriteBoundary({ generatedAt = new Date().toISOString() } = {}) {
  const sources = await readSources();
  const filesInspected = Object.values(FILES).map(normalizePath).sort();
  const pureAnalysisBoundary = buildPureAnalysisBoundary(sources);
  const mutationBoundary = buildMutationBoundary(sources);
  const captureInsertionCandidates = buildCaptureInsertionCandidates(sources);
  const optionsComparison = buildOptionsComparison();

  return sortDeep({
    boundaryVersion: "analyze-no-write-capture-boundary-v1",
    generatedAt,
    filesInspected,
    pureAnalysisBoundary,
    mutationBoundary: {
      summary: mutationBoundary.summary,
      firstDbMutationBeforePureDecision: mutationBoundary.firstDbMutationBeforePureDecision,
      currentShadowCapturePosition: mutationBoundary.currentShadowCapturePosition
    },
    mutationCalls: mutationBoundary.mutationCalls,
    captureInsertionCandidates,
    optionsComparison,
    recommendedNextStep: {
      optionId: "option_2_pure_engine_replay_runner",
      summary: "Implement a script-only pure engine replay runner first, using existing product reads and candidate source diagnostics, while documenting route parity gaps. Use route-level no-write mode only as a separate approved task.",
      reason: "The current route mutates analysis guard/session state before and after recommendation generation, while a script-only runner can expand candidate evidence without API response or DB mutation risk."
    },
    limitations: [
      "Static source inspection only; no /api/analyze request was sent.",
      "No DB or remote mutation was executed.",
      "Source text can identify mutation boundaries but cannot prove runtime environment isolation.",
      "Optional remote model calls are outside the DB write boundary but still need separate execution policy.",
      "Product reads are read-only in this analysis but may depend on environment configuration."
    ],
    runtimeMutation: false
  });
}

async function main() {
  const artifact = await inspectAnalyzeNoWriteBoundary();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await writeFile(MD_OUTPUT, makeMarkdown(artifact), "utf8");

  console.log("analyze no-write boundary inspection complete");
  console.log(`files inspected: ${artifact.filesInspected.length}`);
  console.log(`mutation calls: ${artifact.mutationCalls.length}`);
  console.log(`capture insertion candidates: ${artifact.captureInsertionCandidates.length}`);
  console.log(`recommended next step: ${artifact.recommendedNextStep.optionId}`);
  console.log(`wrote ${JSON_OUTPUT}`);
  console.log(`wrote ${MD_OUTPUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
