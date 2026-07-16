import fs from "node:fs";
import path from "node:path";

import { buildProductDataSufficiencyAudit } from "../lib/product-data-sufficiency-audit.js";

const OUTPUT_FILES = [
  "summary.json",
  "products.json",
  "category-summary.json",
  "axis-summary.json",
  "field-summary.json",
  "unknown-labels.json",
  "transport-gaps.json",
  "remediation-backlog.json",
  "product-data-sufficiency-report.md",
  "products.csv",
  "gaps.csv",
  "unknown-labels.csv"
];

function parseArgs(argv) {
  const args = { input: "", output: "", force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") args.input = argv[index + 1] || "";
    if (value === "--output") args.output = argv[index + 1] || "";
    if (value === "--force") args.force = true;
    if (["--input", "--output"].includes(value)) index += 1;
  }
  return args;
}

function fail(message) {
  console.error(`[product-data-sufficiency-audit] ${message}`);
  process.exitCode = 1;
}

function readProducts(inputPath) {
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const products = Array.isArray(parsed) ? parsed : parsed?.products;
  if (!Array.isArray(products)) {
    throw new Error("input must be a JSON array or an object containing a products array");
  }
  return products;
}

function csvCell(value) {
  const serialized = value == null
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  const safe = /^[=+\-@]/.test(serialized) ? `'${serialized}` : serialized;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n") + "\n";
}

function percent(numerator, denominator) {
  if (!denominator) return "0 / 0 (0.0%)";
  return `${numerator} / ${denominator} (${((numerator / denominator) * 100).toFixed(1)}%)`;
}

function renderReport(audit) {
  const total = audit.summary.totalProducts;
  const fixtureNotice = audit.dataset.sourceType === "fixture"
    ? "> 이 결과는 fixture 기반이며 실제 제품 DB coverage를 의미하지 않는다.\n\n"
    : "";
  const categoryRows = Object.entries(audit.byCategory)
    .map(([category, item]) =>
      `| ${category} | ${item.total} | ${percent(item.recommendationEligible, item.total)} | ${percent(item.functionalProfileEvaluable, item.total)} | ${percent(item.transportComplete, item.total)} |`
    )
    .join("\n");
  const axisRows = Object.entries(audit.byFunctionalAxis)
    .map(([axis, item]) =>
      `| ${axis} | ${item.productCount} | ${item.highConfidenceCount} | ${item.mediumOrHigherConfidenceCount} |`
    )
    .join("\n");
  const unknownRows = audit.unknownFunctionalLabels.length
    ? audit.unknownFunctionalLabels
      .map((item) => `- \`${item.label}\`: ${item.productCount}개 (${item.sampleProductIds.join(", ")})`)
      .join("\n")
    : "- 없음";
  const transportRows = audit.transportGaps.length
    ? audit.transportGaps
      .map((item) => `- \`${item.fieldPath}\` → ${item.destination}: ${item.affectedCount}개`)
      .join("\n")
    : "- 없음";

  return `# Product Data Sufficiency Audit\n\n${fixtureNotice}` +
    `- Version: \`${audit.version}\`\n` +
    `- Source: \`${audit.dataset.sourceType}\`\n` +
    `- Dataset hash: \`${audit.dataset.datasetHash}\`\n` +
    `- Products: ${total}\n` +
    `- Status: \`${audit.status}\`\n\n` +
    `## Readiness\n\n` +
    `- Recommendation eligible: ${percent(audit.summary.recommendationEligibleCount, total)}\n` +
    `- Functional profile evaluable: ${percent(audit.summary.functionalProfileEvaluableCount, total)}\n` +
    `- Safety decision ready: ${percent(audit.summary.safetyDecisionReadyCount, total)}\n` +
    `- Transport complete: ${percent(audit.summary.transportCompleteCount, total)}\n` +
    `- Critical gaps: ${audit.summary.criticalGapCount}\n` +
    `- Important gaps: ${audit.summary.importantGapCount}\n` +
    `- Quality gaps: ${audit.summary.qualityGapCount}\n\n` +
    `## Category summary\n\n` +
    `| Category | Total | Recommendation | Functional | Transport |\n` +
    `|---|---:|---:|---:|---:|\n${categoryRows || "| 없음 | 0 | 0 / 0 | 0 / 0 | 0 / 0 |"}\n\n` +
    `## Functional axis summary\n\n` +
    `| Axis | Products | High confidence | Medium+ confidence |\n` +
    `|---|---:|---:|---:|\n${axisRows || "| 없음 | 0 | 0 | 0 |"}\n\n` +
    `## Unknown functional labels\n\n${unknownRows}\n\n` +
    `## Transport gaps\n\n${transportRows}\n\n` +
    `## Limitations\n\n` +
    `- 감사기는 입력 JSON만 읽으며 DB 또는 네트워크에 접근하지 않는다.\n` +
    `- fixture 실행 결과는 실제 DB 전체 품질을 의미하지 않는다.\n` +
    `- transport 결과는 현재 명문화된 product-source field lineage 계약을 기준으로 한다.\n`;
}

function writeJson(outputDirectory, filename, value) {
  fs.writeFileSync(
    path.join(outputDirectory, filename),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function writeOutputs(outputDirectory, audit) {
  writeJson(outputDirectory, "summary.json", {
    version: audit.version,
    dataset: audit.dataset,
    status: audit.status,
    summary: audit.summary
  });
  writeJson(outputDirectory, "products.json", audit.rows);
  writeJson(outputDirectory, "category-summary.json", audit.byCategory);
  writeJson(outputDirectory, "axis-summary.json", audit.byFunctionalAxis);
  writeJson(outputDirectory, "field-summary.json", audit.byField);
  writeJson(outputDirectory, "unknown-labels.json", audit.unknownFunctionalLabels);
  writeJson(outputDirectory, "transport-gaps.json", audit.transportGaps);
  writeJson(outputDirectory, "remediation-backlog.json", audit.remediationBacklog);
  fs.writeFileSync(
    path.join(outputDirectory, "product-data-sufficiency-report.md"),
    renderReport(audit),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDirectory, "products.csv"),
    toCsv(
      [
        "rowKey", "productId", "brand", "name", "rawCategory", "canonicalCategory",
        "recommendationEligible", "functionalProfileEvaluable", "safetyDecisionReady",
        "sunscreenProtectionReady", "transportComplete", "gapCount"
      ],
      audit.rows.map((row) => ({
        rowKey: row.rowKey,
        productId: row.productId,
        brand: row.brand,
        name: row.name,
        rawCategory: row.rawCategory,
        canonicalCategory: row.canonicalCategory,
        recommendationEligible: row.capabilities.recommendationCategoryReady,
        functionalProfileEvaluable: row.capabilities.functionalProfileEvaluable,
        safetyDecisionReady: row.capabilities.safetyDecisionReady,
        sunscreenProtectionReady: row.capabilities.sunscreenProtectionReady,
        transportComplete: row.capabilities.transportComplete,
        gapCount: row.gaps.length
      }))
    ),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDirectory, "gaps.csv"),
    toCsv(
      ["rowKey", "productId", "code", "severity", "stage", "fieldPaths", "remediation"],
      audit.rows.flatMap((row) => row.gaps.map((gap) => ({
        rowKey: row.rowKey,
        productId: row.productId,
        code: gap.code,
        severity: gap.severity,
        stage: gap.stage,
        fieldPaths: gap.fieldPaths.join("|"),
        remediation: gap.remediation
      })))
    ),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDirectory, "unknown-labels.csv"),
    toCsv(
      ["label", "productCount", "sampleProductIds"],
      audit.unknownFunctionalLabels.map((item) => ({
        label: item.label,
        productCount: item.productCount,
        sampleProductIds: item.sampleProductIds.join("|")
      }))
    ),
    "utf8"
  );
}

const args = parseArgs(process.argv.slice(2));
if (!args.input || !args.output) {
  fail("usage: node scripts/audit-product-data-sufficiency.mjs --input <json> --output <directory> [--force]");
} else {
  try {
    const inputPath = path.resolve(args.input);
    const outputDirectory = path.resolve(args.output);
    if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
      throw new Error(`input file not found: ${inputPath}`);
    }
    const existingOutputs = OUTPUT_FILES.filter((filename) =>
      fs.existsSync(path.join(outputDirectory, filename))
    );
    if (existingOutputs.length && !args.force) {
      throw new Error(`refusing to overwrite existing output files: ${existingOutputs.join(", ")}`);
    }
    const products = readProducts(inputPath);
    const audit = buildProductDataSufficiencyAudit(products, { sourceType: "raw_export" });
    fs.mkdirSync(outputDirectory, { recursive: true });
    writeOutputs(outputDirectory, audit);
    console.log(`[product-data-sufficiency-audit] wrote ${OUTPUT_FILES.length} files to ${outputDirectory}`);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
