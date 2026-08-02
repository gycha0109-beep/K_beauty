import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJson } from "../campaign/storage.js";
import { projectPromotionStatus, verifyPromotionStatusEventIntegrity } from "../promotion/decision.js";
import { preflightCampaignReportSource } from "../reporting/source-preflight.js";
import { verifyDatasetSourceSnapshotIntegrity } from "./source.js";

function failure(code, pathName, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) }); }

async function readEvents(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const values = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw Object.assign(new Error("g4_status_chain_invalid"), { code: "g4_status_chain_invalid" });
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await readEvents(absolute));
    else if (entry.isFile() && entry.name.endsWith(".json")) values.push(await readJson(absolute));
  }
  return values;
}

export async function reverifyDatasetSourceAuthority({ dataRoot, sourceSnapshot }) {
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot)) return failure("dataset_source_snapshot_invalid", "sourceSnapshot");
  const sources = new Map();
  for (const runId of [...new Set(sourceSnapshot.members.map((member) => member.campaignRunId))].sort()) {
    const result = await preflightCampaignReportSource({ dataRoot, campaignRunId: runId });
    if (!result.ok) return failure("dataset_source_not_ready", `campaignRun:${runId}`, result.errors?.[0]?.code || null);
    sources.set(runId, result.source);
  }
  for (const member of sourceSnapshot.members) {
    const source = sources.get(member.campaignRunId);
    const slotEvidence = source.slotEvidence.find((item) => item.projection.refs.candidateId === member.candidateId);
    if (!slotEvidence || slotEvidence.projection.terminalOutcome !== "promoted_g4" || slotEvidence.evidence.promotion?.gradeRecord?.gradeRecordDigest !== member.g4GradeRecordDigest || slotEvidence.evidence.candidateManifest?.asset?.canonicalSha256 !== member.canonicalSha256) return failure("source_evidence_integrity_invalid", `member:${member.candidateId}`);
    let events;
    try { events = await readEvents(path.join(dataRoot, "promotion", "status-events", member.promotionKey)); }
    catch (error) { return failure(error?.code || "g4_status_chain_invalid", `member:${member.candidateId}`); }
    const relevant = events.filter((event) => event.gradeRecordDigest === member.g4GradeRecordDigest);
    if (!relevant.length || !relevant.every(verifyPromotionStatusEventIntegrity)) return failure("g4_status_chain_invalid", `member:${member.candidateId}`);
    const status = projectPromotionStatus(relevant);
    if (!status.ok || !status.active || status.latestEvent.eventDigest !== member.g4StatusHeadDigest) return failure("g4_status_inactive", `member:${member.candidateId}`);
  }
  return Object.freeze({ ok: true, sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest, memberCount: sourceSnapshot.members.length });
}
