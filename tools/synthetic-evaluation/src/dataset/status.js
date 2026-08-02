import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  DATASET_VERSION_STATUS_EVENT_SCHEMA_VERSION,
  G5_STATUS_EVENT_SCHEMA_VERSION
} from "@bejewely/face-contracts";
import { readJson, writeExclusiveJson, writeSemanticAddressedJson } from "../judgment/artifact-store.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import {
  projectLinearStatus,
  verifyDatasetVersionStatusEventIntegrity,
  verifyG5StatusEventIntegrity
} from "./lock.js";
import { readDatasetVersionBundle } from "./storage.js";
import { datasetStorageLayout, nativeDatasetPath } from "./storage-layout.js";

function failure(code, pathName, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) }); }

async function scan(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const values = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw Object.assign(new Error("status_chain_invalid"), { code: "status_chain_invalid" });
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await scan(absolute));
    else if (entry.isFile() && entry.name.endsWith(".json")) values.push(await readJson(absolute));
  }
  return values;
}

async function claim(dataRoot, relativePath, value, code) {
  const absolute = nativeDatasetPath(dataRoot, relativePath);
  try { await writeExclusiveJson(absolute, value); return Object.freeze({ created: true, value }); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try { existing = await readJson(absolute); }
    catch { throw Object.assign(new Error(code), { code }); }
    if (stableStringify(existing) !== stableStringify(value)) throw Object.assign(new Error(code), { code });
    return Object.freeze({ created: false, value: existing });
  }
}

function createDatasetEvent({ datasetVersionDigest, event, reasonCodes, predecessorEventDigest, recordedAt }) {
  if (!["retired", "invalidated", "superseded"].includes(event) || !Array.isArray(reasonCodes) || reasonCodes.length === 0) return failure("dataset_status_event_invalid", "event");
  const semantic = { schemaVersion: DATASET_VERSION_STATUS_EVENT_SCHEMA_VERSION, datasetVersionDigest, event, reasonCodes: [...new Set(reasonCodes)].sort(), predecessorEventDigest };
  const value = deepFreeze({ ...semantic, recordedAt, eventDigest: sha256Hex(stableStringify(semantic)) });
  return verifyDatasetVersionStatusEventIntegrity(value) ? Object.freeze({ ok: true, event: value }) : failure("dataset_status_event_invalid", "event");
}

function createG5Event({ g5GradeRecordDigest, event, reasonCodes, predecessorEventDigest, recordedAt }) {
  if (!["revoked", "superseded"].includes(event) || !Array.isArray(reasonCodes) || reasonCodes.length === 0) return failure("g5_status_event_invalid", "event");
  const semantic = { schemaVersion: G5_STATUS_EVENT_SCHEMA_VERSION, g5GradeRecordDigest, event, reasonCodes: [...new Set(reasonCodes)].sort(), predecessorEventDigest };
  const value = deepFreeze({ ...semantic, recordedAt, eventDigest: sha256Hex(stableStringify(semantic)) });
  return verifyG5StatusEventIntegrity(value) ? Object.freeze({ ok: true, event: value }) : failure("g5_status_event_invalid", "event");
}

export async function appendDatasetVersionStatus({ dataRoot, datasetLineageId, datasetVersionId, event, reasonCodes, recordedAt = new Date().toISOString() }) {
  const bundle = await readDatasetVersionBundle(dataRoot, datasetLineageId, datasetVersionId);
  if (!bundle.ok) return bundle;
  let events;
  try { events = (await scan(path.join(dataRoot, "objects", "dataset-status-events", "sha256"))).filter((item) => item.datasetVersionDigest === bundle.version.datasetVersionDigest); }
  catch (error) { return failure(error?.code || "status_chain_invalid", "datasetStatus"); }
  const projected = projectLinearStatus(events, verifyDatasetVersionStatusEventIntegrity, "datasetVersionDigest");
  if (!projected.ok) return projected;
  if (!projected.active) return failure("dataset_status_already_inactive", "datasetStatus", projected.latestEvent.event);
  const created = createDatasetEvent({ datasetVersionDigest: bundle.version.datasetVersionDigest, event, reasonCodes, predecessorEventDigest: projected.latestEvent.eventDigest, recordedAt });
  if (!created.ok) return created;
  const successor = { schemaVersion: "dataset-status-successor-claim-v1", datasetVersionDigest: bundle.version.datasetVersionDigest, predecessorEventDigest: projected.latestEvent.eventDigest, successorEventDigest: created.event.eventDigest };
  try {
    const successorStored = await claim(dataRoot, datasetStorageLayout.statusSuccessorClaim(bundle.version.datasetVersionDigest, projected.latestEvent.eventDigest), successor, "dataset_status_branch_conflict");
    const stored = await writeSemanticAddressedJson(nativeDatasetPath(dataRoot, datasetStorageLayout.datasetStatusEvent(created.event.eventDigest)), created.event, (existing, proposed) => verifyDatasetVersionStatusEventIntegrity(existing) && existing.eventDigest === proposed.eventDigest);
    return Object.freeze({ ok: true, state: stored.created ? "registered" : "existing", event: stored.value, writesPerformed: Number(successorStored.created) + Number(stored.created) });
  } catch (error) { return failure(error?.code || "dataset_status_storage_conflict", "datasetStatus"); }
}

export async function appendG5Status({ dataRoot, datasetLineageId, datasetVersionId, g5GradeRecordDigest, event, reasonCodes, recordedAt = new Date().toISOString() }) {
  const bundle = await readDatasetVersionBundle(dataRoot, datasetLineageId, datasetVersionId);
  if (!bundle.ok || !bundle.g5Index.gradeRecordDigests.includes(g5GradeRecordDigest)) return failure("g5_status_event_invalid", "g5GradeRecordDigest");
  let events;
  try { events = (await scan(path.join(dataRoot, "objects", "g5-status-events", "sha256"))).filter((item) => item.g5GradeRecordDigest === g5GradeRecordDigest); }
  catch (error) { return failure(error?.code || "status_chain_invalid", "g5Status"); }
  const projected = projectLinearStatus(events, verifyG5StatusEventIntegrity, "g5GradeRecordDigest");
  if (!projected.ok) return projected;
  if (!projected.active) return failure("g5_status_already_inactive", "g5Status", projected.latestEvent.event);
  const created = createG5Event({ g5GradeRecordDigest, event, reasonCodes, predecessorEventDigest: projected.latestEvent.eventDigest, recordedAt });
  if (!created.ok) return created;
  const successor = { schemaVersion: "g5-status-successor-claim-v1", g5GradeRecordDigest, predecessorEventDigest: projected.latestEvent.eventDigest, successorEventDigest: created.event.eventDigest };
  try {
    const successorStored = await claim(dataRoot, datasetStorageLayout.g5StatusSuccessorClaim(g5GradeRecordDigest, projected.latestEvent.eventDigest), successor, "g5_status_branch_conflict");
    const stored = await writeSemanticAddressedJson(nativeDatasetPath(dataRoot, datasetStorageLayout.g5StatusEvent(created.event.eventDigest)), created.event, (existing, proposed) => verifyG5StatusEventIntegrity(existing) && existing.eventDigest === proposed.eventDigest);
    return Object.freeze({ ok: true, state: stored.created ? "registered" : "existing", event: stored.value, writesPerformed: Number(successorStored.created) + Number(stored.created) });
  } catch (error) { return failure(error?.code || "g5_status_storage_conflict", "g5Status"); }
}
