function scenario(id, kind, evidenceProbe, campaignTerminalOutcome = "candidate_import_failed") {
  return Object.freeze({ id, kind, evidenceProbe, campaignTerminalOutcome });
}

export const REHEARSAL_SCENARIO_MATRIX = Object.freeze([
  ...Array.from({ length: 8 }, (_, index) => scenario(`aligned_${index + 1}`, "aligned_promotion_path", "promotion_prepare")),
  ...Array.from({ length: 3 }, (_, index) => scenario(`ineligible_${index + 1}`, "observation_valid_ineligible", "observation_ineligible")),
  ...Array.from({ length: 2 }, (_, index) => scenario(`generation_failure_${index + 1}`, "generation_technical_failure", "campaign_retry", "generation_failed_no_asset")),
  scenario("observation_failure_1", "observation_technical_failure", "observation_failure"),
  ...Array.from({ length: 2 }, (_, index) => scenario(`misaligned_${index + 1}`, "misaligned_negative_control", "promotion_negative_control")),
  scenario("rights_hold_1", "rights_hold", "promotion_rights_hold"),
  scenario("external_mark_block_1", "external_mark_block", "promotion_mark_block"),
  scenario("exact_duplicate_alias_1", "exact_duplicate_alias", "promotion_duplicate_alias"),
  scenario("perceptual_hold_1", "perceptual_leakage_hold", "promotion_perceptual_hold")
]);

export const EXPECTED_TERMINAL_COUNTS = Object.freeze(REHEARSAL_SCENARIO_MATRIX.reduce((counts, item) => {
  counts[item.campaignTerminalOutcome] = (counts[item.campaignTerminalOutcome] || 0) + 1;
  return counts;
}, {}));

export function bindScenariosToSlots(slots) {
  const ordered = [...slots].sort((left, right) => left.waveOrdinal - right.waveOrdinal || left.slotId.localeCompare(right.slotId));
  if (ordered.length !== REHEARSAL_SCENARIO_MATRIX.length) throw new Error("rehearsal_slot_count_invalid");
  return ordered.map((slot, index) => Object.freeze({ slot, scenario: REHEARSAL_SCENARIO_MATRIX[index] }));
}
