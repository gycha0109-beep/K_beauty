#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fetchOfficialBytes, sha256Hex } from "../../lib/trust/official-source-fetch.mjs";

export const R16D_CAPTURE_CONTRACT = "v21-8h-r16d-p1-exact-kr-official-source-capture-v1";
export const R16D_FIXED_TARGETS = Object.freeze([
  Object.freeze({
    product_id: "b72b0570-ee3f-4692-b45f-633b46ae3b64",
    source_product_id: "34622",
    brand: "이니스프리",
    product_name: "비자 시카 밤 EX",
    size_ml: 40,
    url: "https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA",
    allowed_hosts: ["m.innisfree.com", "www.innisfree.com", "innisfree.com"],
    artifact_stem: "innisfree-bija-cica-balm-ex-40ml",
  }),
  Object.freeze({
    product_id: "5848640c-84ca-4079-9d9e-8f3113159fe1",
    source_product_id: "99",
    brand: "에스네이처",
    product_name: "아쿠아 오아시스 수분 젤크림",
    size_ml: 80,
    url: "https://www.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=99",
    allowed_hosts: ["snature.kr", "www.snature.kr", "m.snature.kr"],
    artifact_stem: "snature-aqua-oasis-gel-cream-80ml",
  }),
]);

export function decodeOfficialHtml(bytes, contentType) {
  const header = String(contentType || "");
  const prefix = Buffer.from(bytes).subarray(0, 4096).toString("latin1");
  const declared = /charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(header)?.[1]
    || /<meta\b[^>]*charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(prefix)?.[1]
    || "utf-8";
  const encoding = /^euc-kr$|^ks_c_5601-1987$|^cp949$/i.test(declared) ? "euc-kr" : "utf-8";
  return new TextDecoder(encoding).decode(bytes);
}

function decodeEntities(input) {
  return String(input)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const point = code.toLowerCase().startsWith("x") ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isInteger(point) && point >= 32 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    })
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_, entity) =>
      ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity.toLowerCase()]);
}

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "noscript", "svg", "template"]);

function htmlTagAt(html, start) {
  if (html[start] !== "<") return null;
  let pos = start + 1;
  const closing = html[pos] === "/";
  if (closing) pos += 1;
  const nameStart = pos;
  while (pos < html.length && /[a-z0-9:-]/i.test(html[pos])) pos += 1;
  if (pos === nameStart) return null;
  const name = html.slice(nameStart, pos).toLowerCase();
  if (pos < html.length && !/[\s/>]/.test(html[pos])) return null;
  let quote = null;
  for (let i = pos; i < html.length; i += 1) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return { name, closing, end: i, attributes: html.slice(pos, i) };
    }
  }
  return null;
}

function closingTagAfter(html, from, name) {
  const lower = html.toLowerCase();
  let offset = from;
  while (offset < html.length) {
    const begin = lower.indexOf("</" + name, offset);
    if (begin < 0) return null;
    const afterName = begin + name.length + 2;
    if (afterName < html.length && /[\s/>]/.test(html[afterName])) {
      const tag = htmlTagAt(html, begin);
      if (tag?.closing && tag.name === name) return { begin, end: tag.end };
    }
    offset = begin + 2;
  }
  return null;
}

function readableHtml(html) {
  const chunks = [];
  let cursor = 0;
  while (cursor < html.length) {
    const begin = html.indexOf("<", cursor);
    if (begin < 0) {
      chunks.push(html.slice(cursor));
      break;
    }
    if (begin > cursor) chunks.push(html.slice(cursor, begin));
    if (html.startsWith("<!--", begin)) {
      const end = html.indexOf("-->", begin + 4);
      if (end < 0) break;
      cursor = end + 3;
      continue;
    }
    const tag = htmlTagAt(html, begin);
    if (!tag) {
      cursor = begin + 1;
      continue;
    }
    if (!tag.closing && RAW_TEXT_ELEMENTS.has(tag.name)) {
      const end = closingTagAfter(html, tag.end + 1, tag.name);
      if (!end) break;
      cursor = end.end + 1;
      continue;
    }
    cursor = tag.end + 1;
  }
  return decodeEntities(chunks.join(" ")).replace(/\s+/g, " ").trim().normalize("NFKC");
}

function cleanLabel(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function findTargetProductJsonLd(html, target) {
  let cursor = 0;
  while (cursor < html.length) {
    const begin = html.indexOf("<", cursor);
    if (begin < 0) break;
    if (html.startsWith("<!--", begin)) {
      const end = html.indexOf("-->", begin + 4);
      if (end < 0) break;
      cursor = end + 3;
      continue;
    }
    const tag = htmlTagAt(html, begin);
    if (!tag) {
      cursor = begin + 1;
      continue;
    }
    cursor = tag.end + 1;
    if (tag.closing || tag.name !== "script") continue;
    const ending = closingTagAfter(html, cursor, "script");
    if (!ending) break;
    const json = html.slice(cursor, ending.begin).trim();
    cursor = ending.end + 1;
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(tag.attributes)) continue;
    let parsed;
    try { parsed = JSON.parse(json); } catch { continue; }
    const roots = Array.isArray(parsed) ? parsed : [parsed];
    const nodes = roots.flatMap(x =>
      x && typeof x === "object" && Array.isArray(x["@graph"]) ? x["@graph"] : [x]);
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      if (!types.includes("Product")) continue;
      const name = String(node.name || "");
      const sku = String(node.sku || "");
      const nameAndSize = cleanLabel(name).includes(cleanLabel(target.product_name)) &&
        new RegExp(String(target.size_ml) + "\\s*(?:ml|mℓ|밀리리터)", "i").test(name);
      const skuScoped = new RegExp("(?:^|[_\\/-])" + target.source_product_id + "$").test(sku);
      const url = typeof node.offers?.url === "string" ? node.offers.url :
        typeof node.url === "string" ? node.url : "";
      let urlScoped = false;
      try {
        const parsedUrl = new URL(url);
        urlScoped = target.allowed_hosts.includes(parsedUrl.hostname.toLowerCase()) &&
          (parsedUrl.pathname.endsWith("/" + target.source_product_id + "/") ||
           parsedUrl.searchParams.get("product_no") === target.source_product_id);
      } catch {}
      if (nameAndSize && (skuScoped || urlScoped)) {
        return { observed: true, sku: sku || null, name, source_product_id: target.source_product_id };
      }
    }
  }
  return { observed: false, sku: null, name: null, source_product_id: null };
}

export function reviewOfficialProductIdentity(bytes, contentType, target) {
  const html = decodeOfficialHtml(bytes, contentType);
  const visible = readableHtml(html);
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "";
  const htmlTitle = readableHtml(titleTag);
  const required = cleanLabel(target.product_name);
  const product_name_found = cleanLabel(visible).includes(required) || cleanLabel(htmlTitle).includes(required);
  const sizeRe = new RegExp(String(target.size_ml) + "\\s*(?:ml|mℓ|밀리리터)", "i");
  const size_found_on_page = sizeRe.test(visible) || sizeRe.test(htmlTitle);
  // A size in a recommendation widget is not evidence that the target SKU has that size.
  // Exact title adjacency is a stronger but still preliminary signal, never registration authority.
  const nearTitle = cleanLabel(htmlTitle);
  const title_size_collocated = nearTitle.includes(required) && new RegExp(target.size_ml + "(?:ml|mℓ|밀리리터)", "i").test(nearTitle);
  const structured= findTargetProductJsonLd(html,target);
  return {
    product_name_found,
    size_found_on_page,
    title_size_collocated,
    structured_product_and_presentation: structured.observed,
    structured_product_sku: structured.sku,
    title_excerpt: htmlTitle.slice(0, 200),
    status: !product_name_found ? "IDENTITY_NAME_NOT_OBSERVED" :
      title_size_collocated ? "TITLE_PRODUCT_AND_PRESENTATION_OBSERVED" :
      structured.observed ? "STRUCTURED_PRODUCT_AND_PRESENTATION_OBSERVED" :
      size_found_on_page ? "PAGE_PRODUCT_AND_SIZE_OBSERVED_SEPARATE" :
      "PRESENTATION_NOT_OBSERVED",
    exact_formulation_revision_verified: false,
    subject_registration_authorized: false,
  };
}

function sourceFailure(error) {
  const m = String(error?.message || error || "UNKNOWN");
  return /^(?:SOURCE_BLOCKED|TRANSIENT_FAILURE):/.test(m) ? m :
    /ENOTFOUND|EAI_AGAIN|DNS|name resolution|lookup/i.test(m) ? "TRANSIENT_FAILURE:dns_resolution" :
    "TRANSIENT_FAILURE:fetch_or_decode_error";
}

export async function captureR16D({
  outputDir,
  fetchBytes = fetchOfficialBytes,
  observedAt = () => new Date().toISOString(),
  context = {},
} = {}) {
  assert.ok(typeof outputDir === "string" && outputDir.length > 0, "outputDir required");
  const manifest = {
    contract: R16D_CAPTURE_CONTRACT,
    observed_at: observedAt(),
    execution: {
      github_head_sha: String(context.github_head_sha || ""),
      github_run_id: String(context.github_run_id || ""),
      github_run_attempt: String(context.github_run_attempt || ""),
      fetcher: "lib/trust/official-source-fetch.mjs:fetchOfficialBytes",
    },
    expected_product_count: 2,
    targets: [],
    policy: {
      first_party_hosts_only: true,
      source_bytes_sha256_basis: "live-page-bytes-v1",
      ephemeral_artifact_retention_days: 7,
      source_digest_is_not_formulation_revision_key: true,
      identity_token_presence_is_not_fact_authority: true,
      no_subject_semantic_key_without_governed_serializer: true,
      subject_registration_authorized: false,
      product_fact_adjudication_authorized: false,
      production_writes: 0,
      recommendation_activation_authorized: false,
    },
  };
  await fs.mkdir(outputDir, { recursive: true });
  for (const target of R16D_FIXED_TARGETS) {
    let outcome = {
      product_id: target.product_id,
      expected_name: target.product_name,
      expected_size_ml: target.size_ml,
      exact_brand_product_url: target.url,
      source_product_id: target.source_product_id,
      source_bytes_captured: false,
      content_digest: null,
      source_bytes_length: null,
      artifact_path: null,
      identity_observation: null,
      formulation_revision_key: null,
      subject_semantic_key: null,
      subject_registration_authorized: false,
    };
    try {
      const response = await fetchBytes(target.url);
      const resolved = new URL(response.finalUrl);
      if (resolved.protocol !== "https:" || !target.allowed_hosts.includes(resolved.hostname.toLowerCase())) {
        throw new Error("SOURCE_BLOCKED:cross_brand_redirect");
      }
      if (!Buffer.isBuffer(response.bytes) || response.bytes.byteLength < 100) {
        throw new Error("SOURCE_BLOCKED:empty_or_nonraw_response");
      }
      if (!/html|plain/i.test(response.contentType)) throw new Error("SOURCE_BLOCKED:unexpected_content_type");
      const observed = reviewOfficialProductIdentity(response.bytes, response.contentType, target);
      const digest = sha256Hex(response.bytes);
      const artifactPath = path.join(outputDir, target.artifact_stem + ".html");
      await fs.writeFile(artifactPath, response.bytes);
      outcome = { ...outcome,
        source_bytes_captured: true,
        final_url: response.finalUrl,
        content_type: response.contentType,
        content_digest: digest,
        source_bytes_length: response.bytes.length,
        artifact_path: path.basename(artifactPath),
        identity_observation: observed,
        decision: ["TITLE_PRODUCT_AND_PRESENTATION_OBSERVED","STRUCTURED_PRODUCT_AND_PRESENTATION_OBSERVED"].includes(observed.status) ?
          "RAW_SOURCE_CAPTURED_IDENTITY_REVIEW_REQUIRED" : "RAW_SOURCE_CAPTURED_IDENTITY_GAP",
      };
    } catch (error) {
      outcome.decision = "CAPTURE_BLOCKED";
      outcome.failure_code = sourceFailure(error);
    }
    manifest.targets.push(outcome);
  }
  manifest.summary = {
    attempted: 2,
    raw_sources_captured: manifest.targets.filter(x => x.source_bytes_captured).length,
    raw_sources_blocked: manifest.targets.filter(x => !x.source_bytes_captured).length,
    identity_title_collocation: manifest.targets.filter(x => x.identity_observation?.title_size_collocated === true).length,
    identity_structured_collocation: manifest.targets.filter(x => x.identity_observation?.structured_product_and_presentation === true).length,
    registerable: 0,
    production_writes: 0,
  };
  const pathManifest = path.join(outputDir, "manifest.json");
  await fs.writeFile(pathManifest, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--output-dir") {
    throw new Error("Usage: node scripts/product-evidence/capture-barrier-support-p1-r16d-official-sources-v1.mjs --output-dir tmp/r16d-p1-sources");
  }
  const result = await captureR16D({
    outputDir: process.argv[3],
    context: {
      github_head_sha: process.env.R16D_EXACT_CHECKOUT_SHA || process.env.GITHUB_SHA,
      github_run_id: process.env.GITHUB_RUN_ID,
      github_run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    },
  });
  // Print bounded manifest summary; no scraped full pages in logs.
  console.log(JSON.stringify({ contract: result.contract, summary: result.summary,
    targets: result.targets.map(x => ({ product_id: x.product_id, decision: x.decision,
      content_digest: x.content_digest, failure_code: x.failure_code || null })) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
