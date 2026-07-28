import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  ANALYZE_LOG_STAGE_POLICIES,
  PUBLIC_ERROR_CODES,
  SAFE_PROVIDER_MODELS,
  SENSITIVE_NO_STORE_HEADERS,
  classifyUnknownError,
  createAnalyzeLogEvent,
  createNoStoreHeaders,
  createPublicError,
  createSafeLogEvent,
  getErrorRedactionContract,
  sanitizeLogText,
  writeSafeLog
} from "../lib/security/error-redaction.js";
import {
  buildProviderRuntimeLogEvent,
  logProviderRuntimeEvent
} from "../lib/provider-runtime-log.js";

const require = createRequire(import.meta.url);
const { parse: parseJavaScript } = require("next/dist/compiled/babel/parser");

class UnsupportedAstNodeError extends Error {
  constructor(nodeType, phase = "analysis") {
    super(`SEC-12 unsupported AST node: ${phase}:${nodeType || "unknown"}`);
    this.name = "UnsupportedAstNodeError";
    this.code = "unsupported_ast_node";
    this.nodeType = nodeType || "unknown";
    this.phase = phase;
  }
}

function failUnsupportedAstNode(node, phase) {
  throw new UnsupportedAstNodeError(node?.type, phase);
}

const UNSUPPORTED_CLASS_AST_NODE_TYPES = new Set([
  "ClassDeclaration",
  "ClassExpression",
  "StaticBlock",
  "ClassProperty",
  "PropertyDefinition",
  "ClassPrivateProperty",
  "ClassMethod",
  "ClassPrivateMethod"
]);

function assertNoUnsupportedClassSyntax(node, phase) {
  if (!node || typeof node !== "object") return;
  walkAst(node, (candidate) => {
    if (UNSUPPORTED_CLASS_AST_NODE_TYPES.has(candidate?.type)) {
      failUnsupportedAstNode(candidate, phase);
    }
  });
}

export const EXPECTED_REQUIRED_CASE_COUNT = 62;
export const REQUIRED_CASE_IDS = Object.freeze([
  "C01_ERROR_INSTANCE",
  "C02_STRING_THROWABLE",
  "C03_PLAIN_OBJECT",
  "C04_NULL_THROWABLE",
  "C05_UNDEFINED_THROWABLE",
  "C06_CIRCULAR_OBJECT",
  "C07_HOSTILE_GETTER",
  "C08_HOSTILE_TOJSON",
  "C09_NESTED_CAUSE",
  "C10_OVERSIZED_THROWABLE",
  "S01_AUTHORIZATION",
  "S02_COOKIE",
  "S03_SET_COOKIE",
  "S04_ACCESS_TOKEN",
  "S05_REFRESH_TOKEN",
  "S06_API_KEY",
  "S07_SERVICE_ROLE",
  "S08_SIGNING_SECRET",
  "S09_OAUTH_CODE",
  "S10_PKCE_VERIFIER",
  "S11_SIGNED_URL",
  "S12_EMAIL",
  "S13_USER_PROFILE_ID",
  "S14_IP_ADDRESS",
  "S15_DATA_URL",
  "S16_LARGE_BASE64",
  "S17_PROMPT_CONTENT",
  "S18_PROVIDER_BODY",
  "P01_RAW_MESSAGE_REMOVED",
  "P02_STACK_REMOVED",
  "P03_DETAILS_REMOVED",
  "P04_HINT_REMOVED",
  "P05_DATABASE_CODE_REMOVED",
  "P06_PUBLIC_CODE_ALLOWLIST",
  "P07_UNKNOWN_CODE_FALLBACK",
  "P08_EXISTING_HEADER_PRESERVATION",
  "P09_NO_STORE_EXACT",
  "P10_EXISTING_BOUNDARY_SHAPES",
  "L01_EVENT_ALLOWLIST",
  "L02_CATEGORY_ALLOWLIST",
  "L03_RAW_OBJECT_DISCARDED",
  "L04_CAUSE_DISCARDED",
  "L05_CRLF_NEUTRALIZED",
  "L06_ANSI_NEUTRALIZED",
  "L07_CONTROL_NEUTRALIZED",
  "L08_PAYLOAD_SIZE_BOUND",
  "L09_S2_FIELD_DISCARDED",
  "L10_S3_FIELD_DISCARDED",
  "L11_S4_FIELD_DISCARDED",
  "L12_SINK_FAILURE_ISOLATED",
  "M01_STRUCTURED_LOG_MODEL_CREDENTIAL_REJECTED",
  "M02_ANALYZE_LOG_STAGE_SEVERITY_CONTRACT",
  "I01_TRACK_PUBLIC_RESPONSE",
  "I02_TRACK_SAFE_LOG",
  "I03_SAVE_REPORT_PUBLIC_RESPONSE",
  "I04_SAVE_REPORT_SAFE_LOG",
  "I05_AUTH_CALLBACK_SAFE_LOG",
  "I06_PROVIDER_ADAPTER_DELEGATION",
  "I07_SUPABASE_HELPERS_SAFE_LOG",
  "I08_CLIENT_ERROR_MAPPER",
  "I09_CLIENT_CONSOLE_BOUNDARY",
  "I10_SENSITIVE_ROUTE_NO_STORE"
]);

const EXPECTED_GROUP_COUNTS = Object.freeze({ C: 10, S: 18, P: 10, L: 12, M: 2, I: 10 });
export const EXPECTED_SENSITIVE_NO_STORE_HEADER_COUNT = 3;
export const EXPECTED_SENSITIVE_NO_STORE_HEADER_ENTRIES = Object.freeze([
  Object.freeze(["Cache-Control", "private, no-store, max-age=0"]),
  Object.freeze(["CDN-Cache-Control", "no-store"]),
  Object.freeze(["Vercel-CDN-Cache-Control", "no-store"])
]);
const observed = new Map();
const catalog = new Map();
const FORBIDDEN_LOG_ARGUMENT_FIELDS = Object.freeze([
  "authorization",
  "body",
  "cause",
  "completion",
  "cookie",
  "details",
  "error",
  "hint",
  "origin",
  "prompt",
  "referer",
  "request",
  "response",
  "responseBody",
  "setCookie",
  "stack",
  "token"
]);

const sourcePaths = Object.freeze({
  track: "app/api/track/route.js",
  saveReport: "app/api/my/save-report/route.js",
  authCallback: "app/auth/callback/route.js",
  analyze: "app/api/analyze/route.js",
  providerLog: "lib/provider-runtime-log.js",
  profileUpsert: "lib/auth/profile-upsert.js",
  browserSupabase: "lib/supabase/browser-client.js",
  serverSupabase: "lib/supabase/server-client.js",
  saveReportCta: "components/result/SaveReportCTA.jsx"
});

const HTTP_METHOD_NAMES = Object.freeze(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);
const HTTP_METHOD_NAME_SET = new Set(HTTP_METHOD_NAMES);
const EXPECTED_SENSITIVE_ROUTE_COUNT = 11;
const EXPECTED_SENSITIVE_HANDLER_BINDING_COUNT = 12;
const EXPECTED_SENSITIVE_TERMINAL_RESPONSE_PATH_COUNT = 125;
const FULL_REPORT_POST_TERMINAL_SIGNATURES = Object.freeze([
  "call:buildSavedPremiumReportResponse",
  "call:getPremiumPersistenceFailedResponse(\"premium_session_update_failed\")",
  "call:getPremiumUnavailableResponse",
  "call:getStorageUnavailableResponse",
  "call:getStorageUnavailableResponse",
  "call:getUnauthorizedResponse(\"login_required\")",
  "call:getUnauthorizedResponse(\"premium_principal_conflict\")",
  "call:getUnauthorizedResponse(\"premium_session_missing_or_expired\")",
  "call:sensitiveJsonResponse{error=\"invalid_image\"}",
  "call:sensitiveJsonResponse{error=\"invalid_image\"}",
  "conditional:access.reason?call:getPaymentRequiredResponse:call:getUnauthorizedResponse(\"login_required\")",
  "conditional:persistResult.code?call:getSnapshotConflictResponse:call:getPremiumPersistenceFailedResponse",
  "conditional:replay.status?call:buildSavedPremiumReportResponse:call:getSnapshotConflictResponse",
  "identifier:response",
  "call:getUnauthorizedResponse(\"premium_session_missing_or_expired\")"
].sort());
const FULL_REPORT_SESSION_POST_TERMINAL_SIGNATURES = Object.freeze([
  "call:json{reason=\"current_session_missing\"}",
  "call:json{reason=\"premium_creation_not_allowed\"}",
  "call:json{reason=\"principal_conflict\"}",
  "call:json{reason=\"rotation_failed\"}",
  "call:json{reason=\"rotation_failed\"}",
  "call:json{reason=\"saved_snapshot_not_found\"}",
  "call:json{reason=\"session_store_unavailable\"}",
  "identifier:response"
].sort());
const SENSITIVE_ROUTE_HANDLER_BINDINGS = Object.freeze([
  Object.freeze({ id: "app/api/analyze/route.js::POST", path: "app/api/analyze/route.js", method: "POST", expectedTerminalPaths: 9 }),
  Object.freeze({ id: "app/api/face-reading/route.js::POST", path: "app/api/face-reading/route.js", method: "POST", expectedTerminalPaths: 14 }),
  Object.freeze({
    id: "app/api/full-report/route.js::POST",
    path: "app/api/full-report/route.js",
    method: "POST",
    expectedTerminalPaths: 15,
    expectedTerminalSignatures: FULL_REPORT_POST_TERMINAL_SIGNATURES
  }),
  Object.freeze({ id: "app/api/full-report/session/route.js::GET", path: "app/api/full-report/session/route.js", method: "GET", expectedTerminalPaths: 3 }),
  Object.freeze({
    id: "app/api/full-report/session/route.js::POST",
    path: "app/api/full-report/session/route.js",
    method: "POST",
    expectedTerminalPaths: 8,
    expectedTerminalSignatures: FULL_REPORT_SESSION_POST_TERMINAL_SIGNATURES
  }),
  Object.freeze({ id: "app/api/my/check-in/route.js::POST", path: "app/api/my/check-in/route.js", method: "POST", expectedTerminalPaths: 6 }),
  Object.freeze({ id: "app/api/my/dashboard/route.js::GET", path: "app/api/my/dashboard/route.js", method: "GET", expectedTerminalPaths: 4 }),
  Object.freeze({ id: "app/api/my/save-report/route.js::POST", path: "app/api/my/save-report/route.js", method: "POST", expectedTerminalPaths: 11 }),
  Object.freeze({ id: "app/api/premium/access/route.js::GET", path: "app/api/premium/access/route.js", method: "GET", expectedTerminalPaths: 1 }),
  Object.freeze({ id: "app/api/results/route.js::POST", path: "app/api/results/route.js", method: "POST", expectedTerminalPaths: 25 }),
  Object.freeze({ id: "app/api/track/route.js::POST", path: "app/api/track/route.js", method: "POST", expectedTerminalPaths: 23 }),
  Object.freeze({ id: "app/auth/callback/route.js::GET", path: "app/auth/callback/route.js", method: "GET", expectedTerminalPaths: 6 })
]);
const AUDITED_EXTERNAL_RESPONSE_HELPERS = Object.freeze({
  "@/lib/security/analysis-request-guard": Object.freeze({
    path: "lib/security/analysis-request-guard.js",
    helpers: Object.freeze({
      applyAnalysisGuardCookies: Object.freeze({ kind: "response-pass-through", responseArgumentIndex: 0 }),
      createAnalysisGuardResponse: Object.freeze({ kind: "safe-response-factory" })
    })
  }),
  "@/lib/premium-snapshot-replay-diagnostics": Object.freeze({
    path: "lib/premium-snapshot-replay-diagnostics.js",
    helpers: Object.freeze({
      applyPremiumSnapshotReplayDiagnosticHeaders: Object.freeze({
        kind: "response-pass-through",
        responseArgumentIndex: 0
      })
    })
  })
});

const clientBoundaryPaths = Object.freeze([
  "lib/supabase/browser-client.js",
  "components/auth/AnonymousAuthBootstrap.jsx",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js",
  "components/result/ResultShareActions.jsx",
  "components/result/SaveReportCTA.jsx",
  "components/FaceLab.js",
  "components/onboarding/PhotoUploadStep.js",
  "app/error.js"
]);

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function normalizeNoStoreEntries(input) {
  if (input instanceof Headers) {
    return [...input.entries()];
  }

  if (Array.isArray(input)) {
    return input.map((entry) => {
      assert.ok(Array.isArray(entry) && entry.length === 2, "no-store entry must be a key/value pair");
      return entry;
    });
  }

  assert.ok(input && typeof input === "object", "no-store input must be an object, Headers, or entry array");
  return Object.entries(input);
}

function assertSensitiveNoStoreHeaderExactSet(input, { normalizeNames = false } = {}) {
  assert.equal(EXPECTED_SENSITIVE_NO_STORE_HEADER_COUNT, 3);
  assert.equal(EXPECTED_SENSITIVE_NO_STORE_HEADER_ENTRIES.length, EXPECTED_SENSITIVE_NO_STORE_HEADER_COUNT);
  assert.equal(Object.isFrozen(EXPECTED_SENSITIVE_NO_STORE_HEADER_ENTRIES), true);
  assert.ok(EXPECTED_SENSITIVE_NO_STORE_HEADER_ENTRIES.every((entry) => Object.isFrozen(entry)));

  const normalizeName = (name) => normalizeNames ? name.toLowerCase() : name;
  const expectedEntries = EXPECTED_SENSITIVE_NO_STORE_HEADER_ENTRIES.map(([name, value]) => [normalizeName(name), value]);
  const actualEntries = normalizeNoStoreEntries(input).map(([name, value]) => {
    assert.equal(typeof name, "string", "no-store header name must be a string");
    assert.equal(typeof value, "string", "no-store header value must be a string");
    return [normalizeName(name), value];
  });

  assert.equal(actualEntries.length, EXPECTED_SENSITIVE_NO_STORE_HEADER_COUNT, "no-store header count must be exact");

  const expectedNames = expectedEntries.map(([name]) => name);
  const actualNames = actualEntries.map(([name]) => name);
  assert.equal(new Set(expectedNames).size, EXPECTED_SENSITIVE_NO_STORE_HEADER_COUNT);
  assert.equal(new Set(actualNames).size, EXPECTED_SENSITIVE_NO_STORE_HEADER_COUNT, "duplicate no-store header");
  assert.deepEqual([...actualNames].sort(), [...expectedNames].sort(), "no-store header key set mismatch");

  const actualMap = new Map(actualEntries);
  for (const [name, value] of expectedEntries) {
    assert.equal(actualMap.get(name), value, `no-store header value mismatch: ${name}`);
  }

  return Object.freeze({
    expectedCount: expectedEntries.length,
    actualCount: actualEntries.length,
    verifiedCount: expectedEntries.length
  });
}

function assertProductionNoStoreContract() {
  assert.notStrictEqual(SENSITIVE_NO_STORE_HEADERS, EXPECTED_SENSITIVE_NO_STORE_HEADER_ENTRIES);
  assert.equal(Object.isFrozen(SENSITIVE_NO_STORE_HEADERS), true);
  const registryResult = assertSensitiveNoStoreHeaderExactSet(SENSITIVE_NO_STORE_HEADERS);
  const helperResult = assertSensitiveNoStoreHeaderExactSet(createNoStoreHeaders(), { normalizeNames: true });
  assert.deepEqual(helperResult, registryResult);
  return registryResult;
}

function assertNoStoreNegativeMatrix() {
  const correct = EXPECTED_SENSITIVE_NO_STORE_HEADER_ENTRIES.map(([name, value]) => [name, value]);
  assert.doesNotThrow(() => assertSensitiveNoStoreHeaderExactSet(correct));

  const invalidInputs = [
    {},
    [],
    null,
    undefined,
    correct.filter(([name]) => name !== "Cache-Control"),
    correct.filter(([name]) => name !== "CDN-Cache-Control"),
    correct.filter(([name]) => name !== "Vercel-CDN-Cache-Control"),
    correct.filter(() => false),
    [...correct, ["X-Unknown-Cache-Policy", "no-store"]],
    [...correct, [...correct[0]]],
    correct.map(([name, value]) => [name === "Cache-Control" ? "cache-control" : name, value]),
    correct.map(([name, value]) => [name, name === "Cache-Control" ? `${value} ` : value]),
    correct.map(([name, value]) => [name, name === "Cache-Control" ? "no-store" : value]),
    correct.map(([name, value]) => [name, name === "CDN-Cache-Control" ? "private, no-store" : value]),
    correct.map(([name, value]) => [name, name === "Vercel-CDN-Cache-Control" ? "public, max-age=3600" : value])
  ];

  for (const input of invalidInputs) {
    assert.throws(() => assertSensitiveNoStoreHeaderExactSet(input));
  }
}

async function listAppRouteSources(directory = new URL("../app/", import.meta.url), prefix = "app") {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory()) {
      paths.push(...await listAppRouteSources(new URL(`${entry.name}/`, directory), `${prefix}/${entry.name}`));
    } else if (/^route\.(?:js|jsx|ts|tsx)$/.test(entry.name)) {
      paths.push(`${prefix}/${entry.name}`);
    }
  }

  return paths;
}

function parseSourceModule(source, path) {
  try {
    return parseJavaScript(source, {
      sourceType: "module",
      plugins: ["jsx"]
    });
  } catch {
    assert.fail(`SEC-12 AST parse failed: ${path}`);
  }
}

function isFunctionNode(node) {
  return Boolean(node) && ["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"].includes(node.type);
}

function getIdentifierName(node) {
  return node?.type === "Identifier" ? node.name : null;
}

function getPropertyName(node) {
  if (!node || node.computed) return null;
  if (node.key?.type === "Identifier") return node.key.name;
  if (node.key?.type === "StringLiteral") return node.key.value;
  return null;
}

function createModuleModel(source, path) {
  const ast = parseSourceModule(source, path);
  const imports = new Map();
  const functions = new Map();
  const topLevelBindings = new Map();
  const exportedHttpHandlers = new Map();

  const recordVariableDeclaration = (declaration) => {
    for (const declarator of declaration.declarations || []) {
      const name = getIdentifierName(declarator.id);
      if (!name) continue;
      topLevelBindings.set(name, declarator.init || null);
      if (isFunctionNode(declarator.init)) functions.set(name, declarator.init);
    }
  };

  const recordDeclaration = (declaration) => {
    if (!declaration) return;
    if (declaration.type === "FunctionDeclaration" && declaration.id?.name) {
      functions.set(declaration.id.name, declaration);
    } else if (declaration.type === "VariableDeclaration") {
      recordVariableDeclaration(declaration);
    }
  };

  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) {
        imports.set(specifier.local.name, {
          imported: specifier.type === "ImportSpecifier"
            ? (specifier.imported.name || specifier.imported.value)
            : specifier.type === "ImportDefaultSpecifier" ? "default" : "*",
          source: node.source.value
        });
      }
      continue;
    }

    if (node.type === "ExportNamedDeclaration") {
      recordDeclaration(node.declaration);
    } else {
      recordDeclaration(node);
    }
  }

  const resolveDirectFunction = (expression) => {
    if (isFunctionNode(expression)) return expression;
    if (expression?.type === "Identifier") return functions.get(expression.name) || null;
    return null;
  };

  for (const node of ast.program.body) {
    if (node.type !== "ExportNamedDeclaration") continue;

    if (node.declaration?.type === "FunctionDeclaration") {
      const name = node.declaration.id?.name;
      if (HTTP_METHOD_NAME_SET.has(name)) exportedHttpHandlers.set(name, node.declaration);
    } else if (node.declaration?.type === "VariableDeclaration") {
      for (const declarator of node.declaration.declarations) {
        const name = getIdentifierName(declarator.id);
        if (HTTP_METHOD_NAME_SET.has(name)) {
          exportedHttpHandlers.set(name, resolveDirectFunction(declarator.init));
        }
      }
    }

    for (const specifier of node.specifiers || []) {
      const exportedName = specifier.exported?.name || specifier.exported?.value;
      if (!HTTP_METHOD_NAME_SET.has(exportedName)) continue;
      exportedHttpHandlers.set(exportedName, functions.get(specifier.local?.name) || null);
    }
  }

  return { ast, exportedHttpHandlers, functions, imports, path, source, topLevelBindings };
}

function walkAst(node, visit, rootFunction = null) {
  if (!node || typeof node !== "object") return;
  if (rootFunction && node !== rootFunction && isFunctionNode(node)) return;
  visit(node);

  for (const [key, value] of Object.entries(node)) {
    if (["end", "loc", "start"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) walkAst(item, visit, rootFunction);
    } else {
      walkAst(value, visit, rootFunction);
    }
  }
}

function isCreateNoStoreHeadersCall(node, model) {
  if (node?.type !== "CallExpression" || node.callee?.type !== "Identifier") return false;
  const imported = model.imports.get(node.callee.name);
  return imported?.source === "@/lib/security/error-redaction" && imported.imported === "createNoStoreHeaders";
}

function moduleContainsNoStoreHelperCall(model) {
  let found = false;
  walkAst(model.ast, (node) => {
    if (isCreateNoStoreHeadersCall(node, model)) found = true;
  });
  return found;
}

function cloneEnvironment(environment) {
  return new Map(environment);
}

function deduplicateEnvironments(environments) {
  const unique = new Map();
  for (const environment of environments) {
    const signature = [...environment.entries()]
      .map(([name, binding]) => `${name}:${binding?.expression?.type || "null"}:${binding?.expression?.start ?? "none"}`)
      .sort()
      .join("|");
    if (!unique.has(signature)) unique.set(signature, environment);
  }
  return [...unique.values()];
}

function bindEnvironmentExpression(environment, name, expression, sourceEnvironment = environment) {
  environment.set(name, {
    expression,
    environment: cloneEnvironment(sourceEnvironment)
  });
}

function recordReachableNoStoreCalls(expression, state) {
  assertNoUnsupportedClassSyntax(expression, "expression");
  walkAst(expression, (node) => {
    if (isCreateNoStoreHeadersCall(node, state.model)) state.reachableHelperCalls.add(node);
  });
}

function getStaticBoolean(node) {
  if (node?.type === "BooleanLiteral") return node.value;
  if (node?.type === "NumericLiteral") return node.value !== 0;
  if (node?.type === "StringLiteral") return node.value.length > 0;
  if (node?.type === "NullLiteral") return false;
  if (node?.type === "UnaryExpression" && node.operator === "!") {
    const value = getStaticBoolean(node.argument);
    return value === null ? null : !value;
  }
  return null;
}

function applyExpressionEffects(expression, environment) {
  if (!expression) return;
  if (expression.type === "SequenceExpression") {
    for (const item of expression.expressions) applyExpressionEffects(item, environment);
    return;
  }
  if (expression.type === "AssignmentExpression" && expression.left?.type === "Identifier") {
    bindEnvironmentExpression(environment, expression.left.name, expression.right);
    return;
  }
  if (expression.type === "UpdateExpression" && expression.argument?.type === "Identifier") {
    bindEnvironmentExpression(environment, expression.argument.name, null);
  }
}

function analyzeStatements(statements, incomingEnvironments, state) {
  const terminalPaths = [];
  let environments = incomingEnvironments;

  for (const statement of statements || []) {
    const nextEnvironments = [];
    for (const environment of environments) {
      const result = analyzeStatement(statement, environment, state);
      terminalPaths.push(...result.terminalPaths);
      nextEnvironments.push(...result.outgoingEnvironments);
    }
    environments = deduplicateEnvironments(nextEnvironments);
    if (environments.length === 0) break;
  }

  return { outgoingEnvironments: environments, terminalPaths };
}

function analyzeStatement(statement, environment, state) {
  const passthrough = () => ({ outgoingEnvironments: [environment], terminalPaths: [] });

  if (!statement) return passthrough();

  if (statement.type === "BlockStatement") {
    return analyzeStatements(statement.body, [cloneEnvironment(environment)], state);
  }

  if (statement.type === "ReturnStatement") {
    recordReachableNoStoreCalls(statement.argument, state);
    return {
      outgoingEnvironments: [],
      terminalPaths: [{ expression: statement.argument, environment: cloneEnvironment(environment), location: statement.loc?.start || null, node: statement }]
    };
  }

  if (statement.type === "ThrowStatement") {
    recordReachableNoStoreCalls(statement.argument, state);
    return { outgoingEnvironments: [], terminalPaths: [] };
  }

  if (statement.type === "VariableDeclaration") {
    const nextEnvironment = cloneEnvironment(environment);
    for (const declaration of statement.declarations) {
      recordReachableNoStoreCalls(declaration.init, state);
      if (declaration.id?.type === "Identifier") {
        bindEnvironmentExpression(nextEnvironment, declaration.id.name, declaration.init, nextEnvironment);
      }
    }
    return { outgoingEnvironments: [nextEnvironment], terminalPaths: [] };
  }

  if (statement.type === "ExpressionStatement") {
    recordReachableNoStoreCalls(statement.expression, state);
    const nextEnvironment = cloneEnvironment(environment);
    applyExpressionEffects(statement.expression, nextEnvironment);
    return { outgoingEnvironments: [nextEnvironment], terminalPaths: [] };
  }

  if (statement.type === "IfStatement") {
    recordReachableNoStoreCalls(statement.test, state);
    const staticValue = getStaticBoolean(statement.test);
    const branches = [];
    if (staticValue !== false) branches.push(statement.consequent);
    if (staticValue !== true) branches.push(statement.alternate);

    const terminalPaths = [];
    const outgoingEnvironments = [];
    for (const branch of branches) {
      if (!branch) {
        outgoingEnvironments.push(cloneEnvironment(environment));
        continue;
      }
      const result = analyzeStatement(branch, cloneEnvironment(environment), state);
      terminalPaths.push(...result.terminalPaths);
      outgoingEnvironments.push(...result.outgoingEnvironments);
    }
    return { outgoingEnvironments, terminalPaths };
  }

  if (statement.type === "TryStatement") {
    if (statement.finalizer?.body?.length) {
      throw new Error("SEC-12 response-path analysis does not accept non-empty finally blocks");
    }
    const tryResult = analyzeStatement(statement.block, cloneEnvironment(environment), state);
    if (!statement.handler) return tryResult;
    const catchEnvironment = cloneEnvironment(environment);
    if (statement.handler.param?.type === "Identifier") {
      bindEnvironmentExpression(catchEnvironment, statement.handler.param.name, null);
    }
    const catchResult = analyzeStatement(statement.handler.body, catchEnvironment, state);
    return {
      outgoingEnvironments: [...tryResult.outgoingEnvironments, ...catchResult.outgoingEnvironments],
      terminalPaths: [...tryResult.terminalPaths, ...catchResult.terminalPaths]
    };
  }

  if (statement.type === "SwitchStatement") {
    recordReachableNoStoreCalls(statement.discriminant, state);
    const terminalPaths = [];
    const outgoingEnvironments = [];
    let hasDefault = false;
    for (const switchCase of statement.cases) {
      if (!switchCase.test) hasDefault = true;
      const result = analyzeStatements(switchCase.consequent, [cloneEnvironment(environment)], state);
      terminalPaths.push(...result.terminalPaths);
      outgoingEnvironments.push(...result.outgoingEnvironments);
    }
    if (!hasDefault) outgoingEnvironments.push(cloneEnvironment(environment));
    return { outgoingEnvironments, terminalPaths };
  }

  if (["DoWhileStatement", "ForInStatement", "ForOfStatement", "ForStatement", "WhileStatement"].includes(statement.type)) {
    recordReachableNoStoreCalls(statement.test, state);
    const staticValue = statement.type === "DoWhileStatement" ? true : getStaticBoolean(statement.test);
    if (staticValue === false) return passthrough();
    const bodyResult = analyzeStatement(statement.body, cloneEnvironment(environment), state);
    return {
      outgoingEnvironments: statement.type === "DoWhileStatement"
        ? bodyResult.outgoingEnvironments
        : [cloneEnvironment(environment), ...bodyResult.outgoingEnvironments],
      terminalPaths: bodyResult.terminalPaths
    };
  }

  if (statement.type === "LabeledStatement") {
    return analyzeStatement(statement.body, environment, state);
  }

  if (["BreakStatement", "ContinueStatement", "DebuggerStatement", "EmptyStatement", "FunctionDeclaration"].includes(statement.type)) {
    return passthrough();
  }

  if (statement.type === "WithStatement") {
    failUnsupportedAstNode(statement, "statement");
  }

  failUnsupportedAstNode(statement, "statement");
}

function collectFunctionTerminalPaths(functionNode, argumentBindings, state) {
  const environment = new Map();
  const parameters = functionNode.params || [];

  for (let index = 0; index < parameters.length; index += 1) {
    const parameter = parameters[index];
    const argumentBinding = argumentBindings[index] || null;
    if (parameter.type === "Identifier") {
      environment.set(parameter.name, argumentBinding || { expression: null, environment: new Map() });
    } else if (parameter.type === "AssignmentPattern" && parameter.left.type === "Identifier") {
      environment.set(parameter.left.name, argumentBinding || {
        expression: parameter.right,
        environment: cloneEnvironment(environment)
      });
    }
  }

  if (functionNode.body.type !== "BlockStatement") {
    recordReachableNoStoreCalls(functionNode.body, state);
    return [{ expression: functionNode.body, environment, location: functionNode.body.loc?.start || null, node: functionNode }];
  }

  return analyzeStatements(functionNode.body.body, [environment], state).terminalPaths;
}

function createProofResult(kind, details = {}) {
  return { kind, ok: kind === "safe", ...details };
}

function combineProofResults(results, details = {}) {
  if (results.length === 0) return createProofResult("unresolved", details);
  if (results.some((result) => result.kind === "unsafe")) return createProofResult("unsafe", details);
  if (results.some((result) => result.kind === "unresolved")) return createProofResult("unresolved", details);
  return createProofResult("safe", details);
}

function resolveEnvironmentBinding(identifier, environment, state, callStack, bindingStack) {
  const binding = environment.get(identifier.name);
  if (!binding?.expression) return createProofResult("unresolved");
  const key = `${identifier.name}:${binding.expression.start ?? "unknown"}`;
  if (bindingStack.has(key)) return createProofResult("unresolved");
  const nextBindingStack = new Set(bindingStack);
  nextBindingStack.add(key);
  return proveResponseExpression(binding.expression, binding.environment, state, callStack, nextBindingStack);
}

function getResponseConstructor(node, model, environment) {
  if (node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && !node.callee.computed) {
    const objectName = getIdentifierName(node.callee.object);
    const methodName = getIdentifierName(node.callee.property);
    if (objectName === "NextResponse" && ["json", "redirect"].includes(methodName)) {
      const imported = model.imports.get("NextResponse");
      if (imported?.source === "next/server" && imported.imported === "NextResponse") {
        return { initArgumentIndex: 1, name: `NextResponse.${methodName}` };
      }
    }
    if (objectName === "Response" && methodName === "json" && !environment.has("Response") && !model.imports.has("Response")) {
      return { initArgumentIndex: 1, name: "Response.json" };
    }
  }

  if (node?.type === "NewExpression" && getIdentifierName(node.callee) === "Response" && !environment.has("Response") && !model.imports.has("Response")) {
    return { initArgumentIndex: 1, name: "new Response" };
  }

  return null;
}

function resolveHeadersExpression(initExpression, environment, bindingStack = new Set()) {
  if (!initExpression) return null;
  if (initExpression.type === "Identifier") {
    const binding = environment.get(initExpression.name);
    if (!binding?.expression || bindingStack.has(initExpression.name)) return null;
    const nextStack = new Set(bindingStack);
    nextStack.add(initExpression.name);
    return resolveHeadersExpression(binding.expression, binding.environment, nextStack);
  }
  if (initExpression.type !== "ObjectExpression") return null;

  let candidate = null;
  for (const property of initExpression.properties) {
    if (property.type === "SpreadElement") {
      if (candidate) candidate = { ambiguous: true };
      continue;
    }
    if (property.type === "ObjectProperty" && getPropertyName(property) === "headers") {
      candidate = { expression: property.value, environment };
    }
  }
  return candidate;
}

function proveHeadersExpression(expression, environment, state, bindingStack = new Set()) {
  if (!expression) return createProofResult("unsafe");
  if (isCreateNoStoreHeadersCall(expression, state.model)) {
    state.usedHelperCalls.add(expression);
    return createProofResult("safe");
  }
  if (expression.type === "Identifier") {
    const binding = environment.get(expression.name);
    if (!binding?.expression || bindingStack.has(expression.name)) return createProofResult("unresolved");
    const nextStack = new Set(bindingStack);
    nextStack.add(expression.name);
    return proveHeadersExpression(binding.expression, binding.environment, state, nextStack);
  }
  if (expression.type === "ConditionalExpression") {
    return combineProofResults([
      proveHeadersExpression(expression.consequent, environment, state, bindingStack),
      proveHeadersExpression(expression.alternate, environment, state, bindingStack)
    ]);
  }
  return createProofResult("unsafe");
}

function proveDirectResponse(node, environment, state) {
  const constructor = getResponseConstructor(node, state.model, environment);
  if (!constructor) return null;
  const initExpression = node.arguments?.[constructor.initArgumentIndex] || null;
  const headersBinding = resolveHeadersExpression(initExpression, environment);
  if (!headersBinding || headersBinding.ambiguous) {
    return createProofResult("unsafe", { constructor: constructor.name });
  }
  const headerProof = proveHeadersExpression(headersBinding.expression, headersBinding.environment, state);
  return createProofResult(headerProof.kind, { constructor: constructor.name });
}

function proveFunctionCall(functionNode, callExpression, callerEnvironment, state, callStack, targetModel = state.model) {
  if (callStack.has(functionNode) || callStack.size >= 12) return createProofResult("unresolved");
  const nextCallStack = new Set(callStack);
  nextCallStack.add(functionNode);
  const argumentBindings = (callExpression.arguments || []).map((argument) => ({
    expression: argument?.type === "SpreadElement" ? null : argument,
    environment: cloneEnvironment(callerEnvironment)
  }));
  const nestedState = { ...state, model: targetModel };
  const terminalPaths = collectFunctionTerminalPaths(functionNode, argumentBindings, nestedState);
  if (terminalPaths.length === 0) return createProofResult("unresolved");
  const proofs = terminalPaths.map((path) => proveResponseExpression(
    path.expression,
    path.environment,
    nestedState,
    nextCallStack,
    new Set()
  ));
  return combineProofResults(proofs);
}

function proveImportedResponseHelper(callExpression, imported, environment, state, callStack) {
  const externalModule = state.externalHelpers.get(imported.source);
  const contract = externalModule?.contracts?.[imported.imported];
  if (!contract) return createProofResult("unresolved");

  if (contract.kind === "response-pass-through") {
    const responseArgument = callExpression.arguments?.[contract.responseArgumentIndex];
    if (!responseArgument || responseArgument.type === "SpreadElement") return createProofResult("unresolved");
    return proveResponseExpression(responseArgument, environment, state, callStack, new Set());
  }

  if (contract.kind === "safe-response-factory") {
    const functionNode = externalModule.model.exportedFunctions.get(imported.imported);
    if (!functionNode) return createProofResult("unresolved");
    return proveFunctionCall(functionNode, callExpression, environment, state, callStack, externalModule.model);
  }

  return createProofResult("unresolved");
}

function proveResponseExpression(expression, environment, state, callStack = new Set(), bindingStack = new Set()) {
  if (!expression) return createProofResult("unresolved");
  assertNoUnsupportedClassSyntax(expression, "response-expression");
  if (["AwaitExpression", "ParenthesizedExpression", "TSAsExpression", "TSTypeAssertion"].includes(expression.type)) {
    return proveResponseExpression(expression.argument || expression.expression, environment, state, callStack, bindingStack);
  }
  if (expression.type === "Identifier") {
    return resolveEnvironmentBinding(expression, environment, state, callStack, bindingStack);
  }
  if (expression.type === "ConditionalExpression") {
    return combineProofResults([
      proveResponseExpression(expression.consequent, environment, state, callStack, bindingStack),
      proveResponseExpression(expression.alternate, environment, state, callStack, bindingStack)
    ]);
  }
  if (expression.type === "SequenceExpression") {
    const lastExpression = expression.expressions.at(-1);
    return proveResponseExpression(lastExpression, environment, state, callStack, bindingStack);
  }

  const directProof = proveDirectResponse(expression, environment, state);
  if (directProof) return directProof;

  if (expression.type === "CallExpression" && expression.callee.type === "Identifier") {
    const localFunction = state.model.functions.get(expression.callee.name);
    if (localFunction) {
      return proveFunctionCall(localFunction, expression, environment, state, callStack);
    }
    const imported = state.model.imports.get(expression.callee.name);
    if (imported) {
      return proveImportedResponseHelper(expression, imported, environment, state, callStack);
    }
  }

  return createProofResult("unresolved");
}

function analyzeHandlerNode(functionNode, model, externalHelpers) {
  if (!functionNode) {
    return Object.freeze({
      deadHelperCalls: 0,
      terminalPaths: 0,
      unsafePaths: 0,
      unresolvedPaths: 1,
      verifiedPaths: 0,
      verified: false
    });
  }

  const state = {
    externalHelpers,
    model,
    reachableHelperCalls: new Set(),
    usedHelperCalls: new Set()
  };
  const terminalPathVariants = collectFunctionTerminalPaths(functionNode, [], state);
  const terminalPathGroups = new Map();
  for (const path of terminalPathVariants) {
    if (!terminalPathGroups.has(path.node)) terminalPathGroups.set(path.node, []);
    terminalPathGroups.get(path.node).push(path);
  }
  const pathProofs = [...terminalPathGroups.values()].map((paths) => combineProofResults(
    paths.map((path) => proveResponseExpression(path.expression, path.environment, state))
  ));
  const deadHelperCalls = [...state.reachableHelperCalls].filter((node) => !state.usedHelperCalls.has(node)).length;
  const unsafePaths = pathProofs.filter((proof) => proof.kind === "unsafe").length;
  const unresolvedPaths = pathProofs.filter((proof) => proof.kind === "unresolved").length;
  const verifiedPaths = pathProofs.filter((proof) => proof.kind === "safe").length;
  const terminalPaths = terminalPathGroups.size;
  const terminalPathLocations = [...terminalPathGroups.keys()]
    .map((node) => `${node.loc?.start?.line || 0}:${node.loc?.start?.column || 0}`)
    .sort();
  const describeMember = (node) => {
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "MemberExpression" || node?.type === "OptionalMemberExpression") {
      return `${describeMember(node.object)}.${describeMember(node.property)}`;
    }
    return node?.type || "unknown";
  };
  const describeCall = (node) => {
    const callee = describeMember(node?.callee);
    const firstArgument = node?.arguments?.[0];
    let literalSuffix = "";
    if (firstArgument?.type === "StringLiteral") {
      literalSuffix = `(${JSON.stringify(firstArgument.value)})`;
    } else if (firstArgument?.type === "ObjectExpression") {
      const discriminator = firstArgument.properties?.find(
        (property) =>
          property?.type === "ObjectProperty" &&
          ["error", "reason"].includes(property.key?.name) &&
          property.value?.type === "StringLiteral"
      );
      if (discriminator) {
        literalSuffix = `{${discriminator.key.name}=${JSON.stringify(discriminator.value.value)}}`;
      }
    }
    return `call:${callee}${literalSuffix}`;
  };
  const describeTerminal = (expression) => {
    if (expression?.type === "Identifier") return `identifier:${expression.name}`;
    if (expression?.type === "CallExpression") return describeCall(expression);
    if (expression?.type === "ConditionalExpression") {
      return `conditional:${describeMember(expression.test?.left)}?${describeTerminal(expression.consequent)}:${describeTerminal(expression.alternate)}`;
    }
    return `expression:${expression?.type || "unknown"}`;
  };
  const terminalPathSignatures = [...terminalPathGroups.values()]
    .map((paths) => describeTerminal(paths[0]?.expression))
    .sort();

  return Object.freeze({
    deadHelperCalls,
    terminalPaths,
    terminalPathLocations: Object.freeze(terminalPathLocations),
    terminalPathSignatures: Object.freeze(terminalPathSignatures),
    unsafePaths,
    unresolvedPaths,
    verifiedPaths,
    verified: terminalPaths > 0 && verifiedPaths === terminalPaths && deadHelperCalls === 0
  });
}

function collectExportedFunctions(model) {
  const exportedFunctions = new Map();
  for (const node of model.ast.program.body) {
    if (node.type !== "ExportNamedDeclaration") continue;
    if (node.declaration?.type === "FunctionDeclaration" && node.declaration.id?.name) {
      exportedFunctions.set(node.declaration.id.name, node.declaration);
    }
    for (const specifier of node.specifiers || []) {
      const exportedName = specifier.exported?.name || specifier.exported?.value;
      const functionNode = model.functions.get(specifier.local?.name);
      if (exportedName && functionNode) exportedFunctions.set(exportedName, functionNode);
    }
  }
  return { ...model, exportedFunctions };
}

function assertPassThroughHelper(functionNode, responseArgumentIndex, label) {
  assert.ok(functionNode, `${label} must be statically exported`);
  const responseParameter = functionNode.params?.[responseArgumentIndex];
  assert.equal(responseParameter?.type, "Identifier", `${label} response parameter must be a plain identifier`);
  let assignmentCount = 0;
  const returnExpressions = [];
  walkAst(functionNode.body, (node) => {
    if (node.type === "AssignmentExpression" && node.left?.type === "Identifier" && node.left.name === responseParameter.name) {
      assignmentCount += 1;
    }
    if (node.type === "ReturnStatement") returnExpressions.push(node.argument);
  }, functionNode);
  assert.equal(assignmentCount, 0, `${label} must not overwrite the response argument`);
  assert.ok(returnExpressions.length > 0, `${label} must return its response argument`);
  assert.ok(returnExpressions.every((node) => node?.type === "Identifier" && node.name === responseParameter.name));
}

async function buildAuditedExternalHelperModels() {
  const result = new Map();
  for (const [source, descriptor] of Object.entries(AUDITED_EXTERNAL_RESPONSE_HELPERS)) {
    const model = collectExportedFunctions(createModuleModel(await readSource(descriptor.path), descriptor.path));
    const contracts = descriptor.helpers;
    for (const [helperName, contract] of Object.entries(contracts)) {
      const functionNode = model.exportedFunctions.get(helperName);
      assert.ok(functionNode, `missing audited external response helper: ${source}#${helperName}`);
      if (contract.kind === "response-pass-through") {
        assertPassThroughHelper(functionNode, contract.responseArgumentIndex, `${source}#${helperName}`);
      }
    }
    result.set(source, { contracts, model });
  }
  return result;
}

function analyzeSyntheticHandler(source) {
  const model = createModuleModel(source, "synthetic/route.js");
  const functionNode = model.exportedHttpHandlers.get("POST") || null;
  return analyzeHandlerNode(functionNode, model, new Map());
}

function assertI10PureNegativeMatrix() {
  const helperImport = 'import { createNoStoreHeaders } from "@/lib/security/error-redaction";';
  const safeResponse = 'return Response.json({}, { headers: createNoStoreHeaders() });';
  const unsafeResponse = 'return Response.json({}, { headers: unsafeHeaders });';
  const positiveSources = [
    `${helperImport} export async function POST() { ${safeResponse} }`,
    `${helperImport} function safeResponse() { ${safeResponse} } export const POST = async () => safeResponse();`
  ];
  for (const source of positiveSources) {
    const result = analyzeSyntheticHandler(source);
    assert.equal(result.verified, true);
  }

  const negativeSources = [
    `${helperImport} export async function POST() { ${unsafeResponse} }`,
    `${helperImport} export async function POST() { createNoStoreHeaders(); ${unsafeResponse} }`,
    `${helperImport} export async function POST() { const safeHeaders = createNoStoreHeaders(); ${unsafeResponse} }`,
    `${helperImport} export async function POST() { let headers = createNoStoreHeaders(); headers = unsafeHeaders; return Response.json({}, { headers }); }`,
    `${helperImport} export async function POST() { ${unsafeResponse} createNoStoreHeaders(); }`,
    `${helperImport} export async function POST() { if (false) { createNoStoreHeaders(); } ${unsafeResponse} }`,
    `${helperImport} function unusedSafeResponse() { ${safeResponse} } export async function POST() { ${unsafeResponse} }`,
    `${helperImport} export async function POST(condition) { if (condition) { ${safeResponse} } ${unsafeResponse} }`,
    `${helperImport} export async function POST() { const dead = createNoStoreHeaders(); void dead; ${unsafeResponse} }`,
    `${helperImport} function safeResponse() { ${safeResponse} } export async function POST() { safeResponse(); ${unsafeResponse} }`,
    `${helperImport} export async function POST() { return Response.json({}, { headers: { ...createNoStoreHeaders(), ...unsafeHeaders } }); }`,
    `${helperImport} const wrappers = { safe() { ${safeResponse} } }; export async function POST() { return wrappers.safe(); }`,
    `${helperImport} const handler = async () => { ${safeResponse} }; const alias = handler; export const POST = alias;`,
    `${helperImport} export async function POST() { return Response.json({}); }`,
    `${helperImport} export async function POST() { return Response.json({}, { metadata: createNoStoreHeaders(), headers: unsafeHeaders }); }`,
    `${helperImport} function mixed(condition) { if (condition) { ${safeResponse} } ${unsafeResponse} } export async function POST(condition) { return mixed(condition); }`,
    `${helperImport} export async function POST() { let response = Response.json({}, { headers: createNoStoreHeaders() }); class Sec12StaticOverwrite { static { response = Response.json({}); } } return response; }`
  ];

  for (const source of negativeSources) {
    let rejected = false;
    try {
      rejected = analyzeSyntheticHandler(source).verified === false;
    } catch (error) {
      rejected = error?.code === "unsupported_ast_node";
    }
    assert.equal(rejected, true);
  }

  return Object.freeze({ positive: positiveSources.length, negative: negativeSources.length, rejected: negativeSources.length });
}

async function assertSensitiveRouteIntegrationExactSet() {
  assert.equal(Object.isFrozen(SENSITIVE_ROUTE_HANDLER_BINDINGS), true);
  assert.ok(SENSITIVE_ROUTE_HANDLER_BINDINGS.every((descriptor) => Object.isFrozen(descriptor)));
  assert.equal(SENSITIVE_ROUTE_HANDLER_BINDINGS.length, EXPECTED_SENSITIVE_HANDLER_BINDING_COUNT);
  assert.equal(
    SENSITIVE_ROUTE_HANDLER_BINDINGS.reduce((total, descriptor) => total + descriptor.expectedTerminalPaths, 0),
    EXPECTED_SENSITIVE_TERMINAL_RESPONSE_PATH_COUNT
  );

  const expectedBindingIds = SENSITIVE_ROUTE_HANDLER_BINDINGS.map((descriptor) => descriptor.id);
  const expectedPaths = [...new Set(SENSITIVE_ROUTE_HANDLER_BINDINGS.map((descriptor) => descriptor.path))];
  assert.equal(expectedPaths.length, EXPECTED_SENSITIVE_ROUTE_COUNT);
  assert.equal(new Set(expectedBindingIds).size, EXPECTED_SENSITIVE_HANDLER_BINDING_COUNT);

  const discoveredPaths = [];
  const discoveredBindingIds = [];
  const modelByPath = new Map();
  for (const path of await listAppRouteSources()) {
    const model = createModuleModel(await readSource(path), path);
    if (!moduleContainsNoStoreHelperCall(model)) continue;
    discoveredPaths.push(path);
    modelByPath.set(path, model);
    for (const method of model.exportedHttpHandlers.keys()) {
      discoveredBindingIds.push(`${path}::${method}`);
    }
  }
  assert.deepEqual([...discoveredPaths].sort(), [...expectedPaths].sort(), "sensitive route discovery exact-set mismatch");
  assert.deepEqual([...discoveredBindingIds].sort(), [...expectedBindingIds].sort(), "sensitive handler binding discovery exact-set mismatch");

  const externalHelpers = await buildAuditedExternalHelperModels();
  const verifiedBindingIds = [];
  const verifiedPaths = new Set();
  let discoveredTerminalPaths = 0;
  let verifiedTerminalPaths = 0;
  let unsafeResponsePaths = 0;
  let unresolvedResponsePaths = 0;
  let deadHelperCalls = 0;

  for (const descriptor of SENSITIVE_ROUTE_HANDLER_BINDINGS) {
    const model = modelByPath.get(descriptor.path);
    assert.ok(model, `missing route model: ${descriptor.path}`);
    const result = analyzeHandlerNode(model.exportedHttpHandlers.get(descriptor.method), model, externalHelpers);
    if (result.terminalPaths !== descriptor.expectedTerminalPaths) {
      console.error(`${descriptor.id} terminal response paths: ${result.terminalPathLocations.join(", ")}`);
    }
    assert.equal(result.terminalPaths, descriptor.expectedTerminalPaths, `${descriptor.id} terminal response path count mismatch`);
    if (descriptor.expectedTerminalSignatures) {
      assert.deepEqual(
        result.terminalPathSignatures,
        descriptor.expectedTerminalSignatures,
        `${descriptor.id} terminal response path signature exact-set mismatch`
      );
    }
    if (!result.verified) {
      console.error(`${descriptor.id} terminal verification: ${JSON.stringify({
        deadHelperCalls: result.deadHelperCalls,
        terminalPaths: result.terminalPaths,
        unsafePaths: result.unsafePaths,
        unresolvedPaths: result.unresolvedPaths,
        verifiedPaths: result.verifiedPaths
      })}`);
    }
    discoveredTerminalPaths += result.terminalPaths;
    verifiedTerminalPaths += result.verifiedPaths;
    unsafeResponsePaths += result.unsafePaths;
    unresolvedResponsePaths += result.unresolvedPaths;
    deadHelperCalls += result.deadHelperCalls;
    assert.equal(result.verified, true, `${descriptor.id} response path is not bound to no-store headers`);
    verifiedBindingIds.push(descriptor.id);
    verifiedPaths.add(descriptor.path);
  }

  assert.deepEqual([...verifiedBindingIds].sort(), [...expectedBindingIds].sort(), "sensitive handler verification exact-set mismatch");
  assert.deepEqual([...verifiedPaths].sort(), [...expectedPaths].sort(), "sensitive route verification exact-set mismatch");
  assert.equal(discoveredTerminalPaths, EXPECTED_SENSITIVE_TERMINAL_RESPONSE_PATH_COUNT);
  assert.equal(verifiedTerminalPaths, EXPECTED_SENSITIVE_TERMINAL_RESPONSE_PATH_COUNT);
  assert.equal(unsafeResponsePaths, 0);
  assert.equal(unresolvedResponsePaths, 0);
  assert.equal(deadHelperCalls, 0);
  assertProductionNoStoreContract();
  const pureMatrix = assertI10PureNegativeMatrix();

  return Object.freeze({
    deadHelperCalls,
    handlerBindings: Object.freeze({
      discovered: discoveredBindingIds.length,
      expected: expectedBindingIds.length,
      verified: verifiedBindingIds.length
    }),
    pureMatrix,
    routes: Object.freeze({
      discovered: discoveredPaths.length,
      expected: expectedPaths.length,
      verified: verifiedPaths.size
    }),
    terminalResponsePaths: Object.freeze({
      discovered: discoveredTerminalPaths,
      expected: EXPECTED_SENSITIVE_TERMINAL_RESPONSE_PATH_COUNT,
      verified: verifiedTerminalPaths
    }),
    unresolvedResponsePaths,
    unsafeResponsePaths
  });
}

function assertSafeLoggerArguments(source, label) {
  const calls = source.match(/writeSafeLog\([\s\S]*?\n\s*\}\);/g) || [];
  assert.ok(calls.length > 0, `${label} must contain a structured logger call`);

  for (const call of calls) {
    for (const field of FORBIDDEN_LOG_ARGUMENT_FIELDS) {
      assert.doesNotMatch(
        call,
        new RegExp(`\\b${field}\\s*(?=:|,)`),
        `${label} must not pass raw ${field} to the logger`
      );
    }
  }
}

function register(id, run) {
  assert.ok(REQUIRED_CASE_IDS.includes(id), `Unknown SEC-12 case registered: ${id}`);
  assert.equal(catalog.has(id), false, `Duplicate SEC-12 case registered: ${id}`);
  catalog.set(id, run);
}

function secretProbe(marker, field = "sensitive") {
  const payload = createSafeLogEvent({
    event: "analysis_failed",
    category: "internal_error",
    operation: "analysis",
    [field]: marker
  });
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

function publicProbe(raw) {
  const payload = createPublicError(raw?.code, {
    fallbackCode: "service_unavailable",
    includeMessage: true,
    ...raw
  });
  const serialized = JSON.stringify(payload);
  for (const marker of ["raw-secret", "stack-secret", "details-secret", "hint-secret", "23505"]) {
    assert.equal(serialized.includes(marker), false);
  }
  return payload;
}

register("C01_ERROR_INSTANCE", () => assert.equal(classifyUnknownError(new Error("raw-secret")), "internal_error"));
register("C02_STRING_THROWABLE", () => assert.equal(classifyUnknownError("raw-secret"), "internal_error"));
register("C03_PLAIN_OBJECT", () => assert.equal(classifyUnknownError({ message: "raw-secret" }), "internal_error"));
register("C04_NULL_THROWABLE", () => assert.equal(classifyUnknownError(null), "internal_error"));
register("C05_UNDEFINED_THROWABLE", () => assert.equal(classifyUnknownError(undefined), "internal_error"));
register("C06_CIRCULAR_OBJECT", () => {
  const value = {}; value.self = value;
  assert.doesNotThrow(() => classifyUnknownError(value));
});
register("C07_HOSTILE_GETTER", () => {
  const value = Object.defineProperty({}, "message", { get() { throw new Error("getter-secret"); } });
  assert.doesNotThrow(() => classifyUnknownError(value));
});
register("C08_HOSTILE_TOJSON", () => {
  const value = { toJSON() { throw new Error("json-secret"); } };
  assert.doesNotThrow(() => classifyUnknownError(value));
});
register("C09_NESTED_CAUSE", () => {
  let causeReads = 0;
  const value = Object.defineProperty({}, "cause", {
    get() {
      causeReads += 1;
      throw new Error("nested-cause-secret");
    }
  });
  assert.doesNotThrow(() => classifyUnknownError(value));
  assert.equal(causeReads, 0);
});
register("C10_OVERSIZED_THROWABLE", () => assert.equal(classifyUnknownError("x".repeat(2_000_000)), "internal_error"));

register("S01_AUTHORIZATION", () => secretProbe("Authorization: Bearer auth-secret", "authorization"));
register("S02_COOKIE", () => secretProbe("Cookie: sb-access-token=cookie-secret", "cookie"));
register("S03_SET_COOKIE", () => secretProbe("Set-Cookie: sb-refresh-token=set-cookie-secret", "setCookie"));
register("S04_ACCESS_TOKEN", () => secretProbe("access_token=access-secret", "accessToken"));
register("S05_REFRESH_TOKEN", () => secretProbe("refresh_token=refresh-secret", "refreshToken"));
register("S06_API_KEY", () => secretProbe("api_key=sk-api-secret-value", "apiKey"));
register("S07_SERVICE_ROLE", () => secretProbe("service_role=service-role-secret", "serviceRole"));
register("S08_SIGNING_SECRET", () => secretProbe("signing_secret=signing-secret", "signingSecret"));
register("S09_OAUTH_CODE", () => secretProbe("oauth_code=oauth-secret", "oauthCode"));
register("S10_PKCE_VERIFIER", () => secretProbe("code_verifier=pkce-secret", "pkceVerifier"));
register("S11_SIGNED_URL", () => secretProbe("https://example.test/file?token=signed-secret", "signedUrl"));
register("S12_EMAIL", () => secretProbe("private.person@example.test", "email"));
register("S13_USER_PROFILE_ID", () => secretProbe("profile-019f-secret-id", "profileId"));
register("S14_IP_ADDRESS", () => secretProbe("203.0.113.42", "ipAddress"));
register("S15_DATA_URL", () => secretProbe(`data:image/jpeg;base64,${"A".repeat(256)}`, "imageDataUrl"));
register("S16_LARGE_BASE64", () => secretProbe("Q".repeat(256), "encodedPayload"));
register("S17_PROMPT_CONTENT", () => secretProbe("private prompt with user skin concern", "prompt"));
register("S18_PROVIDER_BODY", () => secretProbe("private provider completion body", "responseBody"));

register("P01_RAW_MESSAGE_REMOVED", () => assert.deepEqual(publicProbe({ code: "service_unavailable", message: "raw-secret" }), { error: "service_unavailable", message: "The service is temporarily unavailable." }));
register("P02_STACK_REMOVED", () => publicProbe({ code: "service_unavailable", stack: "stack-secret" }));
register("P03_DETAILS_REMOVED", () => publicProbe({ code: "service_unavailable", details: "details-secret" }));
register("P04_HINT_REMOVED", () => publicProbe({ code: "service_unavailable", hint: "hint-secret" }));
register("P05_DATABASE_CODE_REMOVED", () => publicProbe({ code: "service_unavailable", databaseCode: "23505" }));
register("P06_PUBLIC_CODE_ALLOWLIST", () => {
  assert.equal(Object.isFrozen(PUBLIC_ERROR_CODES), true);
  for (const code of PUBLIC_ERROR_CODES) assert.equal(createPublicError(code).error, code);
});
register("P07_UNKNOWN_CODE_FALLBACK", () => assert.deepEqual(createPublicError("raw-secret"), { error: "service_unavailable" }));
register("P08_EXISTING_HEADER_PRESERVATION", () => {
  const headers = createNoStoreHeaders({ Allow: "POST", "Retry-After": "60" });
  assert.equal(headers.get("allow"), "POST");
  assert.equal(headers.get("retry-after"), "60");
});
register("P09_NO_STORE_EXACT", () => {
  assertProductionNoStoreContract();
  assertNoStoreNegativeMatrix();
});
register("P10_EXISTING_BOUNDARY_SHAPES", async () => {
  const sec09 = await readSource("lib/analysis-result-access.js");
  const sec11 = await readSource("lib/security/signout-request-policy.js");
  assert.match(sec09, /not_found/);
  assert.match(sec11, /signout_unavailable/);
});

register("L01_EVENT_ALLOWLIST", () => assert.equal(createSafeLogEvent({ event: "raw-secret" }).event, "client_operation_failed"));
register("L02_CATEGORY_ALLOWLIST", () => assert.equal(createSafeLogEvent({ category: "raw-secret" }).category, "internal_error"));
register("L03_RAW_OBJECT_DISCARDED", () => secretProbe("raw-object-secret", "error"));
register("L04_CAUSE_DISCARDED", () => secretProbe("nested-cause-secret", "cause"));
register("L05_CRLF_NEUTRALIZED", () => assert.equal(/[\r\n]/.test(sanitizeLogText("safe\r\nforged")), false));
register("L06_ANSI_NEUTRALIZED", () => {
  const sanitized = sanitizeLogText("safe\u001b[31mforged");
  assert.equal(sanitized.includes("\u001b"), false);
  assert.equal(sanitized.includes("[31m"), false);
});
register("L07_CONTROL_NEUTRALIZED", () => assert.equal(/[\u0000-\u001f\u007f]/.test(sanitizeLogText("safe\u0000forged")), false));
register("L08_PAYLOAD_SIZE_BOUND", () => {
  const contract = getErrorRedactionContract();
  assert.equal(contract.maxLogPayloadBytes, 1024);
  assert.equal(contract.maxLogTextLength, 96);
  const payload = createSafeLogEvent({ event: "analysis_failed", model: "x".repeat(200_000) });
  assert.ok(new TextEncoder().encode(JSON.stringify(payload)).byteLength <= contract.maxLogPayloadBytes);
});
register("L09_S2_FIELD_DISCARDED", () => secretProbe("user-profile-secret", "userId"));
register("L10_S3_FIELD_DISCARDED", () => secretProbe("token-secret", "token"));
register("L11_S4_FIELD_DISCARDED", () => secretProbe("completion-secret", "completion"));
register("L12_SINK_FAILURE_ISOLATED", () => assert.doesNotThrow(() => writeSafeLog("error", { event: "analysis_failed" }, { get error() { throw new Error("sink-secret"); } })));

register("M01_STRUCTURED_LOG_MODEL_CREDENTIAL_REJECTED", () => {
  assert.equal(Object.isFrozen(SAFE_PROVIDER_MODELS), true);
  assert.deepEqual([...SAFE_PROVIDER_MODELS].sort(), ["gpt-4o", "gpt-4o-mini"]);

  for (const model of SAFE_PROVIDER_MODELS) {
    assert.equal(createSafeLogEvent({ event: "provider_runtime", model }).model, model);
  }

  const rejectedModels = [
    "GPT-4O-MINI",
    "gpt-4o-mini-custom",
    "unknown-model",
    "sk-SEC12_FAKE_MODEL_SECRET",
    "sk-proj-SEC12_FAKE_MODEL_SECRET",
    "eyJhbGciOiJIUzI1NiJ9.SEC12_FAKE_PAYLOAD.SEC12_FAKE_SIGNATURE",
    "Bearer SEC12_FAKE_TOKEN",
    "Cookie: sb-access-token=SEC12_FAKE_COOKIE",
    "oauth_code=SEC12_FAKE_OAUTH_CODE",
    "gpt-4o-mini\r\nAuthorization: Bearer SEC12_FAKE_TOKEN",
    "gpt-4o-mini\u001b[31mSEC12_FAKE_ANSI",
    "m".repeat(10_000)
  ];

  for (const model of rejectedModels) {
    const central = createSafeLogEvent({ event: "provider_runtime", model });
    assert.equal(Object.hasOwn(central, "model"), false, `central logger retained rejected model: ${model.slice(0, 24)}`);

    const descriptor = buildProviderRuntimeLogEvent({
      stage: "photo-evidence",
      status: 503,
      ok: false,
      provider: "openai",
      model,
      durationMs: 10
    });
    assert.equal(descriptor.model, "unknown");

    const captured = [];
    logProviderRuntimeEvent({ ok: false, provider: "openai", model }, {
      warn(label, payload) {
        captured.push({ label, payload });
      }
    });
    const serialized = JSON.stringify(captured);
    assert.equal(serialized.includes(model), false);
    assert.equal(Object.hasOwn(captured[0].payload, "model"), false);
  }

  const contract = getErrorRedactionContract();
  assert.deepEqual(contract.safeProviderModels, SAFE_PROVIDER_MODELS);
  assert.ok(new TextEncoder().encode(JSON.stringify(createSafeLogEvent({
    event: "provider_runtime",
    model: "m".repeat(10_000)
  }))).byteLength <= contract.maxLogPayloadBytes);
});

register("M02_ANALYZE_LOG_STAGE_SEVERITY_CONTRACT", async () => {
  assert.equal(Object.isFrozen(ANALYZE_LOG_STAGE_POLICIES), true);
  assert.ok(ANALYZE_LOG_STAGE_POLICIES.every((policy) => Object.isFrozen(policy)));

  const stages = ANALYZE_LOG_STAGE_POLICIES.map((policy) => policy.stage);
  assert.equal(stages.length, 14);
  assert.equal(new Set(stages).size, stages.length);

  for (const policy of ANALYZE_LOG_STAGE_POLICIES) {
    const event = createAnalyzeLogEvent(policy.stage);
    assert.equal(event.event, policy.event);
    assert.equal(event.category, policy.category);
    assert.equal(event.severity, policy.severity);
    assert.equal(event.dependency, policy.dependency);
    assert.equal(event.retryable, policy.retryable);
    assert.equal(Object.hasOwn(event, "stage"), false);
  }

  assert.deepEqual(createAnalyzeLogEvent("openai-env:diagnostic"), {
    event: "analysis_diagnostic",
    category: "configuration_state",
    severity: "info",
    operation: "analysis",
    dependency: "application",
    retryable: false
  });
  assert.deepEqual(createAnalyzeLogEvent("request:error"), {
    event: "analysis_failed",
    category: "internal_error",
    severity: "error",
    operation: "analysis",
    dependency: "application",
    retryable: true
  });

  const unknownStage = "SEC12_RAW_UNKNOWN_STAGE";
  const unknownEvent = createAnalyzeLogEvent(unknownStage);
  assert.equal(JSON.stringify(unknownEvent).includes(unknownStage), false);
  assert.equal(unknownEvent.event, "analysis_failed");
  assert.equal(unknownEvent.category, "internal_error");

  const source = await readSource(sourcePaths.analyze);
  const callerStages = [...source.matchAll(/logAnalyze\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(callerStages.length, 15);
  assert.deepEqual([...new Set(callerStages)].sort(), [...stages].sort());
  assert.match(source, /const event = createAnalyzeLogEvent\(stage\);/);
  assert.doesNotMatch(source, /function logAnalyze\(stage\s*,\s*payload/);
  assert.doesNotMatch(source, /logAnalyze\(\s*["'][^"']+["']\s*,/);
});

register("I01_TRACK_PUBLIC_RESPONSE", async () => {
  const source = await readSource(sourcePaths.track);
  assert.match(source, /tracking_unavailable/);
  assert.doesNotMatch(source, /message:\s*error\?\.message|error:\s*error\?\.message/);
});
register("I02_TRACK_SAFE_LOG", async () => {
  const source = await readSource(sourcePaths.track);
  assert.match(source, /writeSafeLog\(/);
  assertSafeLoggerArguments(source, sourcePaths.track);
  assert.doesNotMatch(source, /unsafeLog\(/);
  assert.doesNotMatch(source, /console\.(?:error|warn|log)\(/);
});
register("I03_SAVE_REPORT_PUBLIC_RESPONSE", async () => {
  const source = await readSource(sourcePaths.saveReport);
  assert.match(source, /save_report_unavailable/);
  assert.doesNotMatch(source, /serializeSupabaseError|error\?\.message/);
});
register("I04_SAVE_REPORT_SAFE_LOG", async () => {
  const source = await readSource(sourcePaths.saveReport);
  assert.match(source, /writeSafeLog\(/);
  assertSafeLoggerArguments(source, sourcePaths.saveReport);
  assert.doesNotMatch(source, /unsafeLog\(/);
  assert.doesNotMatch(source, /console\.(?:error|warn|log)\(/);
});
register("I05_AUTH_CALLBACK_SAFE_LOG", async () => {
  const source = await readSource(sourcePaths.authCallback);
  assert.match(source, /writeSafeLog\(/);
  assertSafeLoggerArguments(source, sourcePaths.authCallback);
  assert.doesNotMatch(source, /unsafeLog\(/);
  assert.doesNotMatch(source, /cookieDiagnostics|serializeSupabaseError|console\.(?:error|warn|log)\(/);
});
register("I06_PROVIDER_ADAPTER_DELEGATION", () => {
  const captured = [];
  const event = logProviderRuntimeEvent({ ok: false, prompt: "provider-secret" }, { warn(label, payload) { captured.push({ label, payload }); } });
  assert.equal(event.ok, false);
  assert.equal(captured.length, 1);
  assert.doesNotMatch(JSON.stringify(event), /provider-secret/);
  assert.doesNotMatch(JSON.stringify(captured), /provider-secret/);
  assert.doesNotMatch(JSON.stringify(buildProviderRuntimeLogEvent({ ok: false, responseBody: "provider-secret" })), /provider-secret/);
});
register("I07_SUPABASE_HELPERS_SAFE_LOG", async () => {
  const profileSource = await readSource(sourcePaths.profileUpsert);
  assert.match(profileSource, /classifyUnknownError\(/);
  assert.doesNotMatch(profileSource, /console\.(?:error|warn|log)\(/);

  for (const path of [sourcePaths.browserSupabase, sourcePaths.serverSupabase]) {
    const source = await readSource(path);
    assert.match(source, /writeSafeLog\(/, `${path} must use the central safe logger`);
    assertSafeLoggerArguments(source, path);
    assert.doesNotMatch(source, /console\.(?:error|warn|log)\(/, `${path} must not use raw console logging`);
  }
});
register("I08_CLIENT_ERROR_MAPPER", async () => {
  const source = await readSource(sourcePaths.saveReportCta);
  assert.match(source, /getSafePublicErrorMessage\(/);
  assert.doesNotMatch(source, /data\?\.(?:message|details|hint)\s*\|\||data\?\.error\s*\|\|/);
});
register("I09_CLIENT_CONSOLE_BOUNDARY", async () => {
  for (const path of clientBoundaryPaths) {
    const source = await readSource(path);
    assert.doesNotMatch(source, /console\.(?:error|warn|log)\(/, `${path} must not log raw client errors`);
  }
});
register("I10_SENSITIVE_ROUTE_NO_STORE", async () => {
  const result = await assertSensitiveRouteIntegrationExactSet();
  assert.deepEqual(result.routes, { expected: 11, discovered: 11, verified: 11 });
  assert.deepEqual(result.handlerBindings, { expected: 12, discovered: 12, verified: 12 });
  assert.deepEqual(result.terminalResponsePaths, { expected: 125, discovered: 125, verified: 125 });
  assert.deepEqual(result.pureMatrix, { positive: 2, negative: 17, rejected: 17 });
  assert.equal(result.deadHelperCalls, 0);
  assert.equal(result.unsafeResponsePaths, 0);
  assert.equal(result.unresolvedResponsePaths, 0);
  console.log(JSON.stringify({ sec12I10: result }));
});

assert.equal(Object.isFrozen(REQUIRED_CASE_IDS), true);
assert.equal(REQUIRED_CASE_IDS.length, EXPECTED_REQUIRED_CASE_COUNT);
assert.equal(new Set(REQUIRED_CASE_IDS).size, EXPECTED_REQUIRED_CASE_COUNT);
assert.equal(catalog.size, EXPECTED_REQUIRED_CASE_COUNT);
assert.deepEqual([...catalog.keys()].sort(), [...REQUIRED_CASE_IDS].sort());

for (const [prefix, expected] of Object.entries(EXPECTED_GROUP_COUNTS)) {
  assert.equal(REQUIRED_CASE_IDS.filter((id) => id.startsWith(prefix)).length, expected);
}

for (const id of REQUIRED_CASE_IDS) {
  assert.equal(observed.has(id), false, `SEC-12 case executed more than once: ${id}`);
  await catalog.get(id)();
  observed.set(id, 1);
  console.log(JSON.stringify({ caseId: id, status: "PASS" }));
}

assert.equal(observed.size, EXPECTED_REQUIRED_CASE_COUNT);
assert.deepEqual([...observed.keys()].sort(), [...REQUIRED_CASE_IDS].sort());
assert.ok([...observed.values()].every((count) => count === 1));

console.log(`SEC12_REQUIRED_CASES=${observed.size}/${EXPECTED_REQUIRED_CASE_COUNT}`);
console.log(`SEC12_ERROR_LOG_BOUNDARY=PASS ${observed.size}/${EXPECTED_REQUIRED_CASE_COUNT}`);
