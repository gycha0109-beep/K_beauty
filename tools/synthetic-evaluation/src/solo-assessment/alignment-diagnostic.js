import {
  SOLO_ALIGNMENT_AXES,
  SOLO_ALIGNMENT_DIAGNOSTIC_FLAGS,
  SOLO_CUE_ALIGNMENT_SCHEMA_VERSION,
  SOLO_WAVE_ALIGNMENT_REPORT_SCHEMA_VERSION,
  validateSoloCueAlignment,
  validateSoloWaveAlignmentReport
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import {
  deriveSoloTargetRelation,
  verifySoloIntentRevealReceiptIntegrity,
  verifySoloTargetWithheldScreeningIntegrity,
  verifySoloWaveSessionIntegrity
} from "./artifacts.js";
import { verifySoloWaveShapeIntegrity } from "./wave-shape.js";

const LEVEL_ORDER = Object.freeze({ low: 1, mild: 2, moderate: 3, high: 4 });

function failure(code, path = "$", detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]), writesPerformed: 0 });
}

function digestOf(value) {
  return sha256Hex(stableStringify(value));
}

function without(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function axisFromObservation(bundle, key, signalAxis) {
  const skin = bundle?.skin;
  const score = skin?.signals?.[signalAxis];
  const levels = Array.isArray(skin?.observations)
    ? [...new Set(skin.observations.filter((item) => item?.key === key && Object.hasOwn(LEVEL_ORDER, item.level)).map((item) => item.level))]
        .sort((left, right) => LEVEL_ORDER[left] - LEVEL_ORDER[right])
    : [];
  let relationInput = "unverifiable";
  if (skin?.status === "available") {
    if (levels.length) relationInput = levels.at(-1);
    else if (score === 0) relationInput = "none";
  }
  return Object.freeze({ signalScore: Number.isInteger(score) ? score : 0, observationLevels: Object.freeze(levels), relationInput });
}

function t4TargetRelation(target, observed) {
  if (observed === "unverifiable") return "unverifiable";
  if (target === "none") return observed === "none" ? "exact_match" : "over_target";
  if (target === "mild") {
    if (["none","low"].includes(observed)) return "under_target";
    if (observed === "mild") return "exact_match";
    if (["moderate","high"].includes(observed)) return "over_target";
  }
  return "contradictory";
}

function humanPresenceTargetRelation(target, observed) {
  if (observed === "uncertain") return "unverifiable";
  if (target === "none") return observed === "none" ? "exact_match" : "over_target";
  if (target === "mild") {
    if (observed === "none") return "under_target";
    if (observed === "mild") return "exact_match";
    if (observed === "moderate_or_higher") return "over_target";
  }
  return "contradictory";
}

function humanT4Presence(human, t4) {
  if (human === "uncertain") return "unverifiable";
  if (t4 === "unverifiable") return "not_comparable";
  if (human === "none") return t4 === "none" ? "agree" : "disagree";
  if (human === "mild") return t4 === "mild" ? "agree" : "disagree";
  if (human === "moderate_or_higher") return ["moderate","high"].includes(t4) ? "agree" : "disagree";
  return "not_comparable";
}

function diagnosticFlags({ intendedCue, humanObservation, t4Observation }) {
  const flags = [];
  const axes = [
    { axis: "redness", target: intendedCue.redness, human: humanObservation.redness, t4: t4Observation.redness.relationInput },
    { axis: "blemishPresence", target: intendedCue.blemishes, human: humanObservation.blemishes, t4: t4Observation.blemishPresence.relationInput }
  ];
  for (const item of axes) {
    if (item.target === "mild" && item.human === "none" && item.t4 === "none") flags.push({ code: "generation_side_signal_weak_possible", axis: item.axis });
    if (["mild","moderate_or_higher"].includes(item.human) && ["none","low"].includes(item.t4)) flags.push({ code: "observation_side_miss_possible", axis: item.axis });
    if (item.human === "uncertain" && ["none","low"].includes(item.t4)) flags.push({ code: "ambiguous_visual_cue", axis: item.axis });
  }
  return Object.freeze(flags.sort((left, right) => `${left.axis}:${left.code}`.localeCompare(`${right.axis}:${right.code}`)).map(Object.freeze));
}

export function createSoloCueAlignment({ session, entry, screening, reveal, observationObject, derivedAt = new Date().toISOString() }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloTargetWithheldScreeningIntegrity(screening) ||
      !verifySoloIntentRevealReceiptIntegrity(reveal) || !isIso(derivedAt)) return failure("solo_alignment_source_invalid");
  if (!entry || screening.sessionDigest !== session.sessionDigest || reveal.sessionDigest !== session.sessionDigest ||
      screening.reviewItemId !== entry.reviewItemId || reveal.reviewItemId !== entry.reviewItemId ||
      reveal.slotId !== entry.slotId || reveal.conditionId !== entry.conditionId || reveal.screeningDigest !== screening.screeningDigest ||
      entry.candidateId !== observationObject?.candidateId || entry.observationDigest !== observationObject?.observationDigest) {
    return failure("solo_alignment_source_conflict", entry?.reviewItemId || "$");
  }
  const humanTargetRelation = deriveSoloTargetRelation(screening, reveal);
  if (!humanTargetRelation) return failure("solo_alignment_source_conflict", entry.reviewItemId);
  const humanObservation = Object.freeze({
    redness: screening.skinObservation.redness.presence,
    blemishes: screening.skinObservation.blemishes.presence,
    blemishCountBand: screening.skinObservation.blemishes.countBand
  });
  const t4Observation = Object.freeze({
    skinStatus: observationObject.bundle?.skin?.status,
    redness: axisFromObservation(observationObject.bundle, "redness", "redness"),
    blemishPresence: axisFromObservation(observationObject.bundle, "acne", "acne"),
    blemishCount: Object.freeze({ support: "not_available", value: null })
  });
  const semantic = {
    schemaVersion: SOLO_CUE_ALIGNMENT_SCHEMA_VERSION,
    campaignRunId: session.campaignRunId,
    waveOrdinal: session.waveOrdinal,
    sessionDigest: session.sessionDigest,
    reviewItemId: entry.reviewItemId,
    slotId: entry.slotId,
    conditionId: entry.conditionId,
    candidateId: entry.candidateId,
    screeningDigest: screening.screeningDigest,
    revealDigest: reveal.revealDigest,
    observationDigest: observationObject.observationDigest,
    intendedCue: reveal.intendedSkinCue,
    humanObservation,
    t4Observation,
    humanTargetRelation,
    t4TargetRelation: Object.freeze({
      redness: t4TargetRelation(reveal.intendedSkinCue.redness, t4Observation.redness.relationInput),
      blemishPresence: t4TargetRelation(reveal.intendedSkinCue.blemishes, t4Observation.blemishPresence.relationInput),
      blemishCount: "not_available"
    }),
    humanT4Relation: Object.freeze({
      redness: humanT4Presence(humanObservation.redness, t4Observation.redness.relationInput),
      blemishPresence: humanT4Presence(humanObservation.blemishes, t4Observation.blemishPresence.relationInput),
      blemishCount: "not_comparable"
    }),
    diagnosticFlags: diagnosticFlags({ intendedCue: reveal.intendedSkinCue, humanObservation, t4Observation })
  };
  const alignment = deepFreeze({ ...semantic, derivedAt, alignmentDigest: digestOf(semantic) });
  return validateSoloCueAlignment(alignment).ok ? Object.freeze({ ok: true, alignment, writesPerformed: 0 }) : failure("solo_cue_alignment_invalid");
}

export function verifySoloCueAlignmentIntegrity(value) {
  if (!validateSoloCueAlignment(value).ok || value.alignmentDigest !== digestOf(without(value, ["derivedAt","alignmentDigest"]))) return false;
  const expectedHuman = {
    redness: humanPresenceTargetRelation(value.intendedCue.redness, value.humanObservation.redness),
    blemishPresence: humanPresenceTargetRelation(value.intendedCue.blemishes, value.humanObservation.blemishes),
    blemishCount: value.humanObservation.blemishCountBand === "uncertain" ? "unverifiable"
      : value.intendedCue.blemishCountBand === "none" ? value.humanObservation.blemishCountBand === "none" ? "exact_match" : "over_target"
        : ["none","one_to_two"].includes(value.humanObservation.blemishCountBand) ? "under_target"
          : value.humanObservation.blemishCountBand === "three_to_five" ? "exact_match"
            : value.humanObservation.blemishCountBand === "six_plus" ? "over_target" : "contradictory"
  };
  const expectedT4 = {
    redness: t4TargetRelation(value.intendedCue.redness, value.t4Observation.redness.relationInput),
    blemishPresence: t4TargetRelation(value.intendedCue.blemishes, value.t4Observation.blemishPresence.relationInput),
    blemishCount: "not_available"
  };
  const expectedAgreement = {
    redness: humanT4Presence(value.humanObservation.redness, value.t4Observation.redness.relationInput),
    blemishPresence: humanT4Presence(value.humanObservation.blemishes, value.t4Observation.blemishPresence.relationInput),
    blemishCount: "not_comparable"
  };
  const expectedFlags = diagnosticFlags({ intendedCue: value.intendedCue, humanObservation: value.humanObservation, t4Observation: value.t4Observation });
  return stableStringify(value.humanTargetRelation) === stableStringify(expectedHuman) &&
    stableStringify(value.t4TargetRelation) === stableStringify(expectedT4) &&
    stableStringify(value.humanT4Relation) === stableStringify(expectedAgreement) &&
    stableStringify(value.diagnosticFlags) === stableStringify(expectedFlags);
}

function targetSummary(rows, selector, { t4 = false } = {}) {
  const summary = t4
    ? { total: rows.length, supported: 0, evaluable: 0, unverifiable: 0, notAvailable: 0, exactMatch: 0, underTarget: 0, overTarget: 0, contradictory: 0 }
    : { total: rows.length, evaluable: 0, unverifiable: 0, exactMatch: 0, underTarget: 0, overTarget: 0, contradictory: 0 };
  for (const row of rows) {
    const relation = selector(row);
    if (t4 && relation === "not_available") { summary.notAvailable += 1; continue; }
    if (t4) summary.supported += 1;
    if (relation === "unverifiable") { summary.unverifiable += 1; continue; }
    summary.evaluable += 1;
    summary[{ exact_match: "exactMatch", under_target: "underTarget", over_target: "overTarget", contradictory: "contradictory" }[relation]] += 1;
  }
  return Object.freeze(summary);
}

function agreementSummary(rows, selector) {
  const summary = { total: rows.length, comparable: 0, agree: 0, disagree: 0, unverifiable: 0, notComparable: 0 };
  for (const row of rows) {
    const relation = selector(row);
    if (relation === "agree" || relation === "disagree") { summary.comparable += 1; summary[relation] += 1; }
    else if (relation === "unverifiable") summary.unverifiable += 1;
    else summary.notComparable += 1;
  }
  return Object.freeze(summary);
}

export function createSoloWaveAlignmentReport({ session, alignments, limitations, derivedAt = new Date().toISOString() }) {
  if (!verifySoloWaveSessionIntegrity(session) || !verifySoloWaveShapeIntegrity(session.waveShape) || !Array.isArray(alignments) ||
      alignments.length !== session.expectedSlotCount || alignments.some((row) => !verifySoloCueAlignmentIntegrity(row)) || !isIso(derivedAt)) {
    return failure("solo_wave_alignment_report_invalid");
  }
  if (new Set(alignments.map((row) => row.reviewItemId)).size !== alignments.length || new Set(alignments.map((row) => row.slotId)).size !== alignments.length ||
      alignments.some((row) => row.campaignRunId !== session.campaignRunId || row.waveOrdinal !== session.waveOrdinal || row.sessionDigest !== session.sessionDigest)) {
    return failure("solo_wave_alignment_report_invalid", "alignmentRows");
  }
  const sorted = [...alignments].sort((left, right) => left.slotId.localeCompare(right.slotId));
  const humanTargetAlignment = Object.freeze(Object.fromEntries(SOLO_ALIGNMENT_AXES.map((axis) => [axis, targetSummary(sorted, (row) => row.humanTargetRelation[axis])])));
  const t4TargetAlignment = Object.freeze(Object.fromEntries(SOLO_ALIGNMENT_AXES.map((axis) => [axis, targetSummary(sorted, (row) => row.t4TargetRelation[axis], { t4: true })])));
  const humanT4Agreement = Object.freeze(Object.fromEntries(SOLO_ALIGNMENT_AXES.map((axis) => [axis, agreementSummary(sorted, (row) => row.humanT4Relation[axis])])));
  const diagnosticMap = {
    generation_side_signal_weak_possible: "generationSideSignalWeakPossible",
    observation_side_miss_possible: "observationSideMissPossible",
    ambiguous_visual_cue: "ambiguousVisualCue"
  };
  const diagnostics = Object.freeze(Object.fromEntries(SOLO_ALIGNMENT_DIAGNOSTIC_FLAGS.map((code) => {
    const rowDigests = sorted.filter((row) => row.diagnosticFlags.some((flag) => flag.code === code)).map((row) => row.alignmentDigest);
    return [diagnosticMap[code], Object.freeze({ count: rowDigests.length, rowDigests: Object.freeze(rowDigests) })];
  })));
  const semantic = {
    schemaVersion: SOLO_WAVE_ALIGNMENT_REPORT_SCHEMA_VERSION,
    campaignRunId: session.campaignRunId,
    waveOrdinal: session.waveOrdinal,
    sessionDigest: session.sessionDigest,
    campaignPlanDigest: session.campaignPlanDigest,
    sourceProjectionDigest: session.sourceProjectionDigest,
    waveShape: session.waveShape,
    slotSetDigest: session.slotSetDigest,
    alignmentRows: sorted.map((row) => Object.freeze({ reviewItemId: row.reviewItemId, slotId: row.slotId, alignmentDigest: row.alignmentDigest })),
    sample: Object.freeze({ expectedSlots: session.expectedSlotCount, assessedSlots: sorted.length }),
    humanTargetAlignment,
    t4TargetAlignment,
    humanT4Agreement,
    diagnostics,
    limitations: Object.freeze((limitations || []).map((item) => Object.freeze({ code: item.code, affectedAxes: Object.freeze([...item.affectedAxes].sort()) })).sort((left, right) => left.code.localeCompare(right.code)))
  };
  const report = deepFreeze({ ...semantic, derivedAt, reportDigest: digestOf(semantic) });
  return validateSoloWaveAlignmentReport(report).ok ? Object.freeze({ ok: true, report, writesPerformed: 0 }) : failure("solo_wave_alignment_report_invalid");
}

export function verifySoloWaveAlignmentReportIntegrity(value, alignments = null) {
  if (!validateSoloWaveAlignmentReport(value).ok || value.reportDigest !== digestOf(without(value, ["derivedAt","reportDigest"]))) return false;
  if (alignments === null) return true;
  if (!Array.isArray(alignments) || alignments.some((row) => !verifySoloCueAlignmentIntegrity(row))) return false;
  const sorted = [...alignments].sort((left, right) => left.slotId.localeCompare(right.slotId));
  const refs = sorted.map((row) => ({ reviewItemId: row.reviewItemId, slotId: row.slotId, alignmentDigest: row.alignmentDigest }));
  const human = Object.fromEntries(SOLO_ALIGNMENT_AXES.map((axis) => [axis, targetSummary(sorted, (row) => row.humanTargetRelation[axis])]));
  const t4 = Object.fromEntries(SOLO_ALIGNMENT_AXES.map((axis) => [axis, targetSummary(sorted, (row) => row.t4TargetRelation[axis], { t4: true })]));
  const agreement = Object.fromEntries(SOLO_ALIGNMENT_AXES.map((axis) => [axis, agreementSummary(sorted, (row) => row.humanT4Relation[axis])]));
  const diagnosticMap = {
    generation_side_signal_weak_possible: "generationSideSignalWeakPossible",
    observation_side_miss_possible: "observationSideMissPossible",
    ambiguous_visual_cue: "ambiguousVisualCue"
  };
  const diagnostics = Object.fromEntries(SOLO_ALIGNMENT_DIAGNOSTIC_FLAGS.map((code) => {
    const rowDigests = sorted.filter((row) => row.diagnosticFlags.some((flag) => flag.code === code)).map((row) => row.alignmentDigest);
    return [diagnosticMap[code], { count: rowDigests.length, rowDigests }];
  }));
  return stableStringify(value.alignmentRows) === stableStringify(refs) &&
    stableStringify(value.humanTargetAlignment) === stableStringify(human) &&
    stableStringify(value.t4TargetAlignment) === stableStringify(t4) &&
    stableStringify(value.humanT4Agreement) === stableStringify(agreement) &&
    stableStringify(value.diagnostics) === stableStringify(diagnostics);
}
