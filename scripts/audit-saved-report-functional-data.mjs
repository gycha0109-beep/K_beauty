import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import { buildCurrentProductFindings } from "../lib/current-product-findings.js";
import { resolveProductFunctionalProfile } from "../lib/product-functional-profile.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LIMIT = 30;
const RELATIONS = [
  "supports_goal",
  "different_goal",
  "duplicate_axis",
  "not_evaluable",
  "empty_slot",
  "unknown_usage"
];
const TRACKED_FIELDS = [
  "ingredient_signals",
  "ingredient_signals.functional",
  "category",
  "product id",
  "irritation_risk",
  "sensitivity_safe"
];
const PRIORITY_AXIS_TO_PLAN = {
  barrier: { primaryGoal: "barrier_redness", functionalDirection: "soothing" },
  redness: { primaryGoal: "barrier_redness", functionalDirection: "soothing" },
  dehydration: { primaryGoal: "dehydration", functionalDirection: "hydration" },
  oiliness: { primaryGoal: "oil_acne", functionalDirection: "acne_care" },
  acne: { primaryGoal: "oil_acne", functionalDirection: "acne_care" },
  pores: { primaryGoal: "pores_texture", functionalDirection: "exfoliation" },
  uneven_tone: { primaryGoal: "uneven_tone", functionalDirection: "tone_care" },
  uv: { primaryGoal: "protection", functionalDirection: "sunscreen_protection" }
};

function loadEnv() {
  dotenv.config({ path: path.join(ROOT_DIR, ".env.local"), quiet: true });
  dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });
}

function getLimit() {
  const arg = process.argv.find((item) => item.startsWith("--limit="));
  const value = Number.parseInt(arg?.split("=")[1] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LIMIT;
}

function createSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl.startsWith("http") ? supabaseUrl : `https://${supabaseUrl}`, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function emptyRelationCounts() {
  return Object.fromEntries(RELATIONS.map((relation) => [relation, 0]));
}

function emptyFieldCounts() {
  return Object.fromEntries(TRACKED_FIELDS.map((field) => [field, 0]));
}

function increment(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

function percent(count, total) {
  return total ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function pctText(count, total) {
  return `${count}/${total} (${percent(count, total)}%)`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCategory(category) {
  const value = normalizeText(category);
  return value || "missing";
}

function getSelections(currentProducts) {
  if (Array.isArray(currentProducts)) {
    return currentProducts;
  }

  if (Array.isArray(currentProducts?.selections)) {
    return currentProducts.selections;
  }

  return [];
}

function getSnapshot(selection) {
  return selection?.productSnapshot || selection?.product || null;
}

function getProductId(selection, snapshot) {
  return normalizeText(snapshot?.id || selection?.productId || selection?.product_id);
}

function getCategory(selection, snapshot) {
  return normalizeCategory(snapshot?.category || selection?.category);
}

function getIngredientSignals(snapshot) {
  return snapshot?.ingredient_signals && typeof snapshot.ingredient_signals === "object"
    ? snapshot.ingredient_signals
    : null;
}

function hasFunctionalSignals(snapshot) {
  const signals = getIngredientSignals(snapshot);
  return Array.isArray(signals?.functional) && signals.functional.length > 0;
}

function classifySnapshot(selection) {
  const snapshot = getSnapshot(selection);

  if (!snapshot || typeof snapshot !== "object") {
    return "no_snapshot";
  }

  const hasIdentity = Boolean(
    getProductId(selection, snapshot) ||
      normalizeText(snapshot.brand || snapshot.brandName) ||
      normalizeText(snapshot.name || snapshot.productName) ||
      normalizeText(snapshot.category || selection?.category)
  );
  const hasRichFields = Boolean(
    getIngredientSignals(snapshot) ||
      snapshot.review_signals ||
      snapshot.market_signals ||
      snapshot.irritation_risk != null ||
      snapshot.sensitivity_safe != null ||
      snapshot.skin_types ||
      snapshot.concerns
  );

  if (hasRichFields) {
    return "rich_snapshot";
  }

  return hasIdentity ? "thin_identity_snapshot" : "unknown_snapshot";
}

function resolvePlan(report) {
  const freeResult = report?.freeResult && typeof report.freeResult === "object"
    ? report.freeResult
    : {};
  const axis = normalizeText(
    freeResult?.priority?.axis ||
      freeResult?.priority?.concern ||
      freeResult?.mainConcern
  );
  const mapped = PRIORITY_AXIS_TO_PLAN[axis];

  if (mapped) {
    return { ...mapped, source: `freeResult.priority:${axis}` };
  }

  const decision = Array.isArray(report?.functionalDecisions)
    ? report.functionalDecisions.find((item) => item?.primaryGoal || item?.functionalDirection)
    : null;

  return {
    primaryGoal: normalizeText(decision?.primaryGoal) || "pores_texture",
    functionalDirection: normalizeText(decision?.functionalDirection) || "exfoliation",
    source: decision ? "functionalDecisions" : "fallback:pores_texture/exfoliation"
  };
}

function evaluateSelection(selection) {
  const snapshot = getSnapshot(selection);
  const category = getCategory(selection, snapshot);
  const productId = getProductId(selection, snapshot);
  const profile = snapshot && typeof snapshot === "object"
    ? resolveProductFunctionalProfile({
        ...snapshot,
        id: snapshot.id || selection.productId || selection.product_id,
        category: snapshot.category || selection.category
      })
    : null;
  const fieldPresence = {
    "ingredient_signals": Boolean(getIngredientSignals(snapshot)),
    "ingredient_signals.functional": hasFunctionalSignals(snapshot),
    "category": category !== "missing",
    "product id": Boolean(productId),
    "irritation_risk": snapshot?.irritation_risk != null,
    "sensitivity_safe": snapshot?.sensitivity_safe != null
  };

  return {
    snapshot,
    category,
    productId,
    profile,
    fieldPresence,
    snapshotClass: classifySnapshot(selection)
  };
}

function getNotEvaluableCause(selection, evaluation) {
  if (selection?.status !== "selected") {
    return selection?.status === "not_in_db"
      ? "not_in_db 상태"
      : selection?.status === "not_using"
        ? "not_using 상태"
        : "unanswered 상태";
  }

  if (!evaluation.snapshot || typeof evaluation.snapshot !== "object") {
    return "selected인데 product snapshot 없음";
  }

  if (!evaluation.fieldPresence["ingredient_signals"]) {
    return evaluation.snapshotClass === "thin_identity_snapshot"
      ? "selected인데 product snapshot 자체가 얇음"
      : "selected인데 ingredient_signals 없음";
  }

  if (!evaluation.fieldPresence["ingredient_signals.functional"]) {
    return "selected인데 ingredient_signals.functional 없음";
  }

  if (!evaluation.fieldPresence.category) {
    return "category 없음";
  }

  if (evaluation.profile?.unknownFunctionalLabels?.length && !evaluation.profile?.functionalAxes?.length) {
    return "알 수 없는 functional label만 존재";
  }

  return "functional axis 매핑 불가";
}

function analyzeRows(rows) {
  const totals = {
    reports: rows.length,
    reportsWithCurrentProducts: 0,
    reportsWithSelected: 0,
    selectedProducts: 0,
    selectedReportsRecentHalf: { reports: 0, selected: 0, rich: 0, thin: 0 },
    selectedReportsOldHalf: { reports: 0, selected: 0, rich: 0, thin: 0 },
    fieldCounts: emptyFieldCounts(),
    resolverEvaluableTrue: 0,
    resolverEvaluableFalse: 0,
    relationCounts: emptyRelationCounts(),
    category: {},
    snapshotClass: {},
    currentProductsShape: {},
    notEvaluableCauses: {},
    planSources: {}
  };

  rows.forEach((row, index) => {
    const report = row.premium_report && typeof row.premium_report === "object"
      ? row.premium_report
      : {};
    const currentProducts = report.currentProducts;
    const selections = getSelections(currentProducts);
    const halfBucket = index < Math.ceil(rows.length / 2)
      ? totals.selectedReportsRecentHalf
      : totals.selectedReportsOldHalf;

    halfBucket.reports += 1;
    increment(
      totals.currentProductsShape,
      Array.isArray(currentProducts)
        ? "array"
        : currentProducts && typeof currentProducts === "object" && Array.isArray(currentProducts.selections)
          ? "object_with_selections"
          : currentProducts == null
            ? "missing"
            : typeof currentProducts
    );

    if (selections.length) {
      totals.reportsWithCurrentProducts += 1;
    }

    const selectedSelections = selections.filter((selection) => selection?.status === "selected");
    if (selectedSelections.length) {
      totals.reportsWithSelected += 1;
    }

    const plan = resolvePlan(report);
    increment(totals.planSources, plan.source);

    const findings = buildCurrentProductFindings({
      currentProducts,
      primaryGoal: plan.primaryGoal,
      functionalDirection: plan.functionalDirection
    });

    findings.findings.forEach((finding) => {
      increment(totals.relationCounts, finding.relationToPlan || "unknown_usage");
    });

    selections.forEach((selection) => {
      const status = normalizeText(selection?.status);
      const snapshot = getSnapshot(selection);
      const category = getCategory(selection, snapshot);

      if (!totals.category[category]) {
        totals.category[category] = {
          selected: 0,
          fieldCounts: emptyFieldCounts(),
          resolverEvaluableTrue: 0,
          resolverEvaluableFalse: 0
        };
      }

      if (status !== "selected") {
        if (status === "not_in_db" || status === "unanswered") {
          increment(totals.notEvaluableCauses, getNotEvaluableCause(selection, {}));
        }
        return;
      }

      const evaluation = evaluateSelection(selection);
      totals.selectedProducts += 1;
      halfBucket.selected += 1;
      increment(totals.snapshotClass, evaluation.snapshotClass);

      if (evaluation.snapshotClass === "rich_snapshot") {
        halfBucket.rich += 1;
      }
      if (evaluation.snapshotClass === "thin_identity_snapshot") {
        halfBucket.thin += 1;
      }

      totals.category[category].selected += 1;

      for (const [field, present] of Object.entries(evaluation.fieldPresence)) {
        if (present) {
          totals.fieldCounts[field] += 1;
          totals.category[category].fieldCounts[field] += 1;
        }
      }

      if (evaluation.profile?.evaluable) {
        totals.resolverEvaluableTrue += 1;
        totals.category[category].resolverEvaluableTrue += 1;
      } else {
        totals.resolverEvaluableFalse += 1;
        totals.category[category].resolverEvaluableFalse += 1;
        increment(totals.notEvaluableCauses, getNotEvaluableCause(selection, evaluation));
      }
    });
  });

  return totals;
}

function formatCategoryTable(categoryStats) {
  const rows = Object.entries(categoryStats)
    .filter(([, stats]) => stats.selected > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, stats]) => ({
      category,
      selected: stats.selected,
      ingredientSignalsFunctional: pctText(stats.fieldCounts["ingredient_signals.functional"], stats.selected),
      evaluable: pctText(stats.resolverEvaluableTrue, stats.selected),
      categoryField: pctText(stats.fieldCounts.category, stats.selected)
    }));

  return rows;
}

function makeMarkdown(summary, limit) {
  const categoryRows = formatCategoryTable(summary.category);
  const lines = [
    "# Saved Report Functional Data Audit",
    "",
    `- Scope: latest ${limit} premium saved reports available to read-only query`,
    `- Saved reports inspected: ${summary.reports}`,
    `- Reports with currentProducts: ${summary.reportsWithCurrentProducts}`,
    `- Reports with selected products: ${summary.reportsWithSelected}`,
    `- Selected products: ${summary.selectedProducts}`,
    "",
    "## Selected Product Field Coverage",
    "",
    ...TRACKED_FIELDS.map((field) => `- ${field}: ${pctText(summary.fieldCounts[field], summary.selectedProducts)}`),
    "",
    "## Resolver Evaluable",
    "",
    `- evaluable true: ${pctText(summary.resolverEvaluableTrue, summary.selectedProducts)}`,
    `- evaluable false: ${pctText(summary.resolverEvaluableFalse, summary.selectedProducts)}`,
    "",
    "## Finding relationToPlan Distribution",
    "",
    ...RELATIONS.map((relation) => `- ${relation}: ${summary.relationCounts[relation] || 0}`),
    "",
    "## Category Functional Coverage",
    "",
    "| category | selected | ingredient_signals.functional | resolver evaluable | category field |",
    "|---|---:|---:|---:|---:|",
    ...categoryRows.map((row) => (
      `| ${row.category} | ${row.selected} | ${row.ingredientSignalsFunctional} | ${row.evaluable} | ${row.categoryField} |`
    )),
    "",
    "## Snapshot Shape",
    "",
    ...Object.entries(summary.snapshotClass).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## CurrentProducts Shape",
    "",
    ...Object.entries(summary.currentProductsShape).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Recent vs Older Half",
    "",
    `- recent half: selected ${summary.selectedReportsRecentHalf.selected}, rich ${summary.selectedReportsRecentHalf.rich}, thin ${summary.selectedReportsRecentHalf.thin}`,
    `- older half: selected ${summary.selectedReportsOldHalf.selected}, rich ${summary.selectedReportsOldHalf.rich}, thin ${summary.selectedReportsOldHalf.thin}`,
    "",
    "## Not Evaluable Causes",
    "",
    ...Object.entries(summary.notEvaluableCauses)
      .sort(([, left], [, right]) => right - left)
      .map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Plan Source",
    "",
    ...Object.entries(summary.planSources).map(([key, value]) => `- ${key}: ${value}`)
  ];

  return `${lines.join("\n")}\n`;
}

async function main() {
  loadEnv();
  const limit = getLimit();
  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("saved_reports")
    .select("created_at, report_type, premium_report")
    .eq("report_type", "premium")
    .not("premium_report", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Saved report read failed: ${error.message}`);
  }

  const summary = analyzeRows(data || []);
  const outputDir = path.join(ROOT_DIR, "tmp", "audits");
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "saved-report-functional-data-summary.json");
  const mdPath = path.join(outputDir, "saved-report-functional-data-summary.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(mdPath, makeMarkdown(summary, limit));

  console.log(JSON.stringify({
    reports: summary.reports,
    reportsWithSelected: summary.reportsWithSelected,
    selectedProducts: summary.selectedProducts,
    ingredientSignals: summary.fieldCounts["ingredient_signals"],
    ingredientSignalsFunctional: summary.fieldCounts["ingredient_signals.functional"],
    resolverEvaluableTrue: summary.resolverEvaluableTrue,
    resolverEvaluableFalse: summary.resolverEvaluableFalse,
    relationCounts: summary.relationCounts,
    snapshotClass: summary.snapshotClass,
    output: {
      json: path.relative(ROOT_DIR, jsonPath),
      markdown: path.relative(ROOT_DIR, mdPath)
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
