export const REHEARSAL_SCENARIO_MATRIX = Object.freeze([
  ...Array.from({ length: 8 }, (_, index) => Object.freeze({ id: `aligned_${index + 1}`, kind: "aligned_promotion_path", terminalOutcome: "promoted_g4", evidenceProbe: "promotion_prepare" })),
  ...Array.from({ length: 3 }, (_, index) => Object.freeze({ id: `ineligible_${index + 1}`, kind: "observation_valid_ineligible", terminalOutcome: "observation_valid_ineligible", evidenceProbe: "observation_ineligible" })),
  ...Array.from({ length: 2 }, (_, index) => Object.freeze({ id: `generation_failure_${index + 1}`, kind: "generation_technical_failure", terminalOutcome: "generation_failed_no_asset", evidenceProbe: "campaign_retry" })),
  Object.freeze({ id: "observation_failure_1", kind: "observation_technical_failure", terminalOutcome: "observation_failed", evidenceProbe: "observation_failure" }),
  ...Array.from({ length: 2 }, (_, index) => Object.freeze({ id: `misaligned_${index + 1}`, kind: "misaligned_negative_control", terminalOutcome: "retained_g3_negative_control", evidenceProbe: "promotion_negative_control" })),
  Object.freeze({ id: "rights_hold_1", kind: "rights_hold", terminalOutcome: "promotion_held", evidenceProbe: "promotion_rights_hold" }),
  Object.freeze({ id: "external_mark_block_1", kind: "external_mark_block", terminalOutcome: "promotion_rejected", evidenceProbe: "promotion_mark_block" }),
  Object.freeze({ id: "exact_duplicate_alias_1", kind: "exact_duplicate_alias", terminalOutcome: "retained_g3_negative_control", evidenceProbe: "promotion_duplicate_alias" }),
  Object.freeze({ id: "perceptual_hold_1", kind: "perceptual_leakage_hold", terminalOutcome: "promotion_held", evidenceProbe: "promotion_perceptual_hold" })
]);

export const EXPECTED_TERMINAL_COUNTS = Object.freeze(REHEARSAL_SCENARIO_MATRIX.reduce((counts, scenario) => {
  counts[scenario.terminalOutcome] = (counts[scenario.terminalOutcome] || 0) + 1;
  return counts;
}, {}));

export function bindScenariosToSlots(slots) {
  const ordered = [...slots].sort((left, right) => left.waveOrdinal - right.waveOrdinal || left.slotId.localeCompare(right.slotId));
  if (ordered.length !== REHEARSAL_SCENARIO_MATRIX.length) throw new Error("rehearsal_slot_count_invalid");
  return ordered.map((slot, index) => Object.freeze({ slot, scenario: REHEARSAL_SCENARIO_MATRIX[index] }));
}
