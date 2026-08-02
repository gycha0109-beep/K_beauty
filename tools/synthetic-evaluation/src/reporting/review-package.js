import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  CAMPAIGN_REVIEW_PACKAGE_SCHEMA_VERSION,
  validateCampaignReviewPackage
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { THUMBNAIL_POLICY } from "./policy.js";
import { verifyCampaignEvidenceSnapshotIntegrity, verifyCampaignSlotRowIntegrity } from "./derive.js";

function failure(code, pathName, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) }); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function sha256Buffer(value) { return sha256Hex(Buffer.isBuffer(value) ? value : Buffer.from(value)); }
function stageReached(row) {
  if (row.promotion.decisionDigest) return "promotion";
  if (row.judgment.alignmentDigest) return "alignment";
  if (row.judgment.consensusDigest) return "consensus";
  if (row.observation.authoritative) return "observation";
  if (row.candidate.candidateId) return "candidate";
  if (row.generation.assetReady) return "handoff";
  if (row.generation.attempts > 0) return "generation";
  return "planned";
}
function blindItemId(sourceSnapshotDigest, row) { return `blind_${sha256Hex(`${sourceSnapshotDigest}:${row.rowDigest}`).slice(0,24)}`; }
function documentShell(title, body, mode) {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<style>\n:root{font-family:system-ui,sans-serif;color:#171717;background:#fff}body{margin:24px}h1{font-size:1.4rem}.notice{padding:12px;border:2px solid #333;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}.card{border:1px solid #777;padding:10px;break-inside:avoid}.thumb{width:100%;aspect-ratio:1;object-fit:contain;background:#eee}.placeholder{display:grid;place-items:center}.meta{font-size:.8rem;overflow-wrap:anywhere}.warnings{font-weight:700}@media print{body{margin:8mm}.grid{grid-template-columns:repeat(4,1fr)}.card{page-break-inside:avoid}}\n</style>\n</head>\n<body data-review-mode="${mode}">\n<h1>${escapeHtml(title)}</h1>\n${body}\n</body>\n</html>\n`;
}
function blindCard(sourceSnapshotDigest, row, thumbnail) {
  const itemId = blindItemId(sourceSnapshotDigest, row);
  const image = thumbnail
    ? `<img class="thumb" src="${escapeHtml(thumbnail.blindRelativePath)}" alt="Synthetic review item ${escapeHtml(itemId)}">`
    : `<div class="thumb placeholder" role="img" aria-label="No registered candidate">no candidate</div>`;
  return `<article class="card">${image}<p class="meta">review item ${escapeHtml(itemId)}</p></article>`;
}
function annotatedCard(row, thumbnail) {
  const image = thumbnail
    ? `<img class="thumb" src="${escapeHtml(thumbnail.annotatedRelativePath)}" alt="Synthetic candidate ${escapeHtml(row.candidate.candidateId)} for slot ${escapeHtml(row.slotId)}">`
    : `<div class="thumb placeholder" role="img" aria-label="No registered candidate">no candidate</div>`;
  const warnings = row.warnings.length ? `<p class="meta warnings">warnings: ${escapeHtml(row.warnings.join(", "))}</p>` : "";
  return `<article class="card">${image}<p class="meta">slot ${escapeHtml(row.slotId)}<br>condition ${escapeHtml(row.conditionId)} · wave ${row.waveOrdinal}<br>stage ${escapeHtml(stageReached(row))}<br>terminal ${escapeHtml(row.promotion.terminalOutcome)}<br>mark hint ${escapeHtml(row.candidate.visibleExternalMarkHint || "none")}<br>row ${escapeHtml(row.rowDigest.slice(0, 12))}</p>${warnings}</article>`;
}

export async function buildCampaignReviewPackage({ dataRoot, sourceSnapshot, rows, artifactIndex }) {
  if (!verifyCampaignEvidenceSnapshotIntegrity(sourceSnapshot) || !Array.isArray(rows) || rows.length !== 20 * sourceSnapshot.sourceRuns.length || !rows.every(verifyCampaignSlotRowIntegrity) || !Array.isArray(artifactIndex)) return failure("report_review_package_invalid", "source");
  const thumbnails = [];
  const files = new Map();
  for (const row of rows) {
    if (!row.candidate.candidateId) continue;
    const source = artifactIndex.find((item) => item.track === "T3" && item.artifactType === "canonical-image" && item.campaignRunId === row.campaignRunId && item.slotId === row.slotId && item.candidateId === row.candidate.candidateId);
    if (!source?.relativeObjectPath || source.artifactDigest !== row.candidate.canonicalSha256) return failure("source_artifact_missing", row.slotId, "canonical_image");
    const absolute = path.join(dataRoot, ...source.relativeObjectPath.split("/"));
    let canonical;
    try { canonical = await readFile(absolute); }
    catch { return failure("source_artifact_missing", row.slotId, "canonical_image"); }
    if (sha256Buffer(canonical) !== row.candidate.canonicalSha256) return failure("source_artifact_integrity_invalid", row.slotId, "canonical_image_sha");
    const output = await sharp(canonical, { animated: false, failOn: "error" })
      .rotate()
      .resize({ width: THUMBNAIL_POLICY.maxWidth, height: THUMBNAIL_POLICY.maxHeight, fit: THUMBNAIL_POLICY.fit, withoutEnlargement: THUMBNAIL_POLICY.withoutEnlargement })
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer();
    const itemId = blindItemId(sourceSnapshot.sourceSnapshotDigest, row);
    const blindRelativePath = `review/blind-thumbnails/${itemId}.png`;
    const annotatedRelativePath = `review/annotated-thumbnails/${row.campaignRunId}-${row.slotId}.png`;
    const thumbnail = deepFreeze({
      campaignRunId: row.campaignRunId,
      slotId: row.slotId,
      candidateId: row.candidate.candidateId,
      blindReviewItemId: itemId,
      canonicalSha256: row.candidate.canonicalSha256,
      blindRelativePath,
      annotatedRelativePath,
      sha256: sha256Buffer(output),
      byteLength: output.length,
      transformPolicyId: THUMBNAIL_POLICY.id,
      transformPolicyDigest: THUMBNAIL_POLICY.digest
    });
    thumbnails.push(thumbnail);
    files.set(blindRelativePath, output);
    files.set(annotatedRelativePath, output);
  }
  thumbnails.sort((left, right) => stableStringify([left.campaignRunId, left.slotId]).localeCompare(stableStringify([right.campaignRunId, right.slotId])));
  const thumbnailBySlot = new Map(thumbnails.map((item) => [`${item.campaignRunId}:${item.slotId}`, item]));
  const blindCards = rows.map((row) => blindCard(sourceSnapshot.sourceSnapshotDigest, row, thumbnailBySlot.get(`${row.campaignRunId}:${row.slotId}`))).join("\n");
  const annotatedCards = rows.map((row) => annotatedCard(row, thumbnailBySlot.get(`${row.campaignRunId}:${row.slotId}`))).join("\n");
  const blindHtml = documentShell("Blind synthetic campaign contact sheet", `<div class="notice">Blind audit view. Condition, generation intent, observed values, alignment, promotion outcome, run ID, slot ID, and candidate ID are intentionally hidden.</div><main class="grid">${blindCards}</main>`, "blind");
  const annotatedHtml = documentShell("Annotated synthetic campaign contact sheet", `<div class="notice">Analytical audit view. This view does not replace T5 judgment or T6 promotion authority.</div><main class="grid">${annotatedCards}</main>`, "annotated");
  files.set("review/blind-contact-sheet.html", Buffer.from(blindHtml));
  files.set("review/annotated-contact-sheet.html", Buffer.from(annotatedHtml));
  const thumbnailIndexDigest = sha256Hex(stableStringify(thumbnails));
  const semantic = {
    schemaVersion: CAMPAIGN_REVIEW_PACKAGE_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    artifactIndexDigest: sourceSnapshot.artifactIndexDigest,
    slotTableDigest: sourceSnapshot.slotEvidenceDigest,
    blindContactSheetDigest: sha256Hex(blindHtml),
    annotatedContactSheetDigest: sha256Hex(annotatedHtml),
    thumbnailPolicyDigest: THUMBNAIL_POLICY.digest,
    thumbnailIndexDigest,
    unresolvedHoldSlotIds: rows.filter((row) => row.promotion.terminalOutcome === "promotion_held").map((row) => row.slotId).sort(),
    warningSlotIds: rows.filter((row) => row.warnings.length > 0).map((row) => row.slotId).sort(),
    reviewChecklist: { allSlotsPresent: true, denominatorsExact: true, sourceRefsVerified: true, externalMarksNotHidden: true, unresolvedHoldsVisible: true, noSplitFields: true }
  };
  const reviewPackage = deepFreeze({ ...semantic, packageDigest: sha256Hex(stableStringify(semantic)) });
  if (!validateCampaignReviewPackage(reviewPackage).ok) return failure("report_review_package_invalid", "$", "contract");
  return Object.freeze({ ok: true, reviewPackage, thumbnails: deepFreeze(thumbnails), files });
}

export function verifyCampaignReviewPackageIntegrity(reviewPackage) {
  if (!validateCampaignReviewPackage(reviewPackage).ok) return false;
  const { packageDigest, ...semantic } = reviewPackage;
  return packageDigest === sha256Hex(stableStringify(semantic));
}
