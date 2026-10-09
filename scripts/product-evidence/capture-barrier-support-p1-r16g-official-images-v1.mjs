#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fetchOfficialAssetBytes, sha256Hex } from "../../lib/trust/official-source-fetch.mjs";

const HOST = "www.snature.kr";
export const R16G_ASSET_CAPTURE_CONTRACT = "v21-8h-r16g-fixed-first-party-visual-assets-v1";
export const R16G_ASSETS = Object.freeze([
  Object.freeze({ id: "snature_80ml_product_notice", size_scope: "80ml", path: "/web/upload/new_design/gelcream/80ml/gel80ml_info.jpg" }),
  Object.freeze({ id: "snature_90ml_detail_first", size_scope: "90ml-directory", path: "/web/upload/new_design/gelcream/90ml/260826/gelcream_01.webp" }),
  Object.freeze({ id: "snature_90ml_detail_last", size_scope: "90ml-directory", path: "/web/upload/new_design/gelcream/90ml/260826/gelcream_17.jpg" }),
]);

function fileExtension(buffer) {
  if (buffer.length < 32) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "gif";
  return null;
}

function failureCode(error) {
  const msg = String(error?.message || error || "");
  if (msg.startsWith("SOURCE_BLOCKED:") || msg.startsWith("TRANSIENT_FAILURE:")) return msg.slice(0, 150);
  return "TRANSIENT_FAILURE:official_image_fetch";
}

export async function captureR16G({ outputDir, fetchAsset = fetchOfficialAssetBytes,
  clock = () => new Date().toISOString(), context = {} } = {}) {
  assert.ok(typeof outputDir === "string" && outputDir.length > 0, "outputDir required");
  await fs.mkdir(outputDir, { recursive: true });
  const result = {
    contract: R16G_ASSET_CAPTURE_CONTRACT,
    observed_at: clock(),
    execution: {
      exact_checkout_sha: String(context.exact_checkout_sha || ""),
      run_id: String(context.run_id || ""),
      run_attempt: String(context.run_attempt || ""),
    },
    upstream_official_html_artifact_id: 11600769958,
    product_id: "5848640c-84ca-4079-9d9e-8f3113159fe1",
    official_product_id: "99",
    official_listing_presentation: "80ml",
    image_directory_tokens_are_not_formula_identity: true,
    formulation_revision_key: null,
    subject_semantic_key: null,
    subject_registration_authorized: false,
    production_writes: 0,
    assets: [],
  };
  for (const asset of R16G_ASSETS) {
    const url = "https://" + HOST + asset.path;
    const item = {
      id: asset.id, size_scope: asset.size_scope, source_url: url,
      observed_raw_bytes: false, sha256: null, bytes_length: null,
      mime_type: null, artifact_file: null, visual_content_reviewed: false,
      product_identity_or_ingredient_panel_confirmed: false,
    };
    try {
      const res = await fetchAsset(url);
      const final = new URL(res.finalUrl);
      if (final.protocol !== "https:" ||
          !["www.snature.kr","snature.kr","m.snature.kr"].includes(final.hostname.toLowerCase())) {
        throw new Error("SOURCE_BLOCKED:unexpected_brand_host");
      }
      if (!Buffer.isBuffer(res.bytes)) throw new Error("SOURCE_BLOCKED:nonraw_asset");
      const ext = fileExtension(res.bytes);
      if (!ext || !/^image\/(jpeg|png|webp|gif)\b/i.test(String(res.contentType))) {
        throw new Error("SOURCE_BLOCKED:unsupported_image_magic_or_content_type");
      }
      const filename = asset.id + "." + ext;
      await fs.writeFile(path.join(outputDir, filename), res.bytes);
      Object.assign(item, {
        observed_raw_bytes: true, sha256: sha256Hex(res.bytes),
        bytes_length: res.bytes.length, mime_type: res.contentType,
        artifact_file: filename, final_url: res.finalUrl,
        decision: "RAW_OFFICIAL_IMAGE_CAPTURED_CONTENT_REVIEW_REQUIRED",
      });
    } catch (error) {
      item.decision = "CAPTURE_BLOCKED";
      item.failure_code = failureCode(error);
    }
    result.assets.push(item);
  }
  result.summary = {
    attempted: R16G_ASSETS.length,
    captured: result.assets.filter(x => x.observed_raw_bytes).length,
    blocked: result.assets.filter(x => !x.observed_raw_bytes).length,
    visual_content_reviewed: 0,
    formulation_revision_confirmed: 0,
    registerable: 0,
    production_writes: 0,
  };
  await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--output-dir") {
    throw new Error("Usage: node capture-barrier-support-p1-r16g-official-images-v1.mjs --output-dir tmp/r16g-official-images");
  }
  const result = await captureR16G({
    outputDir: process.argv[3],
    context: {
      exact_checkout_sha: process.env.R16G_EXACT_CHECKOUT_SHA,
      run_id: process.env.GITHUB_RUN_ID,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    },
  });
  console.log(JSON.stringify({ contract: result.contract, summary: result.summary,
    assets: result.assets.map(x => ({ id: x.id, decision: x.decision, sha256: x.sha256, failure_code: x.failure_code || null })) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
