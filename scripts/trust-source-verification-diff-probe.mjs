import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { canonicalizeOfficialHtmlTextV1, fetchOfficialBytes, sha256Hex } from "../lib/trust/official-source-fetch.mjs";

const DEFAULT_TARGET = "docs/evidence/trust-phase8g-production-canary-target-v1.json";
const DELAYS_MS = [0, 2000, 3000, 10000, 15000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function extractFirst(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractJsonLdProductDigests(html) {
  const out = [];
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(match[1]);
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        const type = item["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((value) => String(value).toLowerCase() === "product")) {
          out.push(shortHash(JSON.stringify(item)));
        }
        if (Array.isArray(item["@graph"])) queue.push(...item["@graph"]);
      }
    } catch {}
  }
  return out.sort();
}

function summarize(bytes, finalUrl, contentType) {
  const html = Buffer.from(bytes).toString("utf8");
  const canonical = canonicalizeOfficialHtmlTextV1(bytes);
  const lines = canonical.split("\n").filter(Boolean);
  return {
    raw_digest: sha256Hex(bytes),
    raw_length: bytes.byteLength,
    canonical_digest: sha256Hex(Buffer.from(canonical, "utf8")),
    canonical_length: Buffer.byteLength(canonical, "utf8"),
    canonical_lines: lines,
    title_hash: shortHash(extractFirst(html, /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i) || ""),
    description_hash: shortHash(extractFirst(html, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) || ""),
    json_ld_product_digests: extractJsonLdProductDigests(html),
    script_digest: shortHash([...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)].map((m) => m[0]).join("\n")),
    final_url: finalUrl,
    content_type: contentType,
  };
}

function diffLines(base, next) {
  const a = new Map();
  const b = new Map();
  for (const line of base) a.set(line, (a.get(line) || 0) + 1);
  for (const line of next) b.set(line, (b.get(line) || 0) + 1);
  const removed = [];
  const added = [];
  for (const [line, count] of a) {
    const delta = count - (b.get(line) || 0);
    for (let i = 0; i < delta; i += 1) removed.push(line);
  }
  for (const [line, count] of b) {
    const delta = count - (a.get(line) || 0);
    for (let i = 0; i < delta; i += 1) added.push(line);
  }
  const summarizeLine = (line) => ({
    hash: shortHash(line),
    length: line.length,
    preview: line.slice(0, 160),
  });
  return {
    removed: removed.slice(0, 12).map(summarizeLine),
    added: added.slice(0, 12).map(summarizeLine),
    removed_count: removed.length,
    added_count: added.length,
  };
}

export async function probeSemanticVariability({ targetPath = DEFAULT_TARGET, fetchImpl = fetch } = {}) {
  const target = JSON.parse(await readFile(targetPath, "utf8"));
  const captures = [];
  for (let i = 0; i < DELAYS_MS.length; i += 1) {
    if (DELAYS_MS[i]) await sleep(DELAYS_MS[i]);
    const fetched = await fetchOfficialBytes(target.canonical_locator, fetchImpl);
    captures.push({
      index: i + 1,
      fetched_at: new Date().toISOString(),
      ...summarize(fetched.bytes, fetched.finalUrl, fetched.contentType),
    });
  }
  const baseline = captures[0];
  return {
    contract: "trust-phase8g-semantic-variability-probe-v1",
    source_id: target.source_id,
    publisher: target.publisher,
    canonical_locator: target.canonical_locator,
    observations: captures.map(({ canonical_lines, ...item }) => item),
    comparisons: captures.slice(1).map((capture) => ({
      against: 1,
      observation: capture.index,
      raw_same: baseline.raw_digest === capture.raw_digest,
      canonical_same: baseline.canonical_digest === capture.canonical_digest,
      title_same: baseline.title_hash === capture.title_hash,
      description_same: baseline.description_hash === capture.description_hash,
      json_ld_product_same: JSON.stringify(baseline.json_ld_product_digests) === JSON.stringify(capture.json_ld_product_digests),
      script_same: baseline.script_digest === capture.script_digest,
      canonical_line_diff: diffLines(baseline.canonical_lines, capture.canonical_lines),
    })),
    authority_mutation: false,
  };
}

const result = await probeSemanticVariability();
console.log(`TRUST_PHASE8G_SEMANTIC_VARIABILITY_JSON=${JSON.stringify(result)}`);
