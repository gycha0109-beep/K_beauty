import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERIFIER_PATH = "scripts/verify-sec12-error-log-boundary.mjs";
const FINAL_PASS_MARKER = "SEC12_ERROR_LOG_BOUNDARY=PASS";
const EXPECTED_MUTATION_COUNT = 37;
const REQUIRED_MUTATION_IDS = Object.freeze([
  "M01_PUBLIC_RAW_MESSAGE",
  "M02_PUBLIC_RAW_STACK",
  "M03_PUBLIC_RAW_DETAILS",
  "M04_PUBLIC_RAW_HINT",
  "M05_PUBLIC_DATABASE_CODE",
  "M06_TRACK_RAW_CONSOLE_ERROR",
  "M07_TRACK_RAW_REQUEST_BODY",
  "M08_TRACK_AUTHORIZATION_LOG",
  "M09_TRACK_COOKIE_LOG",
  "M10_PROVIDER_PROMPT_RETENTION",
  "M11_PROVIDER_RESPONSE_RETENTION",
  "M12_SUPABASE_RAW_OBJECT_LOG",
  "M13_NESTED_CAUSE_ACCESS",
  "M14_LOG_PAYLOAD_CAP_REMOVED",
  "M15_CRLF_NORMALIZATION_REMOVED",
  "M16_ANSI_NORMALIZATION_REMOVED",
  "M17_HOSTILE_GETTER_GUARD_REMOVED",
  "M18_NONPRODUCTION_RAW_POLICY",
  "M19_REQUIRED_CASE_REMOVED",
  "M20_REQUIRED_CASE_DUPLICATED",
  "M21_UNKNOWN_REQUIRED_CASE",
  "M22_EXPECTED_COUNT_MISMATCH",
  "M23_MANIFEST_CASE_UNOBSERVED",
  "M24_TRACK_SANITIZER_BYPASS",
  "M25_SAVE_REPORT_SANITIZER_BYPASS",
  "M26_AUTH_CALLBACK_SANITIZER_BYPASS",
  "M27_PROVIDER_CENTRAL_SANITIZER_BYPASS",
  "M28_CLIENT_RAW_ERROR_RENDERING",
  "M29_MODEL_REGISTRY_FAIL_OPEN",
  "M30_ANALYZE_STAGE_SEMANTICS_REGRESSION",
  "M31_CACHE_CONTROL_OMITTED",
  "M32_CDN_CACHE_CONTROL_OMITTED",
  "M33_VERCEL_CDN_CACHE_CONTROL_OMITTED",
  "M34_ALL_NO_STORE_HEADERS_OMITTED",
  "M35_I10_DEAD_HELPER_RESPONSE_BYPASS",
  "M36_I10_CLASS_STATIC_RESPONSE_OVERWRITE",
  "M37_I10_FULL_REPORT_TERMINAL_SET_DRIFT"
]);
const SNAPSHOT_PATHS = Object.freeze([
  "app",
  "components",
  "lib",
  VERIFIER_PATH,
  "package.json"
]);

function replaceOnce(source, search, replacement, caseId) {
  const firstIndex = source.indexOf(search);
  assert.notEqual(firstIndex, -1, `${caseId}: mutation anchor missing`);
  assert.equal(source.indexOf(search, firstIndex + search.length), -1, `${caseId}: mutation anchor is ambiguous`);
  return `${source.slice(0, firstIndex)}${replacement}${source.slice(firstIndex + search.length)}`;
}

function replaceFirst(source, search, replacement, caseId) {
  const firstIndex = source.indexOf(search);
  assert.notEqual(firstIndex, -1, `${caseId}: mutation anchor missing`);
  return `${source.slice(0, firstIndex)}${replacement}${source.slice(firstIndex + search.length)}`;
}

async function mutateFile(workspace, relativePath, caseId, transform) {
  const target = path.join(workspace, relativePath);
  const source = (await readFile(target, "utf8")).replace(/\r\n/g, "\n");
  const mutated = transform(source);
  assert.notEqual(mutated, source, `${caseId}: mutation produced no change`);
  await writeFile(target, mutated, "utf8");
}

function injectPublicErrorField(source, field, caseId) {
  const anchor = "\n  return Object.freeze(payload);\n}\n\nexport function getSafePublicErrorMessage";
  return replaceOnce(
    source,
    anchor,
    `\n  const raw${field[0].toUpperCase()}${field.slice(1)} = readValue(options, "${field}");\n  if (raw${field[0].toUpperCase()}${field.slice(1)} !== undefined) payload.${field} = raw${field[0].toUpperCase()}${field.slice(1)};\n  return Object.freeze(payload);\n}\n\nexport function getSafePublicErrorMessage`,
    caseId
  );
}

function appendUnsafeLoggerCall(source, field) {
  return `${source}\nwriteSafeLog("error", {\n  event: "client_operation_failed",\n  ${field}\n});\n`;
}

const mutationCases = Object.freeze([
  Object.freeze({
    id: "M01_PUBLIC_RAW_MESSAGE",
    expectedLastPass: "S18_PROVIDER_BODY",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M01_PUBLIC_RAW_MESSAGE", (source) =>
      replaceOnce(
        source,
        "  if (includeMessage) {\n    payload.message = PUBLIC_ERROR_MESSAGES[safeCode];\n  }",
        "  if (includeMessage) {\n    payload.message = readValue(options, \"message\");\n  }",
        "M01_PUBLIC_RAW_MESSAGE"
      ))
  }),
  Object.freeze({
    id: "M02_PUBLIC_RAW_STACK",
    expectedLastPass: "P01_RAW_MESSAGE_REMOVED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M02_PUBLIC_RAW_STACK", (source) =>
      injectPublicErrorField(source, "stack", "M02_PUBLIC_RAW_STACK"))
  }),
  Object.freeze({
    id: "M03_PUBLIC_RAW_DETAILS",
    expectedLastPass: "P02_STACK_REMOVED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M03_PUBLIC_RAW_DETAILS", (source) =>
      injectPublicErrorField(source, "details", "M03_PUBLIC_RAW_DETAILS"))
  }),
  Object.freeze({
    id: "M04_PUBLIC_RAW_HINT",
    expectedLastPass: "P03_DETAILS_REMOVED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M04_PUBLIC_RAW_HINT", (source) =>
      injectPublicErrorField(source, "hint", "M04_PUBLIC_RAW_HINT"))
  }),
  Object.freeze({
    id: "M05_PUBLIC_DATABASE_CODE",
    expectedLastPass: "P04_HINT_REMOVED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M05_PUBLIC_DATABASE_CODE", (source) =>
      injectPublicErrorField(source, "databaseCode", "M05_PUBLIC_DATABASE_CODE"))
  }),
  Object.freeze({
    id: "M06_TRACK_RAW_CONSOLE_ERROR",
    expectedLastPass: "I01_TRACK_PUBLIC_RESPONSE",
    apply: (workspace) => mutateFile(workspace, "app/api/track/route.js", "M06_TRACK_RAW_CONSOLE_ERROR", (source) =>
      `${source}\nconsole.error(error);\n`)
  }),
  Object.freeze({
    id: "M07_TRACK_RAW_REQUEST_BODY",
    expectedLastPass: "I01_TRACK_PUBLIC_RESPONSE",
    apply: (workspace) => mutateFile(workspace, "app/api/track/route.js", "M07_TRACK_RAW_REQUEST_BODY", (source) =>
      appendUnsafeLoggerCall(source, "body: request"))
  }),
  Object.freeze({
    id: "M08_TRACK_AUTHORIZATION_LOG",
    expectedLastPass: "I01_TRACK_PUBLIC_RESPONSE",
    apply: (workspace) => mutateFile(workspace, "app/api/track/route.js", "M08_TRACK_AUTHORIZATION_LOG", (source) =>
      appendUnsafeLoggerCall(source, "authorization: request.headers.get(\"authorization\")"))
  }),
  Object.freeze({
    id: "M09_TRACK_COOKIE_LOG",
    expectedLastPass: "I01_TRACK_PUBLIC_RESPONSE",
    apply: (workspace) => mutateFile(workspace, "app/api/track/route.js", "M09_TRACK_COOKIE_LOG", (source) =>
      appendUnsafeLoggerCall(source, "cookie: request.headers.get(\"cookie\")"))
  }),
  Object.freeze({
    id: "M10_PROVIDER_PROMPT_RETENTION",
    expectedLastPass: "I05_AUTH_CALLBACK_SAFE_LOG",
    apply: (workspace) => mutateFile(workspace, "lib/provider-runtime-log.js", "M10_PROVIDER_PROMPT_RETENTION", (source) => {
      let mutated = replaceOnce(source, "  model,\n  durationMs,", "  model,\n  prompt,\n  durationMs,", "M10_PROVIDER_PROMPT_RETENTION");
      mutated = replaceOnce(mutated, "    model: safeEvent.model || \"unknown\",\n    durationMs:", "    model: safeEvent.model || \"unknown\",\n    prompt,\n    durationMs:", "M10_PROVIDER_PROMPT_RETENTION");
      return mutated;
    })
  }),
  Object.freeze({
    id: "M11_PROVIDER_RESPONSE_RETENTION",
    expectedLastPass: "I05_AUTH_CALLBACK_SAFE_LOG",
    apply: (workspace) => mutateFile(workspace, "lib/provider-runtime-log.js", "M11_PROVIDER_RESPONSE_RETENTION", (source) => {
      let mutated = replaceOnce(source, "  model,\n  durationMs,", "  model,\n  responseBody,\n  durationMs,", "M11_PROVIDER_RESPONSE_RETENTION");
      mutated = replaceOnce(mutated, "    model: safeEvent.model || \"unknown\",\n    durationMs:", "    model: safeEvent.model || \"unknown\",\n    responseBody,\n    durationMs:", "M11_PROVIDER_RESPONSE_RETENTION");
      return mutated;
    })
  }),
  Object.freeze({
    id: "M12_SUPABASE_RAW_OBJECT_LOG",
    expectedLastPass: "I06_PROVIDER_ADAPTER_DELEGATION",
    apply: (workspace) => mutateFile(workspace, "lib/supabase/server-client.js", "M12_SUPABASE_RAW_OBJECT_LOG", (source) =>
      appendUnsafeLoggerCall(source, "error,"))
  }),
  Object.freeze({
    id: "M13_NESTED_CAUSE_ACCESS",
    expectedLastPass: "C08_HOSTILE_TOJSON",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M13_NESTED_CAUSE_ACCESS", (source) =>
      replaceOnce(source, "  void error;\n  return allowlistedValue", "  void readValue(error, \"cause\");\n  return allowlistedValue", "M13_NESTED_CAUSE_ACCESS"))
  }),
  Object.freeze({
    id: "M14_LOG_PAYLOAD_CAP_REMOVED",
    expectedLastPass: "L07_CONTROL_NEUTRALIZED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M14_LOG_PAYLOAD_CAP_REMOVED", (source) =>
      replaceOnce(source, "const MAX_LOG_PAYLOAD_BYTES = 1024;", "const MAX_LOG_PAYLOAD_BYTES = 1048576;", "M14_LOG_PAYLOAD_CAP_REMOVED"))
  }),
  Object.freeze({
    id: "M15_CRLF_NORMALIZATION_REMOVED",
    expectedLastPass: "L04_CAUSE_DISCARDED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M15_CRLF_NORMALIZATION_REMOVED", (source) => {
      const withoutCrLfControlCoverage = replaceOnce(
        source,
        "const CONTROL_CHARACTER_PATTERN = /[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]/g;",
        "const CONTROL_CHARACTER_PATTERN = /[\\u0000-\\u0009\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f\\u2028\\u2029]/g;",
        "M15_CRLF_NORMALIZATION_REMOVED"
      );
      return replaceOnce(
        withoutCrLfControlCoverage,
        "    .replace(/\\s+/g, \" \")",
        "    .replace(/[ \\t\\f\\v]+/g, \" \")",
        "M15_CRLF_NORMALIZATION_REMOVED"
      );
    })
  }),
  Object.freeze({
    id: "M16_ANSI_NORMALIZATION_REMOVED",
    expectedLastPass: "L05_CRLF_NEUTRALIZED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M16_ANSI_NORMALIZATION_REMOVED", (source) =>
      replaceOnce(source, "    .replace(ANSI_ESCAPE_PATTERN, \" \")\n", "", "M16_ANSI_NORMALIZATION_REMOVED"))
  }),
  Object.freeze({
    id: "M17_HOSTILE_GETTER_GUARD_REMOVED",
    expectedLastPass: "C06_CIRCULAR_OBJECT",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M17_HOSTILE_GETTER_GUARD_REMOVED", (source) =>
      replaceOnce(
        source,
        "  void error;\n  return allowlistedValue",
        "  if (error && typeof error === \"object\") void error.message;\n  return allowlistedValue",
        "M17_HOSTILE_GETTER_GUARD_REMOVED"
      ))
  }),
  Object.freeze({
    id: "M18_NONPRODUCTION_RAW_POLICY",
    expectedLastPass: "S16_LARGE_BASE64",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M18_NONPRODUCTION_RAW_POLICY", (source) =>
      replaceOnce(
        source,
        "  if (typeof modelValue === \"string\" && SAFE_PROVIDER_MODEL_SET.has(modelValue)) {",
        "  if (process.env.NODE_ENV !== \"production\") payload.prompt = readValue(input, \"prompt\");\n  if (typeof modelValue === \"string\" && SAFE_PROVIDER_MODEL_SET.has(modelValue)) {",
        "M18_NONPRODUCTION_RAW_POLICY"
      ))
  }),
  Object.freeze({
    id: "M19_REQUIRED_CASE_REMOVED",
    expectedLastPass: null,
    apply: (workspace) => mutateFile(workspace, VERIFIER_PATH, "M19_REQUIRED_CASE_REMOVED", (source) =>
      replaceOnce(source, "  \"C01_ERROR_INSTANCE\",\n", "", "M19_REQUIRED_CASE_REMOVED"))
  }),
  Object.freeze({
    id: "M20_REQUIRED_CASE_DUPLICATED",
    expectedLastPass: null,
    apply: (workspace) => mutateFile(workspace, VERIFIER_PATH, "M20_REQUIRED_CASE_DUPLICATED", (source) =>
      replaceOnce(source, "  \"C01_ERROR_INSTANCE\",\n", "  \"C01_ERROR_INSTANCE\",\n  \"C01_ERROR_INSTANCE\",\n", "M20_REQUIRED_CASE_DUPLICATED"))
  }),
  Object.freeze({
    id: "M21_UNKNOWN_REQUIRED_CASE",
    expectedLastPass: null,
    apply: (workspace) => mutateFile(workspace, VERIFIER_PATH, "M21_UNKNOWN_REQUIRED_CASE", (source) =>
      replaceOnce(source, "  \"C01_ERROR_INSTANCE\",\n", "  \"C00_UNKNOWN_CASE\",\n", "M21_UNKNOWN_REQUIRED_CASE"))
  }),
  Object.freeze({
    id: "M22_EXPECTED_COUNT_MISMATCH",
    expectedLastPass: null,
    apply: (workspace) => mutateFile(workspace, VERIFIER_PATH, "M22_EXPECTED_COUNT_MISMATCH", (source) =>
      replaceOnce(source, "export const EXPECTED_REQUIRED_CASE_COUNT = 62;", "export const EXPECTED_REQUIRED_CASE_COUNT = 61;", "M22_EXPECTED_COUNT_MISMATCH"))
  }),
  Object.freeze({
    id: "M23_MANIFEST_CASE_UNOBSERVED",
    expectedLastPass: "I09_CLIENT_CONSOLE_BOUNDARY",
    apply: (workspace) => mutateFile(workspace, VERIFIER_PATH, "M23_MANIFEST_CASE_UNOBSERVED", (source) =>
      replaceOnce(
        source,
        "for (const id of REQUIRED_CASE_IDS) {\n  assert.equal(observed.has(id), false, `SEC-12 case executed more than once: ${id}`);",
        "for (const id of REQUIRED_CASE_IDS) {\n  if (id === \"I10_SENSITIVE_ROUTE_NO_STORE\") continue;\n  assert.equal(observed.has(id), false, `SEC-12 case executed more than once: ${id}`);",
        "M23_MANIFEST_CASE_UNOBSERVED"
      ))
  }),
  Object.freeze({
    id: "M24_TRACK_SANITIZER_BYPASS",
    expectedLastPass: "I01_TRACK_PUBLIC_RESPONSE",
    apply: (workspace) => mutateFile(workspace, "app/api/track/route.js", "M24_TRACK_SANITIZER_BYPASS", (source) =>
      replaceFirst(source, "writeSafeLog(", "unsafeLog(", "M24_TRACK_SANITIZER_BYPASS"))
  }),
  Object.freeze({
    id: "M25_SAVE_REPORT_SANITIZER_BYPASS",
    expectedLastPass: "I03_SAVE_REPORT_PUBLIC_RESPONSE",
    apply: (workspace) => mutateFile(workspace, "app/api/my/save-report/route.js", "M25_SAVE_REPORT_SANITIZER_BYPASS", (source) =>
      replaceFirst(source, "writeSafeLog(", "unsafeLog(", "M25_SAVE_REPORT_SANITIZER_BYPASS"))
  }),
  Object.freeze({
    id: "M26_AUTH_CALLBACK_SANITIZER_BYPASS",
    expectedLastPass: "I04_SAVE_REPORT_SAFE_LOG",
    apply: (workspace) => mutateFile(workspace, "app/auth/callback/route.js", "M26_AUTH_CALLBACK_SANITIZER_BYPASS", (source) =>
      replaceFirst(source, "writeSafeLog(", "unsafeLog(", "M26_AUTH_CALLBACK_SANITIZER_BYPASS"))
  }),
  Object.freeze({
    id: "M27_PROVIDER_CENTRAL_SANITIZER_BYPASS",
    expectedLastPass: "L12_SINK_FAILURE_ISOLATED",
    apply: (workspace) => mutateFile(workspace, "lib/provider-runtime-log.js", "M27_PROVIDER_CENTRAL_SANITIZER_BYPASS", (source) =>
      replaceOnce(
        source,
        "  writeSafeLog(payload.ok ? \"info\" : \"warn\", {\n    event: \"provider_runtime\",\n    category:",
        "  sink.warn(payload.ok ? \"info\" : \"warn\", {\n    event: \"provider_runtime\",\n    prompt: event.prompt,\n    category:",
        "M27_PROVIDER_CENTRAL_SANITIZER_BYPASS"
      ))
  }),
  Object.freeze({
    id: "M28_CLIENT_RAW_ERROR_RENDERING",
    expectedLastPass: "I07_SUPABASE_HELPERS_SAFE_LOG",
    apply: (workspace) => mutateFile(workspace, "components/result/SaveReportCTA.jsx", "M28_CLIENT_RAW_ERROR_RENDERING", (source) =>
      `${source}\nconst sec12RawClientError = data?.message || data?.error;\nvoid sec12RawClientError;\n`)
  }),
  Object.freeze({
    id: "M29_MODEL_REGISTRY_FAIL_OPEN",
    expectedLastPass: "L12_SINK_FAILURE_ISOLATED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M29_MODEL_REGISTRY_FAIL_OPEN", (source) =>
      replaceOnce(source, "SAFE_PROVIDER_MODEL_SET.has(modelValue)", "modelValue.length <= 96", "M29_MODEL_REGISTRY_FAIL_OPEN"))
  }),
  Object.freeze({
    id: "M30_ANALYZE_STAGE_SEMANTICS_REGRESSION",
    expectedLastPass: "M01_STRUCTURED_LOG_MODEL_CREDENTIAL_REJECTED",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M30_ANALYZE_STAGE_SEMANTICS_REGRESSION", (source) =>
      replaceOnce(
        source,
        "    stage: \"openai-env:diagnostic\",\n    event: \"analysis_diagnostic\",",
        "    stage: \"openai-env:diagnostic\",\n    event: \"analysis_failed\",",
        "M30_ANALYZE_STAGE_SEMANTICS_REGRESSION"
      ))
  }),
  Object.freeze({
    id: "M31_CACHE_CONTROL_OMITTED",
    expectedLastPass: "P08_EXISTING_HEADER_PRESERVATION",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M31_CACHE_CONTROL_OMITTED", (source) =>
      replaceOnce(source, "  \"Cache-Control\": \"private, no-store, max-age=0\",\n", "", "M31_CACHE_CONTROL_OMITTED"))
  }),
  Object.freeze({
    id: "M32_CDN_CACHE_CONTROL_OMITTED",
    expectedLastPass: "P08_EXISTING_HEADER_PRESERVATION",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M32_CDN_CACHE_CONTROL_OMITTED", (source) =>
      replaceOnce(source, "  \"CDN-Cache-Control\": \"no-store\",\n", "", "M32_CDN_CACHE_CONTROL_OMITTED"))
  }),
  Object.freeze({
    id: "M33_VERCEL_CDN_CACHE_CONTROL_OMITTED",
    expectedLastPass: "P08_EXISTING_HEADER_PRESERVATION",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M33_VERCEL_CDN_CACHE_CONTROL_OMITTED", (source) =>
      replaceOnce(source, "  \"Vercel-CDN-Cache-Control\": \"no-store\"\n", "", "M33_VERCEL_CDN_CACHE_CONTROL_OMITTED"))
  }),
  Object.freeze({
    id: "M34_ALL_NO_STORE_HEADERS_OMITTED",
    expectedLastPass: "P08_EXISTING_HEADER_PRESERVATION",
    apply: (workspace) => mutateFile(workspace, "lib/security/error-redaction.js", "M34_ALL_NO_STORE_HEADERS_OMITTED", (source) => {
      let mutated = replaceOnce(source, "  \"Cache-Control\": \"private, no-store, max-age=0\",\n", "", "M34_ALL_NO_STORE_HEADERS_OMITTED");
      mutated = replaceOnce(mutated, "  \"CDN-Cache-Control\": \"no-store\",\n", "", "M34_ALL_NO_STORE_HEADERS_OMITTED");
      mutated = replaceOnce(mutated, "  \"Vercel-CDN-Cache-Control\": \"no-store\"\n", "", "M34_ALL_NO_STORE_HEADERS_OMITTED");
      return mutated;
    })
  }),
  Object.freeze({
    id: "M35_I10_DEAD_HELPER_RESPONSE_BYPASS",
    expectedLastPass: "I09_CLIENT_CONSOLE_BOUNDARY",
    apply: (workspace) => mutateFile(workspace, "app/api/track/route.js", "M35_I10_DEAD_HELPER_RESPONSE_BYPASS", (source) =>
      replaceOnce(
        source,
        "export async function POST(request) {\n",
        "export async function POST(request) {\n  createNoStoreHeaders();\n  return NextResponse.json({});\n",
        "M35_I10_DEAD_HELPER_RESPONSE_BYPASS"
      ))
  }),
  Object.freeze({
    id: "M36_I10_CLASS_STATIC_RESPONSE_OVERWRITE",
    expectedLastPass: "I09_CLIENT_CONSOLE_BOUNDARY",
    apply: (workspace) => mutateFile(workspace, "app/api/track/route.js", "M36_I10_CLASS_STATIC_RESPONSE_OVERWRITE", (source) =>
      replaceOnce(
        source,
        "export async function POST(request) {\n",
        "export async function POST(request) {\n  let sec12MutationResponse = NextResponse.json({}, { headers: createNoStoreHeaders() });\n  class Sec12StaticOverwrite {\n    static {\n      sec12MutationResponse = NextResponse.json({});\n    }\n  }\n  return sec12MutationResponse;\n",
        "M36_I10_CLASS_STATIC_RESPONSE_OVERWRITE"
      ))
  }),
  Object.freeze({
    id: "M37_I10_FULL_REPORT_TERMINAL_SET_DRIFT",
    expectedLastPass: "I09_CLIENT_CONSOLE_BOUNDARY",
    apply: (workspace) => mutateFile(workspace, "app/api/full-report/route.js", "M37_I10_FULL_REPORT_TERMINAL_SET_DRIFT", (source) =>
      replaceFirst(
        source,
        "return getStorageUnavailableResponse();",
        "return getUnauthorizedResponse(\"login_required\");",
        "M37_I10_FULL_REPORT_TERMINAL_SET_DRIFT"
      ))
  })
]);

function assertAuthoritativeVerifierContract(source) {
  const requiredFragments = [
    "const { parse: parseJavaScript }",
    "assert.fail(`SEC-12 AST parse failed: ${path}`)",
    "assertNoUnsupportedClassSyntax(expression, \"expression\")",
    "failUnsupportedAstNode(statement, \"statement\")",
    "\"ClassDeclaration\"",
    "\"ClassExpression\"",
    "class Sec12StaticOverwrite",
    "createNoStoreHeaders(); ${unsafeResponse}",
    "headers = unsafeHeaders",
    "const wrappers = { safe()",
    "const alias = handler",
    "return wrappers.safe()",
    "metadata: createNoStoreHeaders()",
    "EXPECTED_SENSITIVE_NO_STORE_HEADER_COUNT = 3",
    "assertNoStoreNegativeMatrix();",
    "assertSensitiveRouteIntegrationExactSet"
  ];

  for (const fragment of requiredFragments) {
    assert.ok(source.includes(fragment), `SEC-12 authoritative verifier contract missing: ${fragment}`);
  }

  const parseFailureBody = source.match(/function parseSourceModule\([\s\S]*?\n}\n\nfunction isFunctionNode/);
  assert.ok(parseFailureBody, "SEC-12 parser failure contract missing");
  assert.doesNotMatch(parseFailureBody[0], /regex|lexical|source\.includes/i, "SEC-12 parser failure must not fall back");
}

async function createSnapshot(destination) {
  await mkdir(destination, { recursive: true });
  for (const relativePath of SNAPSHOT_PATHS) {
    const source = path.join(REPOSITORY_ROOT, relativePath);
    const target = path.join(destination, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }
}

function runVerifier(workspace) {
  return spawnSync(process.execPath, [VERIFIER_PATH], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      NODE_NO_WARNINGS: "1",
      NODE_PATH: path.join(REPOSITORY_ROOT, "node_modules")
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60_000,
    windowsHide: true
  });
}

function passedCaseIds(stdout) {
  return [...String(stdout).matchAll(/\{"caseId":"([^"]+)","status":"PASS"\}/g)].map((match) => match[1]);
}

function assertBaseline(result) {
  assert.equal(result.error, undefined, "SEC-12 baseline verifier could not start");
  assert.equal(result.signal, null, "SEC-12 baseline verifier was terminated");
  assert.equal(result.status, 0, "SEC-12 baseline verifier must pass");
  assert.equal(String(result.stdout).includes("SEC12_ERROR_LOG_BOUNDARY=PASS 62/62"), true);
  assert.equal(String(result.stderr).includes(FINAL_PASS_MARKER), false);

  const i10Line = String(result.stdout).split(/\r?\n/).find((line) => line.startsWith('{"sec12I10":'));
  assert.ok(i10Line, "SEC-12 baseline I10 summary missing");
  const { sec12I10 } = JSON.parse(i10Line);
  assert.deepEqual(sec12I10.routes, { discovered: 11, expected: 11, verified: 11 });
  assert.deepEqual(sec12I10.handlerBindings, { discovered: 12, expected: 12, verified: 12 });
  assert.deepEqual(sec12I10.terminalResponsePaths, { discovered: 125, expected: 125, verified: 125 });
  assert.deepEqual(sec12I10.pureMatrix, { positive: 2, negative: 17, rejected: 17 });
  assert.equal(sec12I10.deadHelperCalls, 0);
  assert.equal(sec12I10.unsafeResponsePaths, 0);
  assert.equal(sec12I10.unresolvedResponsePaths, 0);
}

function assertRejectedMutation(testCase, result) {
  assert.equal(result.error, undefined, `${testCase.id}: verifier could not start`);
  assert.equal(result.signal, null, `${testCase.id}: verifier was terminated`);
  assert.equal(result.status, 1, `${testCase.id}: verifier exit must be exactly 1`);
  assert.equal(String(result.stdout).includes(FINAL_PASS_MARKER), false, `${testCase.id}: stdout contains final PASS marker`);
  assert.equal(String(result.stderr).includes(FINAL_PASS_MARKER), false, `${testCase.id}: stderr contains final PASS marker`);
  assert.ok(String(result.stderr).length > 0, `${testCase.id}: verifier stderr must contain the rejection`);

  const observedPasses = passedCaseIds(result.stdout);
  const lastPass = observedPasses.at(-1) || null;
  assert.equal(lastPass, testCase.expectedLastPass, `${testCase.id}: verifier failed at an unexpected contract boundary`);
}

function assertDeterministicRejection(testCase, firstResult, secondResult) {
  assert.equal(secondResult.status, firstResult.status, `${testCase.id}: verifier exit is nondeterministic`);
  assert.equal(secondResult.signal, firstResult.signal, `${testCase.id}: verifier signal is nondeterministic`);
  assert.equal(secondResult.stdout, firstResult.stdout, `${testCase.id}: verifier stdout is nondeterministic`);
  assert.equal(secondResult.stderr, firstResult.stderr, `${testCase.id}: verifier stderr is nondeterministic`);
}

assert.equal(mutationCases.length, EXPECTED_MUTATION_COUNT);
assert.equal(new Set(mutationCases.map(({ id }) => id)).size, EXPECTED_MUTATION_COUNT);
assert.equal(Object.isFrozen(mutationCases), true);
assert.equal(Object.isFrozen(REQUIRED_MUTATION_IDS), true);
assert.deepEqual(mutationCases.map(({ id }) => id), [...REQUIRED_MUTATION_IDS]);

const verifierSource = (await readFile(path.join(REPOSITORY_ROOT, VERIFIER_PATH), "utf8")).replace(/\r\n/g, "\n");
assertAuthoritativeVerifierContract(verifierSource);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kbeauty-sec12-mutations-"));
const baselineRoot = path.join(tempRoot, "baseline");

try {
  await createSnapshot(baselineRoot);
  assertBaseline(runVerifier(baselineRoot));
  console.log("SEC12_MUTATION_BASELINE=PASS 62/62");

  let rejected = 0;
  for (const testCase of mutationCases) {
    const workspace = path.join(tempRoot, "case");
    await rm(workspace, { recursive: true, force: true });
    await cp(baselineRoot, workspace, { recursive: true });
    await testCase.apply(workspace);
    const result = runVerifier(workspace);
    assertRejectedMutation(testCase, result);
    const repeatedResult = runVerifier(workspace);
    assertRejectedMutation(testCase, repeatedResult);
    assertDeterministicRejection(testCase, result, repeatedResult);
    rejected += 1;
    console.log(JSON.stringify({ caseId: testCase.id, status: "REJECTED", exitCode: result.status }));
  }

  assert.equal(rejected, EXPECTED_MUTATION_COUNT);
  console.log(`SEC12_MUTATIONS=${rejected}/${EXPECTED_MUTATION_COUNT} rejected`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
