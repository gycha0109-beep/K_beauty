#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

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
    .replace(/\s+/g, "")
    .trim();
}

function parseCount(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferPositiveMappedTags(label) {
  const normalized = normalizeText(label);
  const mapped = [];

  if (normalized.includes("속건조")) {
    mapped.push("dehydration");
  }

  if (normalized.includes("수분") || normalized.includes("보습")) {
    mapped.push("dehydration", "barrier");
  }

  if (normalized.includes("가벼") || normalized.includes("산뜻") || normalized.includes("흡수")) {
    mapped.push("fresh");
  }

  if (normalized.includes("유분없") || normalized.includes("번들") || normalized.includes("산뜻")) {
    mapped.push("oiliness");
  }

  if (
    normalized.includes("트러블안생") ||
    normalized.includes("트러블없") ||
    normalized.includes("여드름안")
  ) {
    mapped.push("acne_safe");
  }

  if (
    normalized.includes("편안") ||
    normalized.includes("순하") ||
    normalized.includes("진정") ||
    normalized.includes("자극없")
  ) {
    mapped.push("sensitive_safe");
  }

  if (normalized.includes("밀림없")) {
    mapped.push("makeup_safe");
  }

  return Array.from(new Set(mapped));
}

function inferNegativeMappedTags(label) {
  const normalized = normalizeText(label);
  const mapped = [];

  if (normalized.includes("알러지") || normalized.includes("알레르기")) {
    mapped.push("sensitivity_risk");
  }

  if (
    normalized.includes("따가") ||
    normalized.includes("화끈") ||
    normalized.includes("가려") ||
    normalized.includes("자극")
  ) {
    mapped.push("irritation_risk");
  }

  if (normalized.includes("트러블") || normalized.includes("여드름")) {
    mapped.push("acne_risk");
  }

  if (normalized.includes("미끌") || normalized.includes("끈적")) {
    mapped.push("texture_mismatch");
  }

  if (
    normalized.includes("흘러내림") ||
    normalized.includes("지속력안") ||
    normalized.includes("지속력아쉬") ||
    normalized.includes("금방지워")
  ) {
    mapped.push("lasting_weak");
  }

  if (normalized.includes("밀림")) {
    mapped.push("pilling_risk");
  }

  if (normalized.includes("건조")) {
    mapped.push("drying");
  }

  return Array.from(new Set(mapped));
}

function normalizeEntry(label, count, sentiment) {
  const trimmedLabel = String(label || "").trim();
  const parsedCount = parseCount(count);

  if (!trimmedLabel || parsedCount <= 0) {
    return null;
  }

  return {
    label: trimmedLabel,
    count: parsedCount,
    mapped: sentiment === "negative"
      ? inferNegativeMappedTags(trimmedLabel)
      : inferPositiveMappedTags(trimmedLabel)
  };
}

function parseKeywordLine(line) {
  const trimmed = String(line || "").trim();

  if (!trimmed) {
    return null;
  }

  const trailingMatch = trimmed.match(/^(.*?)(\d[\d,]*)$/);

  if (!trailingMatch) {
    return null;
  }

  const label = trailingMatch[1].trim();
  const count = trailingMatch[2].trim();

  if (!label || !count) {
    return null;
  }

  return { label, count };
}

function parseReviewSectionText(sectionText) {
  const lines = String(sectionText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const positive = [];
  const negative = [];
  let state = null;
  let pendingLabel = "";

  const pushEntry = (label, count) => {
    const nextEntry = normalizeEntry(label, count, state);

    if (!nextEntry) {
      return;
    }

    if (state === "positive") {
      positive.push(nextEntry);
      return;
    }

    if (state === "negative") {
      negative.push(nextEntry);
    }
  };

  for (const line of lines) {
    if (line.includes("AI가 분석한 리뷰")) {
      continue;
    }

    if (line.includes("좋아요")) {
      state = "positive";
      pendingLabel = "";
      continue;
    }

    if (line.includes("아쉬워요")) {
      state = "negative";
      pendingLabel = "";
      continue;
    }

    if (!state) {
      continue;
    }

    const keywordLine = parseKeywordLine(line);

    if (keywordLine) {
      pushEntry(keywordLine.label, keywordLine.count);
      pendingLabel = "";
      continue;
    }

    if (/^\d[\d,]*$/.test(line) && pendingLabel) {
      pushEntry(pendingLabel, line);
      pendingLabel = "";
      continue;
    }

    pendingLabel = line;
  }

  return {
    positive,
    negative
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = String(args.url || "").trim();
  const productId = args["product-id"] ? String(args["product-id"]).trim() : null;
  const outFile = args.out ? String(args.out).trim() : "";
  const headed = Boolean(args.headed);

  if (!url) {
    throw new Error("Missing required --url");
  }

  let chromium;

  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error('Playwright is not installed. Run "npm install -D playwright" first.');
  }

  const browser = await chromium.launch({ headless: !headed });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 2200
      }
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const section = page
      .locator("section, article, div")
      .filter({ hasText: "AI가 분석한 리뷰" })
      .filter({ hasText: "좋아요" })
      .first();

    await section.waitFor({
      state: "visible",
      timeout: 15000
    });

    await section.scrollIntoViewIfNeeded();
    const sectionText = await section.innerText();
    const parsed = parseReviewSectionText(sectionText);

    if (!parsed.positive.length && !parsed.negative.length) {
      throw new Error("Could not extract keyword/count pairs from the visible AI review section.");
    }

    const payload = {
      product_id: productId,
      url,
      review_signals: {
        source: "hwahae_ai_review",
        positive: parsed.positive,
        negative: parsed.negative,
        updated_at: new Date().toISOString().slice(0, 10)
      }
    };

    const output = `${JSON.stringify(payload, null, 2)}\n`;

    if (outFile) {
      const resolvedPath = path.resolve(process.cwd(), outFile);
      await fs.writeFile(resolvedPath, output, "utf8");
      process.stdout.write(`Saved ${resolvedPath}\n`);
      return;
    }

    process.stdout.write(output);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
