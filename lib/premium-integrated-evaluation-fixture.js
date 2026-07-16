const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
export const ASSERTION_OPERATORS = Object.freeze(["equals","not_equals","includes","excludes","exists","not_exists","length_equals","greater_than","greater_than_or_equal","less_than","less_than_or_equal","subset","array_contains_subset"]);
export const CROSS_LANE_RULES = Object.freeze(["DATA_DECISION_ACTIVE_AXIS_ALIGNMENT","DATA_DECISION_UNKNOWN_ALIGNMENT","DATA_DECISION_CATEGORY_ALIGNMENT","DATA_DECISION_SUNSCREEN_ALIGNMENT","PRODUCT_REFERENCE_ALIGNMENT"]);
export const INVARIANTS = Object.freeze(["BUNDLE_VERSION","BUNDLE_LINEAGE","NO_REDUNDANT_EFFECTIVE_POLICIES","RAW_POLICY_IMMUTABILITY","PROTECTION_MUST_MAINTAIN","FALLBACK_PROJECTION_ENFORCEMENT","UNKNOWN_PRODUCT_NON_CAUSATION","PRODUCT_CAUSATION_EVIDENCE","DETERMINISM","INPUT_IMMUTABILITY"]);
export const MANDATORY_SCENARIO_IDS = Object.freeze(["S01_STABLE_BASELINE","S02_SENSITIVE_WITHOUT_ACTIVE_BURDEN","S03_SENSITIVE_WITH_ACTIVE_TREATMENT","S04_DUPLICATE_ACTIVE_AXIS","S05_UNKNOWN_NOT_IN_DB_PRODUCT","S06_SELECTED_NON_EVALUABLE_PRODUCT","S07_RECENT_SKIN_CHANGE_NO_PRODUCT_EVIDENCE","S08_CONFIRMED_PRODUCT_REACTION","S09_CLEANSER_WITH_ACTIVE_LABEL","S10_LEGACY_SERUM_CATEGORY","S11_COMPLETE_SUNSCREEN","S12_PARTIAL_SUNSCREEN_METADATA","S13_INCOMPLETE_PERSISTED_SURVEY_RAW_SOURCE","S14_STABILIZATION_FALLBACK_BYPASS_ATTEMPT","S15_LOCALE_PARITY","S16_REBUILD_REVISION"]);
const EXPECTED_KEYS = new Set(["dataAudit","context","rawPolicies","consistency","effectivePolicies","projections","decisionBundle","crossLaneRules","invariants","forbiddenInvariants"]);
const SCENARIO_KEYS = new Set(["id","logicalScenarioId","variant","title","description","tags","catalogProducts","report","options","expected","revisions"]);
const MANIFEST_KEYS = new Set(["version","scenarios","comparisons"]);
const COMPARISON_TYPES = new Set(["locale_structural_parity","scenario_structural_equality","scenario_structural_difference"]);

export function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
export function validatePathSyntax(path) {
  if (typeof path !== "string" || !path || path.startsWith(".") || path.endsWith(".") || path.includes("..") || /[\[\]*]/.test(path)) return false;
  return path.split(".").every((segment) => segment && !FORBIDDEN.has(segment) && (/^\d+$/.test(segment) || /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(segment)));
}
export function getPath(root, path) {
  let current = root;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(Object(current), segment)) return { exists: false, value: undefined };
    current = current[segment];
  }
  return { exists: true, value: current };
}
function failure(code, message, path = null) { return { code, stage: "fixture", severity: "critical", path, expected: null, actual: null, message }; }
function validateAssertion(assertion, path) {
  const out = [];
  if (!isPlainObject(assertion)) return [failure("FIXTURE_ASSERTION_INVALID", "Assertion must be a plain object", path)];
  if (!validatePathSyntax(assertion.path)) out.push(failure("FIXTURE_PATH_INVALID", "Assertion path syntax is invalid", assertion.path || path));
  if (!ASSERTION_OPERATORS.includes(assertion.operator)) out.push(failure("FIXTURE_OPERATOR_INVALID", "Unsupported assertion operator", assertion.path || path));
  const noExpected = ["exists", "not_exists"].includes(assertion.operator);
  if (!noExpected && !Object.prototype.hasOwnProperty.call(assertion, "expected")) out.push(failure("FIXTURE_EXPECTED_MISSING", "Expected value is required", assertion.path || path));
  return out;
}
function normalizeFunctional(value) { return JSON.stringify((value?.functional || []).map((x) => ({ label: String(x?.label || "").trim().toLowerCase(), count: Number(x?.count || 0) })).sort((a,b)=>a.label.localeCompare(b.label))); }
function validateProductAlignment(scenario) {
  const out = [];
  const catalog = new Map((scenario.catalogProducts || []).map((p) => [String(p?.id || ""), p]));
  const selections = Array.isArray(scenario.report?.currentProducts) ? scenario.report.currentProducts : scenario.report?.currentProducts?.selections || [];
  for (const selection of selections) {
    const snap = selection?.productSnapshot || selection?.product;
    const id = String(snap?.id || selection?.productId || selection?.product_id || "");
    if (!id || !catalog.has(id) || !snap) continue;
    const raw = catalog.get(id);
    for (const key of ["category","product_form","sensitivity_safe","irritation_risk","spf_value","uva_label","uv_filter_type"]) {
      if (Object.prototype.hasOwnProperty.call(raw,key) && Object.prototype.hasOwnProperty.call(snap,key) && JSON.stringify(raw[key]) !== JSON.stringify(snap[key])) out.push(failure("FIXTURE_PRODUCT_CONFLICT", `Catalog/report conflict for ${id}.${key}`, `catalogProducts.${id}.${key}`));
    }
    if (raw.ingredient_signals && snap.ingredient_signals && normalizeFunctional(raw.ingredient_signals) !== normalizeFunctional(snap.ingredient_signals)) out.push(failure("FIXTURE_PRODUCT_CONFLICT", `Catalog/report functional signals conflict for ${id}`, `catalogProducts.${id}.ingredient_signals.functional`));
  }
  return out;
}
export function validateFixtureManifest(manifest) {
  const failures = [];
  if (!isPlainObject(manifest)) return [failure("FIXTURE_MANIFEST_INVALID", "Manifest must be a plain object")];
  for (const key of Object.keys(manifest)) if (!MANIFEST_KEYS.has(key)) failures.push(failure("FIXTURE_MANIFEST_KEY_UNKNOWN", `Unknown manifest key: ${key}`));
  if (manifest.version !== "premium-integrated-evaluation-fixtures-v1") failures.push(failure("FIXTURE_VERSION_INVALID", "Unsupported fixture manifest version"));
  if (!Array.isArray(manifest.scenarios) || !manifest.scenarios.length) return [...failures, failure("FIXTURE_SCENARIOS_EMPTY", "Scenarios must be a non-empty array")];
  const ids = new Set(), variants = new Set(), logical = new Set();
  for (const scenario of manifest.scenarios) {
    if (!isPlainObject(scenario)) { failures.push(failure("FIXTURE_SCENARIO_INVALID", "Scenario must be a plain object")); continue; }
    for (const key of Object.keys(scenario)) if (!SCENARIO_KEYS.has(key)) failures.push(failure("FIXTURE_SCENARIO_KEY_UNKNOWN", `Unknown scenario key: ${key}`, scenario.id || null));
    if (!scenario.id || ids.has(scenario.id)) failures.push(failure("FIXTURE_SCENARIO_ID_INVALID", `Missing or duplicate scenario id: ${scenario.id || "<missing>"}`)); else ids.add(scenario.id);
    const logicalId = scenario.logicalScenarioId || scenario.id;
    logical.add(logicalId);
    const variantKey = `${logicalId}|${scenario.variant || "default"}`;
    if (variants.has(variantKey)) failures.push(failure("FIXTURE_VARIANT_DUPLICATE", `Duplicate logical scenario variant: ${variantKey}`)); else variants.add(variantKey);
    if (!scenario.title || !scenario.description || !Array.isArray(scenario.tags) || !isPlainObject(scenario.report) || !isPlainObject(scenario.expected || {})) failures.push(failure("FIXTURE_SCENARIO_SHAPE_INVALID", `Invalid scenario shape: ${scenario.id || "<missing>"}`));
    if (scenario.catalogProducts !== undefined && !Array.isArray(scenario.catalogProducts)) failures.push(failure("FIXTURE_CATALOG_INVALID", "catalogProducts must be an array", scenario.id));
    if (scenario.options?.locale && !["ko","en"].includes(scenario.options.locale)) failures.push(failure("FIXTURE_LOCALE_INVALID", "Unsupported locale", scenario.id));
    for (const key of Object.keys(scenario.expected || {})) if (!EXPECTED_KEYS.has(key)) failures.push(failure("FIXTURE_EXPECTED_KEY_UNKNOWN", `Unknown expected key: ${key}`, scenario.id));
    for (const section of ["dataAudit","context","rawPolicies","consistency","effectivePolicies","projections","decisionBundle"]) {
      const assertions = scenario.expected?.[section] || [];
      if (!Array.isArray(assertions)) failures.push(failure("FIXTURE_ASSERTION_LIST_INVALID", `${section} must be an array`, scenario.id));
      else assertions.forEach((a,i)=>failures.push(...validateAssertion(a, `${scenario.id}.${section}.${i}`)));
    }
    for (const id of scenario.expected?.crossLaneRules || []) if (!CROSS_LANE_RULES.includes(id)) failures.push(failure("FIXTURE_CROSS_LANE_UNKNOWN", `Unknown cross-lane rule: ${id}`, scenario.id));
    for (const id of [...(scenario.expected?.invariants || []), ...(scenario.expected?.forbiddenInvariants || [])]) if (!INVARIANTS.includes(id)) failures.push(failure("FIXTURE_INVARIANT_UNKNOWN", `Unknown invariant: ${id}`, scenario.id));
    for (const step of scenario.revisions || []) if (!isPlainObject(step) || !["rebuild_same","replace_current_products","replace_survey_answers","patch_report"].includes(step.operation)) failures.push(failure("FIXTURE_REVISION_INVALID", "Invalid revision step", scenario.id));
    failures.push(...validateProductAlignment(scenario));
  }
  for (const required of MANDATORY_SCENARIO_IDS) if (!logical.has(required)) failures.push(failure("FIXTURE_MANDATORY_SCENARIO_MISSING", `Missing mandatory logical scenario: ${required}`));
  const comparisonIds = new Set();
  for (const comparison of manifest.comparisons || []) {
    if (!isPlainObject(comparison) || !comparison.id || comparisonIds.has(comparison.id)) failures.push(failure("FIXTURE_COMPARISON_INVALID", "Comparison id missing or duplicate")); else comparisonIds.add(comparison.id);
    if (!COMPARISON_TYPES.has(comparison?.type)) failures.push(failure("FIXTURE_COMPARISON_TYPE_INVALID", `Unsupported comparison type: ${comparison?.type || "<missing>"}`, comparison?.id || null));
    if (!ids.has(comparison.leftScenarioId) || !ids.has(comparison.rightScenarioId)) failures.push(failure("FIXTURE_COMPARISON_TARGET_MISSING", `Comparison target missing: ${comparison.id}`));
    for (const path of [...(comparison.equalPaths || []), ...(comparison.differentPaths || []), ...(comparison.ignoredPaths || [])]) if (!validatePathSyntax(path)) failures.push(failure("FIXTURE_PATH_INVALID", "Comparison path syntax is invalid", path));
  }
  return failures;
}
