import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FREE_RESULT_PATH = "app/result/page.js";
const FULL_REPORT_PATH = "app/result/full-report/page.js";

export const SOURCE_PURCHASE_ANCHOR_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: `${FREE_RESULT_PATH}::ProductDecisionCard::featured-top-pick`,
    file: FREE_RESULT_PATH,
    component: "ProductDecisionCard",
    role: "featured-top-pick",
    resolverOrdinal: 0
  }),
  Object.freeze({
    id: `${FREE_RESULT_PATH}::ProductDecisionCard::category-card`,
    file: FREE_RESULT_PATH,
    component: "ProductDecisionCard",
    role: "category-card",
    resolverOrdinal: 1
  }),
  Object.freeze({
    id: `${FREE_RESULT_PATH}::ProductDecisionCard::category-modal`,
    file: FREE_RESULT_PATH,
    component: "ProductDecisionCard",
    role: "category-modal",
    resolverOrdinal: 1
  }),
  Object.freeze({
    id: `${FULL_REPORT_PATH}::TopPickHeroCard::top-pick`,
    file: FULL_REPORT_PATH,
    component: "TopPickHeroCard",
    role: "top-pick",
    resolverOrdinal: 0
  }),
  Object.freeze({
    id: `${FULL_REPORT_PATH}::SupportingProductCard::supporting-product`,
    file: FULL_REPORT_PATH,
    component: "SupportingProductCard",
    role: "supporting-product",
    resolverOrdinal: 0
  }),
  Object.freeze({
    id: `${FULL_REPORT_PATH}::BudgetAlternativeCard::budget-alternative`,
    file: FULL_REPORT_PATH,
    component: "BudgetAlternativeCard",
    role: "budget-alternative",
    resolverOrdinal: 0
  }),
  Object.freeze({
    id: `${FULL_REPORT_PATH}::ProductUsageCard::product-usage`,
    file: FULL_REPORT_PATH,
    component: "ProductUsageCard",
    role: "product-usage",
    resolverOrdinal: 0
  })
]);

export const SOURCE_PURCHASE_ANCHOR_IDS = Object.freeze(
  SOURCE_PURCHASE_ANCHOR_DEFINITIONS.map(({ id }) => id)
);
export const RUNTIME_REACHABLE_PURCHASE_ANCHOR_IDS = Object.freeze([]);
export const RUNTIME_UNREACHABLE_PURCHASE_ANCHOR_IDS = Object.freeze([
  ...SOURCE_PURCHASE_ANCHOR_IDS
]);

const SOURCE_FILE_PATHS = Object.freeze([FREE_RESULT_PATH, FULL_REPORT_PATH]);
const ROUTE_ROOT_COMPONENTS = Object.freeze({
  [FREE_RESULT_PATH]: "ResultPage",
  [FULL_REPORT_PATH]: "FullReportPage"
});
const PURCHASE_HREF_PATTERN = /\b(?:purchaseLink\.href|buy_link|buyLink|purchase_url|purchaseUrl|purchaseHref)\b/;
const RESOLVER_DECLARATION_PATTERN = /\bconst\s+purchaseLink\s*=\s*getPurchaseLinkInfo\s*\(/g;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertExactOrderedSet(actualValues, expectedValues, label) {
  const actualDuplicates = actualValues.filter((value, index) => actualValues.indexOf(value) !== index);
  const expectedDuplicates = expectedValues.filter((value, index) => expectedValues.indexOf(value) !== index);

  assert(actualDuplicates.length === 0, `${label}: duplicate actual ID(s): ${[...new Set(actualDuplicates)].join(",")}`);
  assert(expectedDuplicates.length === 0, `${label}: duplicate expected ID(s): ${[...new Set(expectedDuplicates)].join(",")}`);
  assert(
    JSON.stringify([...actualValues].sort()) === JSON.stringify([...expectedValues].sort()),
    `${label}: exact-set mismatch`
  );
}

function normalizeSource(source) {
  return String(source).replace(/\r\n?/g, "\n");
}

function getOverride(sourceOverrides, file) {
  if (sourceOverrides instanceof Map) {
    return sourceOverrides.has(file) ? sourceOverrides.get(file) : undefined;
  }

  if (sourceOverrides && Object.prototype.hasOwnProperty.call(sourceOverrides, file)) {
    return sourceOverrides[file];
  }

  return undefined;
}

export function readPurchaseAnchorSources({ root = process.cwd(), sourceOverrides = null } = {}) {
  return Object.freeze(Object.fromEntries(SOURCE_FILE_PATHS.map((file) => {
    const override = getOverride(sourceOverrides, file);
    const source = override === undefined
      ? readFileSync(resolve(root, file), "utf8")
      : override;
    return [file, normalizeSource(source)];
  })));
}

function skipQuoted(source, start, quote) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === quote) {
      return index + 1;
    }
  }
  return source.length;
}

function skipComment(source, start) {
  if (source[start + 1] === "/") {
    const end = source.indexOf("\n", start + 2);
    return end === -1 ? source.length : end + 1;
  }
  if (source[start + 1] === "*") {
    const end = source.indexOf("*/", start + 2);
    return end === -1 ? source.length : end + 2;
  }
  return start;
}

function collectTopLevelFunctions(source) {
  const declarations = [];
  const pattern = /^(?:export\s+default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    declarations.push({ name: match[1], start: match.index });
  }

  return declarations.map((declaration, index) => Object.freeze({
    ...declaration,
    end: declarations[index + 1]?.start ?? source.length
  }));
}

function collectComponentCalls(source, start, end) {
  const calls = [];

  for (let index = start; index < end;) {
    const character = source[index];
    if (character === '"' || character === "'" || character === "`") {
      index = skipQuoted(source, index, character);
      continue;
    }
    if (character === "/" && (source[index + 1] === "/" || source[index + 1] === "*")) {
      index = skipComment(source, index);
      continue;
    }
    if (character === "<") {
      const match = /^<([A-Z][A-Za-z0-9_$]*)\b/.exec(source.slice(index));
      if (match) {
        calls.push(match[1]);
        index += match[0].length;
        continue;
      }
    }
    index += 1;
  }

  return [...new Set(calls)];
}

function buildReachableComponents(source, rootComponent) {
  const functions = collectTopLevelFunctions(source);
  const byName = new Map(functions.map((entry) => [entry.name, entry]));
  const graph = new Map(functions.map((entry) => [
    entry.name,
    collectComponentCalls(source, entry.start, entry.end)
  ]));
  const reachable = new Set();
  const pending = [rootComponent];

  assert(byName.has(rootComponent), `route root component missing: ${rootComponent}`);

  while (pending.length) {
    const component = pending.pop();
    if (reachable.has(component)) {
      continue;
    }
    reachable.add(component);
    for (const callee of graph.get(component) || []) {
      if (byName.has(callee) && !reachable.has(callee)) {
        pending.push(callee);
      }
    }
  }

  return { functions, graph, reachable };
}

function collectAnchorOpeningTags(source) {
  const anchors = [];

  for (let start = source.indexOf("<a"); start !== -1; start = source.indexOf("<a", start + 2)) {
    if (!/\s/.test(source[start + 2] || "")) {
      continue;
    }

    let braceDepth = 0;
    let bracketDepth = 0;
    let parenDepth = 0;
    let end = start + 2;

    while (end < source.length) {
      const character = source[end];
      if (character === '"' || character === "'" || character === "`") {
        end = skipQuoted(source, end, character);
        continue;
      }
      if (character === "/" && (source[end + 1] === "/" || source[end + 1] === "*")) {
        end = skipComment(source, end);
        continue;
      }
      if (character === "{") braceDepth += 1;
      if (character === "}") braceDepth -= 1;
      if (character === "[") bracketDepth += 1;
      if (character === "]") bracketDepth -= 1;
      if (character === "(") parenDepth += 1;
      if (character === ")") parenDepth -= 1;
      if (character === ">" && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        end += 1;
        break;
      }
      end += 1;
    }

    assert(end <= source.length && source[end - 1] === ">", `unterminated anchor opening tag at offset ${start}`);
    anchors.push({ start, end, openingTag: source.slice(start, end) });
  }

  return anchors;
}

function getContainingComponent(functions, offset) {
  const candidates = functions.filter(({ start, end }) => start <= offset && offset < end);
  return candidates.at(-1)?.name || null;
}

function extractAttribute(openingTag, name) {
  const expressionMatch = new RegExp(`\\b${name}\\s*=\\s*(\\{[^{}]*\\})`, "s").exec(openingTag);
  if (expressionMatch) {
    return { kind: "expression", value: expressionMatch[1], index: expressionMatch.index };
  }
  const stringMatch = new RegExp(`\\b${name}\\s*=\\s*([\"'])(.*?)\\1`, "s").exec(openingTag);
  if (stringMatch) {
    return { kind: "string", value: stringMatch[2], index: stringMatch.index };
  }
  return null;
}

function classifyAnchorRole(component, openingTag) {
  if (component === "ProductDecisionCard") {
    if (openingTag.includes('result_type: "top_pick"')) return "featured-top-pick";
    if (openingTag.includes('source: "category_pick_modal"')) return "category-modal";
    if (openingTag.includes('result_type: "category_pick"')) return "category-card";
  }

  return {
    TopPickHeroCard: "top-pick",
    SupportingProductCard: "supporting-product",
    BudgetAlternativeCard: "budget-alternative",
    ProductUsageCard: "product-usage"
  }[component] || null;
}

function getLineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function getResolverDeclarationPositions(componentSource) {
  const positions = [];
  RESOLVER_DECLARATION_PATTERN.lastIndex = 0;
  let match;
  while ((match = RESOLVER_DECLARATION_PATTERN.exec(componentSource)) !== null) {
    positions.push(match.index);
  }
  return positions;
}

export function discoverPurchaseAnchors({ root = process.cwd(), sourceOverrides = null } = {}) {
  const sources = readPurchaseAnchorSources({ root, sourceOverrides });
  const discovered = [];
  const reachabilityByFile = new Map();

  for (const file of SOURCE_FILE_PATHS) {
    const source = sources[file];
    const reachability = buildReachableComponents(source, ROUTE_ROOT_COMPONENTS[file]);
    reachabilityByFile.set(file, reachability);

    for (const anchor of collectAnchorOpeningTags(source)) {
      const href = extractAttribute(anchor.openingTag, "href");
      if (!href || !PURCHASE_HREF_PATTERN.test(href.value)) {
        continue;
      }

      const component = getContainingComponent(reachability.functions, anchor.start);
      const role = classifyAnchorRole(component, anchor.openingTag);
      const id = role
        ? `${file}::${component}::${role}`
        : `${file}::${component || "unknown"}::unregistered@${getLineNumber(source, anchor.start)}`;
      const componentEntry = reachability.functions.find(({ name }) => name === component);
      const componentSource = componentEntry ? source.slice(componentEntry.start, componentEntry.end) : "";
      const resolverPositions = getResolverDeclarationPositions(componentSource);
      const relativeAnchorStart = componentEntry ? anchor.start - componentEntry.start : -1;
      const precedingResolverPositions = resolverPositions.filter((position) => position < relativeAnchorStart);
      const resolverOrdinal = precedingResolverPositions.length ? precedingResolverPositions.length - 1 : -1;
      const target = extractAttribute(anchor.openingTag, "target");
      const rel = extractAttribute(anchor.openingTag, "rel");

      discovered.push(Object.freeze({
        id,
        file,
        component,
        role,
        line: getLineNumber(source, anchor.start),
        sourceStart: anchor.start,
        sourceEnd: anchor.end,
        openingTag: anchor.openingTag,
        href,
        target,
        rel,
        resolverOrdinal,
        reachable: Boolean(component && reachability.reachable.has(component))
      }));
    }
  }

  return Object.freeze({
    sources,
    anchors: Object.freeze(discovered),
    reachabilityByFile
  });
}

export function validatePurchaseAnchorDescriptor(descriptor, definition) {
  assert(descriptor.id === definition.id, `${definition.id}: discovered identity mismatch`);
  assert(descriptor.file === definition.file, `${definition.id}: source file mismatch`);
  assert(descriptor.component === definition.component, `${definition.id}: component mismatch`);
  assert(descriptor.role === definition.role, `${definition.id}: context role mismatch`);
  assert(descriptor.href?.kind === "expression", `${definition.id}: href must be a JSX expression`);
  assert(
    /^\{\s*purchaseLink\.href\s*(?:\|\|\s*undefined)?\s*\}$/.test(descriptor.href.value),
    `${definition.id}: href must bind only purchaseLink.href`
  );
  assert(descriptor.target?.kind === "string" && descriptor.target.value === "_blank", `${definition.id}: target must be _blank`);
  assert(descriptor.rel?.kind === "string", `${definition.id}: rel must be a static string`);
  const relTokens = descriptor.rel.value.trim().split(/\s+/).filter(Boolean);
  assert(relTokens.includes("noopener"), `${definition.id}: noopener missing`);
  assert(relTokens.includes("noreferrer"), `${definition.id}: noreferrer missing`);
  assert(new Set(relTokens).size === relTokens.length, `${definition.id}: duplicate rel token`);
  assert(descriptor.resolverOrdinal === definition.resolverOrdinal, `${definition.id}: resolver provenance mismatch`);
  assert(!/\b(?:buy_link|buyLink|purchase_url|purchaseUrl)\b/.test(descriptor.href.value), `${definition.id}: raw purchase URL binding`);
  assert(!/(?:javascript|data|file|blob):|\/\//i.test(descriptor.href.value), `${definition.id}: unsafe literal href`);
  return true;
}

export function verifyPurchaseAnchorContract({
  root = process.cwd(),
  sourceOverrides = null,
  expectedSourceIds = SOURCE_PURCHASE_ANCHOR_IDS,
  expectedReachableIds = RUNTIME_REACHABLE_PURCHASE_ANCHOR_IDS,
  expectedUnreachableIds = RUNTIME_UNREACHABLE_PURCHASE_ANCHOR_IDS
} = {}) {
  const discovery = discoverPurchaseAnchors({ root, sourceOverrides });
  const discoveredIds = discovery.anchors.map(({ id }) => id);

  assertExactOrderedSet(discoveredIds, expectedSourceIds, "purchase source anchors");

  const definitionById = new Map(SOURCE_PURCHASE_ANCHOR_DEFINITIONS.map((definition) => [definition.id, definition]));
  const verifiedIds = [];
  for (const descriptor of discovery.anchors) {
    const definition = definitionById.get(descriptor.id);
    assert(definition, `${descriptor.id}: unregistered purchase anchor`);
    validatePurchaseAnchorDescriptor(descriptor, definition);
    verifiedIds.push(descriptor.id);
  }
  assertExactOrderedSet(verifiedIds, expectedSourceIds, "verified purchase source anchors");

  const actualReachableIds = discovery.anchors.filter(({ reachable }) => reachable).map(({ id }) => id);
  const actualUnreachableIds = discovery.anchors.filter(({ reachable }) => !reachable).map(({ id }) => id);
  assertExactOrderedSet(actualReachableIds, expectedReachableIds, "runtime-reachable purchase anchors");
  assertExactOrderedSet(actualUnreachableIds, expectedUnreachableIds, "runtime-unreachable purchase anchors");

  const overlap = expectedReachableIds.filter((id) => expectedUnreachableIds.includes(id));
  assert(overlap.length === 0, `reachability partition overlap: ${overlap.join(",")}`);
  assertExactOrderedSet(
    [...expectedReachableIds, ...expectedUnreachableIds],
    expectedSourceIds,
    "purchase anchor reachability partition"
  );

  return Object.freeze({
    expectedSourceCount: expectedSourceIds.length,
    discoveredSourceCount: discoveredIds.length,
    verifiedSourceCount: verifiedIds.length,
    reachableCount: actualReachableIds.length,
    unreachableCount: actualUnreachableIds.length,
    anchors: discovery.anchors,
    sources: discovery.sources
  });
}
