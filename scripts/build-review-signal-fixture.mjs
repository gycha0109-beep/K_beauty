#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { normalizeReviewSignals } from "../lib/review-signals.js";

const PRODUCT_ID_PLACEHOLDER = "USER_MUST_REPLACE_SUPABASE_PRODUCT_ID";
const FUNCTIONAL_SIGNAL_RULES = [
  { label: "skin hydration", mapped: ["dehydration"] },
  { label: "moisture evaporation blocking", mapped: ["barrier"] },
  { label: "skin protection", mapped: ["barrier"] },
  { label: "soothing/astringent", mapped: ["redness", "oiliness"] },
  { label: "exfoliation", mapped: ["pores", "acne"] },
  { label: "whitening", mapped: ["uneven_tone"] },
  { label: "acne relief", mapped: ["acne"] },
  { label: "uv protection", mapped: ["uv"] },
];

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(value) {
  return normalizeText(value).replace(/[^a-z0-9가-힣]/g, "");
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const digits = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseRating(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function readInput(args) {
  if (args.input) {
    const resolvedPath = path.resolve(process.cwd(), String(args.input));
    const raw = (await fs.readFile(resolvedPath, "utf8")).replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  }

  if (args.stdin || !process.stdin.isTTY) {
    const chunks = [];

    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "").trim();

    if (!raw) {
      throw new Error("No JSON received from stdin.");
    }

    return JSON.parse(raw);
  }

  throw new Error('Missing input. Use --input "tmp/raw.json" or pipe JSON through stdin.');
}

async function writeOutput(payload, outFile) {
  const output = `${JSON.stringify(payload, null, 2)}\n`;

  if (!outFile) {
    process.stdout.write(output);
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), outFile);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, output, "utf8");
  process.stdout.write(`Saved ${resolvedPath}\n`);
}

function normalizeReviewRawList(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (Array.isArray(entry)) {
        return {
          label: String(entry[0] || "").trim(),
          count: parseCount(entry[1]),
        };
      }

      if (entry && typeof entry === "object") {
        return {
          label: String(entry.label || "").trim(),
          count: parseCount(entry.count),
        };
      }

      return null;
    })
    .filter((entry) => entry?.label && entry.count > 0);
}

function buildReviewSignals(reviewRaw, warnings) {
  const positive = normalizeReviewRawList(reviewRaw?.positive);
  const negative = normalizeReviewRawList(reviewRaw?.negative);

  if (!positive.length && !negative.length) {
    return null;
  }

  const normalized = normalizeReviewSignals({
    source: "hwahae_ai_review",
    positive,
    negative,
    updated_at: getLocalDateString(),
  });

  if (!normalized) {
    return null;
  }

  normalized.positive
    .filter((entry) => !entry.mapped.length)
    .forEach((entry) => warnings.unmappedReviewLabels.add(entry.label));

  normalized.negative
    .filter((entry) => !entry.mapped.length)
    .forEach((entry) => warnings.unmappedReviewLabels.add(entry.label));

  return normalized;
}

function normalizeRatingDistribution(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [String(key), entryValue])
      .map(([key, entryValue]) => [
        key,
        String(entryValue).includes("%") ? String(entryValue).trim() : parseCount(entryValue),
      ])
      .filter(([, entryValue]) => entryValue !== 0 && entryValue !== "")
  );
}

function buildMarketSignals(marketRaw) {
  if (!marketRaw || typeof marketRaw !== "object") {
    return null;
  }

  const reviewCount = parseCount(marketRaw.review_count);
  const rating = parseRating(marketRaw.rating);
  const ratingDistribution = normalizeRatingDistribution(marketRaw.rating_distribution);

  if (!reviewCount && !rating && !Object.keys(ratingDistribution).length) {
    return null;
  }

  return {
    source: "hwahae_visible_page",
    review_count: reviewCount || null,
    rating: rating ?? null,
    rating_distribution: ratingDistribution,
    updated_at: getLocalDateString(),
  };
}

function mapFunctionalLabel(label) {
  const normalized = normalizeCompact(label);
  const matched = FUNCTIONAL_SIGNAL_RULES.find(
    (rule) => normalizeCompact(rule.label) === normalized,
  );

  return matched ? matched.mapped : [];
}

function normalizeFunctionalEntries(functionalRaw, warnings) {
  const entries = [];

  if (Array.isArray(functionalRaw)) {
    functionalRaw.forEach((entry) => {
      if (Array.isArray(entry)) {
        const label = String(entry[0] || "").trim();
        const count = parseCount(entry[1]);

        if (label && count > 0) {
          entries.push({ label, count, mapped: mapFunctionalLabel(label) });
        }
      }
    });
  } else if (functionalRaw && typeof functionalRaw === "object") {
    Object.entries(functionalRaw).forEach(([label, value]) => {
      const count = parseCount(value);

      if (label && count > 0) {
        entries.push({ label: String(label).trim(), count, mapped: mapFunctionalLabel(label) });
      }
    });
  }

  entries.forEach((entry) => {
    if (!entry.mapped.length) {
      warnings.unmappedFunctionalLabels.add(entry.label);
    }
  });

  return entries;
}

function summarizeMappedFunctional(entries) {
  const summary = {};

  entries.forEach((entry) => {
    entry.mapped.forEach((tag) => {
      summary[tag] = (summary[tag] || 0) + entry.count;
    });
  });

  return summary;
}

function normalizeSkinTypeMetrics(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const readBucket = (value) => ({
    positive: parseCount(value?.positive),
    negative: parseCount(value?.negative),
  });

  return {
    oily: readBucket(source.oily),
    dry: readBucket(source.dry),
    sensitive: readBucket(source.sensitive),
  };
}

function buildIngredientSignals(ingredientRaw, warnings) {
  if (!ingredientRaw || typeof ingredientRaw !== "object") {
    return null;
  }

  const totalIngredients = parseCount(ingredientRaw.total_ingredients);
  const risk = {
    low: parseCount(ingredientRaw?.risk?.low),
    medium: parseCount(ingredientRaw?.risk?.medium),
    high: parseCount(ingredientRaw?.risk?.high),
    unknown: parseCount(ingredientRaw?.risk?.unknown),
  };
  const functional = normalizeFunctionalEntries(ingredientRaw.functional, warnings);
  const functionalSummary = summarizeMappedFunctional(functional);
  const skinType = normalizeSkinTypeMetrics(ingredientRaw.skin_type);

  const hasRisk = Object.values(risk).some((value) => value > 0);
  const hasSkinType = Object.values(skinType).some(
    (bucket) => bucket.positive > 0 || bucket.negative > 0,
  );

  if (!totalIngredients && !hasRisk && !functional.length && !hasSkinType) {
    return null;
  }

  return {
    source: "hwahae_visible_page",
    total_ingredients: totalIngredients || null,
    risk,
    functional,
    functional_summary: functionalSummary,
    skin_type: skinType,
    updated_at: getLocalDateString(),
  };
}

function validateProductId(productId) {
  if (!productId) {
    throw new Error("Missing productId in raw JSON.");
  }

  if (productId === PRODUCT_ID_PLACEHOLDER) {
    throw new Error(
      `productId is still ${PRODUCT_ID_PLACEHOLDER}. Replace it with a real Supabase products.id before building the fixture.`,
    );
  }
}

function buildFixtureItem(rawItem) {
  const warnings = {
    unmappedReviewLabels: new Set(),
    unmappedFunctionalLabels: new Set(),
  };
  const productId = String(rawItem?.productId || "").trim();

  validateProductId(productId);

  const fixture = {
    productId,
    review_signals: buildReviewSignals(rawItem?.review_raw, warnings),
    market_signals: buildMarketSignals(rawItem?.market_raw),
    ingredient_signals: buildIngredientSignals(rawItem?.ingredient_raw, warnings),
  };

  return {
    fixture,
    warnings,
  };
}

function printWarnings(index, warnings) {
  if (warnings.unmappedReviewLabels.size > 0) {
    process.stdout.write(
      `[warn] item ${index}: unmapped review labels -> ${Array.from(warnings.unmappedReviewLabels).join(", ")}\n`,
    );
  }

  if (warnings.unmappedFunctionalLabels.size > 0) {
    process.stdout.write(
      `[warn] item ${index}: unmapped functional labels -> ${Array.from(warnings.unmappedFunctionalLabels).join(", ")}\n`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = await readInput(args);
  const items = Array.isArray(input) ? input : [input];
  const outputItems = [];

  items.forEach((item, index) => {
    const { fixture, warnings } = buildFixtureItem(item || {});
    outputItems.push(fixture);
    printWarnings(index + 1, warnings);
  });

  const outputPayload = Array.isArray(input) ? outputItems : outputItems[0];
  await writeOutput(outputPayload, args.out ? String(args.out) : "");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
