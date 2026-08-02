import {
  PILOT_CAMPAIGN_EVENT_SCHEMA_VERSION,
  PILOT_EVENT_TYPES,
  PILOT_TERMINAL_OUTCOMES,
  validatePilotCampaignEvent
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const SLOT_EVENT_TYPES = new Set([
  "generation_packet_issued",
  "generation_handoff_registered",
  "generation_retry_reserved",
  "candidate_registered",
  "observation_authorization_recorded",
  "observation_registered",
  "judgment_assignment_issued",
  "judgment_consensus_sealed",
  "alignment_registered",
  "promotion_preflight_registered",
  "promotion_decision_registered",
  "slot_terminal"
]);
const RUN_EVENT_TYPES = new Set([
  "run_started",
  "wave_issued",
  "checkpoint_requested",
  "checkpoint_approved",
  "checkpoint_stopped",
  "run_paused",
  "run_resumed",
  "run_closed"
]);

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semantic(event) {
  const { eventDigest, recordedAt, ...rest } = event;
  return rest;
}

function chainKey(event) {
  return event.slotId || "__run__";
}

function sourceRefKey(ref) {
  return `${ref.track}:${ref.artifactType}:${ref.artifactDigest}`;
}

export function createPilotCampaignEvent({
  campaignRunId,
  slotId = null,
  eventType,
  sourceRefs = [],
  reasonCodes = [],
  predecessorEventDigest = null,
  recordedAt = new Date().toISOString()
}) {
  if (!PILOT_EVENT_TYPES.includes(eventType) || !Number.isFinite(Date.parse(recordedAt)) || new Date(recordedAt).toISOString() !== recordedAt) return failure("campaign_event_invalid", "$", null);
  if ((slotId === null && !RUN_EVENT_TYPES.has(eventType)) || (slotId !== null && !SLOT_EVENT_TYPES.has(eventType))) return failure("campaign_event_invalid", "eventType", "scope_mismatch");
  const orderedRefs = [...sourceRefs].map((ref) => ({ ...ref })).sort((a, b) => sourceRefKey(a).localeCompare(sourceRefKey(b)));
  if (new Set(orderedRefs.map(sourceRefKey)).size !== orderedRefs.length) return failure("campaign_event_invalid", "sourceRefs", "duplicate_reference");
  const orderedReasons = [...new Set(reasonCodes)].sort();
  if (eventType === "slot_terminal" && !orderedReasons.some((code) => PILOT_TERMINAL_OUTCOMES.includes(code))) return failure("campaign_event_invalid", "reasonCodes", "terminal_outcome_required");
  const value = {
    schemaVersion: PILOT_CAMPAIGN_EVENT_SCHEMA_VERSION,
    campaignRunId,
    slotId,
    eventType,
    sourceRefs: orderedRefs,
    reasonCodes: orderedReasons,
    predecessorEventDigest
  };
  const eventDigest = sha256Hex(stableStringify(value));
  const event = deepFreeze({ ...value, recordedAt, eventDigest });
  const validation = validatePilotCampaignEvent(event);
  return validation.ok ? Object.freeze({ ok: true, event }) : validation;
}

export function verifyPilotCampaignEventIntegrity(event) {
  if (!validatePilotCampaignEvent(event).ok) return false;
  if ((event.slotId === null && !RUN_EVENT_TYPES.has(event.eventType)) || (event.slotId !== null && !SLOT_EVENT_TYPES.has(event.eventType))) return false;
  const refs = event.sourceRefs.map(sourceRefKey);
  if (new Set(refs).size !== refs.length || stableStringify(refs) !== stableStringify([...refs].sort())) return false;
  if (new Set(event.reasonCodes).size !== event.reasonCodes.length || stableStringify(event.reasonCodes) !== stableStringify([...event.reasonCodes].sort())) return false;
  if (event.eventType === "slot_terminal" && !event.reasonCodes.some((code) => PILOT_TERMINAL_OUTCOMES.includes(code))) return false;
  return event.eventDigest === sha256Hex(stableStringify(semantic(event)));
}

export function validateCampaignEventLedger(events, { campaignRunId, slotIds = [] } = {}) {
  if (!Array.isArray(events) || !events.every(verifyPilotCampaignEventIntegrity)) return failure("campaign_event_chain_invalid", "events", "invalid_event");
  if (events.some((event) => event.campaignRunId !== campaignRunId)) return failure("campaign_event_chain_invalid", "events", "run_mismatch");
  const allowedSlots = new Set(slotIds);
  if (events.some((event) => event.slotId !== null && !allowedSlots.has(event.slotId))) return failure("campaign_event_chain_invalid", "events", "unknown_slot");
  const digestMap = new Map();
  for (const event of events) {
    if (digestMap.has(event.eventDigest)) return failure("campaign_event_chain_invalid", "events", "duplicate_digest");
    digestMap.set(event.eventDigest, event);
  }
  const byChain = new Map();
  for (const event of events) {
    const key = chainKey(event);
    if (!byChain.has(key)) byChain.set(key, []);
    byChain.get(key).push(event);
  }
  const heads = {};
  const orderedByChain = {};
  for (const [key, chain] of byChain.entries()) {
    const roots = chain.filter((event) => event.predecessorEventDigest === null);
    if (roots.length !== 1) return failure("campaign_event_chain_invalid", `events.${key}`, "root_count");
    const successorByPredecessor = new Map();
    for (const event of chain) {
      if (event.predecessorEventDigest === null) continue;
      const predecessor = digestMap.get(event.predecessorEventDigest);
      if (!predecessor || chainKey(predecessor) !== key) return failure("campaign_event_chain_invalid", `events.${key}`, "disconnected_predecessor");
      if (successorByPredecessor.has(event.predecessorEventDigest)) return failure("campaign_event_chain_invalid", `events.${key}`, "branch");
      successorByPredecessor.set(event.predecessorEventDigest, event);
    }
    const ordered = [];
    const visited = new Set();
    let cursor = roots[0];
    while (cursor) {
      if (visited.has(cursor.eventDigest)) return failure("campaign_event_chain_invalid", `events.${key}`, "cycle");
      visited.add(cursor.eventDigest);
      ordered.push(cursor);
      cursor = successorByPredecessor.get(cursor.eventDigest) || null;
    }
    if (visited.size !== chain.length) return failure("campaign_event_chain_invalid", `events.${key}`, "disconnected_event");
    heads[key] = ordered.at(-1).eventDigest;
    orderedByChain[key] = Object.freeze(ordered);
  }
  return Object.freeze({ ok: true, heads: Object.freeze(heads), orderedByChain: Object.freeze(orderedByChain) });
}

export function appendPilotCampaignEvent(events, input, context) {
  const checked = validateCampaignEventLedger(events, context);
  if (!checked.ok && events.length > 0) return checked;
  const key = input.slotId || "__run__";
  const predecessorEventDigest = checked.ok ? (checked.heads[key] || null) : null;
  const created = createPilotCampaignEvent({ ...input, predecessorEventDigest });
  if (!created.ok) return created;
  const duplicate = events.find((event) => event.eventDigest === created.event.eventDigest);
  if (duplicate) return Object.freeze({ ok: true, state: "existing", event: duplicate, events: Object.freeze([...events]) });
  const next = Object.freeze([...events, created.event]);
  const rechecked = validateCampaignEventLedger(next, context);
  return rechecked.ok ? Object.freeze({ ok: true, state: "appended", event: created.event, events: next }) : rechecked;
}

export function latestChainEvent(events, slotId = null) {
  const key = slotId || "__run__";
  const checked = validateCampaignEventLedger(events, {
    campaignRunId: events[0]?.campaignRunId,
    slotIds: [...new Set(events.filter((event) => event.slotId).map((event) => event.slotId))]
  });
  return checked.ok ? checked.orderedByChain[key]?.at(-1) || null : null;
}
