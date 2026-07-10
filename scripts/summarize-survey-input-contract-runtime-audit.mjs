import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const AUDIT_DIR = path.join(process.cwd(), "tmp", "survey-input-contract-runtime-audit");
const EVENTS_PATH = path.join(AUDIT_DIR, "events.jsonl");
const SUMMARY_JSON_PATH = path.join(AUDIT_DIR, "summary.json");
const SUMMARY_MD_PATH = path.join(AUDIT_DIR, "summary.md");

function countValue(bucket, value) {
  const key = value === undefined || value === null || value === "" ? "unknown" : String(value);
  bucket[key] = (bucket[key] || 0) + 1;
}

function countList(bucket, values) {
  if (!Array.isArray(values) || values.length === 0) {
    countValue(bucket, "none");
    return;
  }

  values.forEach((value) => countValue(bucket, value));
}

function readEvents() {
  if (!existsSync(EVENTS_PATH)) {
    return {
      events: [],
      invalidLines: 0
    };
  }

  const lines = readFileSync(EVENTS_PATH, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const events = [];
  let invalidLines = 0;

  lines.forEach((line) => {
    try {
      events.push(JSON.parse(line));
    } catch {
      invalidLines += 1;
    }
  });

  return { events, invalidLines };
}

function buildSummary(events, invalidLines) {
  const summary = {
    generatedAt: new Date().toISOString(),
    eventsPath: EVENTS_PATH,
    totalEvents: events.length,
    invalidLines,
    primaryConcern: {},
    unresolvedPrimaryConcern: {
      count: 0,
      rate: 0
    },
    warnings: {},
    missingFields: {},
    safety: {
      recentSkinChange: {},
      recentlyChangedProduct: {},
      sensitivityRisk: {},
      drynessRisk: {},
      rednessRisk: {}
    },
    sunscreenSourceCompleteness: {},
    hasImage: {}
  };

  events.forEach((event) => {
    countValue(summary.primaryConcern, event.primaryConcern);
    countList(summary.warnings, event.warnings);
    countList(summary.missingFields, event.missingFields);
    countValue(summary.safety.recentSkinChange, event.safety?.recentSkinChange);
    countValue(summary.safety.recentlyChangedProduct, event.safety?.recentlyChangedProduct);
    countValue(summary.safety.sensitivityRisk, event.safety?.sensitivityRisk);
    countValue(summary.safety.drynessRisk, event.safety?.drynessRisk);
    countValue(summary.safety.rednessRisk, event.safety?.rednessRisk);
    countValue(summary.sunscreenSourceCompleteness, event.sunscreenSourceCompleteness);
    countValue(summary.hasImage, event.hasImage);

    if (event.unresolvedPrimaryConcern === true) {
      summary.unresolvedPrimaryConcern.count += 1;
    }
  });

  summary.unresolvedPrimaryConcern.rate = events.length
    ? Number((summary.unresolvedPrimaryConcern.count / events.length).toFixed(4))
    : 0;

  return summary;
}

function formatDistribution(distribution) {
  const entries = Object.entries(distribution);

  if (!entries.length) {
    return "- none";
  }

  return entries
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, count]) => `- ${key}: ${count}`)
    .join("\n");
}

function buildMarkdown(summary) {
  return `# Survey Input Contract Runtime Audit Summary

Generated: ${summary.generatedAt}

Events path: \`${summary.eventsPath}\`

## Totals

- totalEvents: ${summary.totalEvents}
- invalidLines: ${summary.invalidLines}
- unresolvedPrimaryConcern: ${summary.unresolvedPrimaryConcern.count} (${summary.unresolvedPrimaryConcern.rate})

## Primary Concern

${formatDistribution(summary.primaryConcern)}

## Warnings

${formatDistribution(summary.warnings)}

## Missing Fields

${formatDistribution(summary.missingFields)}

## Safety

### recentSkinChange

${formatDistribution(summary.safety.recentSkinChange)}

### recentlyChangedProduct

${formatDistribution(summary.safety.recentlyChangedProduct)}

### sensitivityRisk

${formatDistribution(summary.safety.sensitivityRisk)}

### drynessRisk

${formatDistribution(summary.safety.drynessRisk)}

### rednessRisk

${formatDistribution(summary.safety.rednessRisk)}

## Sunscreen Source Completeness

${formatDistribution(summary.sunscreenSourceCompleteness)}

## Has Image

${formatDistribution(summary.hasImage)}
`;
}

const { events, invalidLines } = readEvents();
const summary = buildSummary(events, invalidLines);

mkdirSync(AUDIT_DIR, { recursive: true });
writeFileSync(SUMMARY_JSON_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
writeFileSync(SUMMARY_MD_PATH, buildMarkdown(summary), "utf8");

console.log("summarize-survey-input-contract-runtime-audit: ok");
console.log(`read ${events.length} events`);
console.log(`wrote ${path.relative(process.cwd(), SUMMARY_JSON_PATH)}`);
console.log(`wrote ${path.relative(process.cwd(), SUMMARY_MD_PATH)}`);
