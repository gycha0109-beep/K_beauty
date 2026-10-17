// Research-only S3 bridge: explicit Skin v2 states -> existing metadata-only session comparator.
// No Provider, photo, network, persistence, medical inference or user-facing score activation.
import { compareSkinPhotoSessions, SKIN_COMPARISON_AXES } from './skin-photo-comparability-core.mjs';

export const SKIN_S3_V2_ADAPTER_VERSION = 'skin-photo-v2-session-adapter-v1';
const EXPECTED = new Set(SKIN_COMPARISON_AXES);
const ROW_KEYS = new Set(['axis', 'state', 'value', 'confidence']);
const INPUT_KEYS = new Set([
  'observationVersion', 'captureId', 'subjectGroupId', 'capturedAt', 'photoStatus',
  'conditions', 'skinAnalysisEligible', 'v2Axes'
]);
const STATES = new Set(['present','not_seen','unassessable','unknown']);
const CONF = new Set(['low','medium','high','unknown']);
function record(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function strictKeys(v, allowed, error) {
  if (!record(v) || Object.keys(v).some(k => !allowed.has(k))) throw Error(error);
}
function v2Session(input) {
  strictKeys(input, INPUT_KEYS, 'invalid_v2_session_fields');
  if (input.observationVersion !== 'vision-observation-v2') throw Error('v2_version_required');
  if (typeof input.skinAnalysisEligible !== 'boolean') throw Error('skin_eligibility_required');
  if (!Array.isArray(input.v2Axes)) throw Error('v2_axis_array_required');
  const eligible = input.skinAnalysisEligible;
  if (eligible ? input.photoStatus !== 'available' : input.photoStatus !== 'ineligible') {
    throw Error('photo_skin_eligibility_mismatch');
  }
  if (input.v2Axes.length !== (eligible ? SKIN_COMPARISON_AXES.length : 0)) {
    throw Error('v2_axis_count_invalid');
  }
  const signals = {};
  for (const row of input.v2Axes) {
    strictKeys(row, ROW_KEYS, 'invalid_v2_axis_fields');
    const { axis, state, value, confidence } = row;
    if (!EXPECTED.has(axis) || Object.hasOwn(signals, axis)) throw Error('invalid_or_duplicate_v2_axis');
    if (!STATES.has(state) || !CONF.has(confidence)) throw Error('invalid_v2_state_or_confidence');
    if (state === 'present') {
      if (!Number.isInteger(value) || value < 1 || value > 5 || confidence === 'unknown') {
        throw Error('invalid_v2_present_contract');
      }
    } else if (state === 'not_seen') {
      if (value !== 0 || confidence === 'unknown') throw Error('invalid_v2_not_seen_contract');
    } else if (value !== null || confidence !== 'unknown') {
      throw Error('invalid_v2_abstention_contract');
    }
    // A zero is evidence of absence ONLY if Skin-v2 explicitly says not_seen.
    // unknown / unassessable never become an observed zero or an absent cue.
    signals[axis] = (state === 'present' || state === 'not_seen')
      ? { state: 'observed', score: value, confidence }
      : { state, score: null, confidence: 'unknown' };
  }
  if (eligible && Object.keys(signals).length !== EXPECTED.size) throw Error('missing_v2_axes');
  const {captureId,subjectGroupId,capturedAt,photoStatus,conditions} = input;
  return {captureId,subjectGroupId,capturedAt,photoStatus,conditions,signals};
}

export function compareExplicitSkinV2Sessions(before, after) {
  const mappedBefore = v2Session(before);
  const mappedAfter = v2Session(after);
  const comparison = compareSkinPhotoSessions(mappedBefore, mappedAfter);
  return {
    ...comparison,
    adapterVersion: SKIN_S3_V2_ADAPTER_VERSION,
    evidenceBoundary: {
      explicitV2StateRequired: true,
      legacyZeroInferredAsAbsent: false,
      abstentionConvertedToZero: false,
      skinEligibilitySeparateFromFace: true,
      sameSubjectAndCaptureConditionsIndependentlyVerified: false,
      actualRepeatPhotoStudyCompleted: false,
      improvementClaimAuthorized: false
    }
  };
}
