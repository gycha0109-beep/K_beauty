export const EXFOLIATION_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION =
  "exfoliation-non-numeric-pda-shadow-recommendation-adapter-v1";

const APPLICABLE_CATEGORIES = new Set(["toner_essence", "toner_pad", "treatment"]);
const SIGNAL_STATUS_TO_PRESENCE = Object.freeze({
  GOVERNED_SIGNAL_ESTABLISHED: "present",
  GOVERNED_SIGNAL_NOT_ESTABLISHED: "not_established",
  GOVERNED_SIGNAL_UNKNOWN: "unknown",
  GOVERNED_SIGNAL_BLOCKED: "blocked",
  NOT_APPLICABLE: "not_applicable"
});
const KNOWN_NO_VALUES = new Set(["no", "none_reported"]);
const KNOWN_YES_VALUES = new Set(["yes", "reported_unlinked", "unresolved"]);

function text(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])])
  );
}

function cloneStable(value) {
  return stable(structuredClone(value));
}

function sortedUnique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "en")
  );
}

function productId(value) {
  return text(value?.id || value?.productId || value?.product_id || value);
}

function recordProductId(record) {
  return text(record?.product_id || record?.productId || record?.id);
}

function indexPdaRecords(records) {
  const index = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const id = recordProductId(record);
    if (id && !index.has(id)) index.set(id, record);
  }
  return index;
}

function presenceState(record) {
  if (!record || typeof record !== "object") return "missing";
  const status = text(record?.pda?.signal_status);
  return SIGNAL_STATUS_TO_PRESENCE[status] || "unknown";
}

function identityItems(record) {
  return sortedUnique(
    (Array.isArray(record?.pda?.active_identities?.items) ? record.pda.active_identities.items : [])
      .map((item) => item?.identity)
  );
}

function pdaSetState(record) {
  const presence = presenceState(record);
  return {
    state: presence,
    items: presence === "present" ? identityItems(record) : [],
    semantic_ordering: "NONE"
  };
}

function categoryWindows(category, activePresence) {
  if (activePresence !== "present") return [];
  const normalized = text(category).toLowerCase();
  return APPLICABLE_CATEGORIES.has(normalized) ? ["pm.treatment"] : [];
}

function normalizeRoutineRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      product_id: productId(row),
      source_state: text(row?.sourceState || row?.source_state).toLowerCase() || "unknown",
      routine_windows: sortedUnique(row?.routineSlots || row?.routine_windows || row?.routineWindows)
    }))
    .filter((row) => row.product_id || row.source_state !== "unknown")
    .sort((left, right) => left.product_id.localeCompare(right.product_id, "en"));
}

function normalizeYesNoUnknown(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  const normalized = text(value).toLowerCase();
  if (["yes", "true", "1"].includes(normalized)) return "yes";
  if (["no", "false", "0"].includes(normalized)) return "no";
  return normalized || "unknown";
}

export function buildExfoliationNonNumericPdaShadowExternalContext({
  canonicalState,
  candidates,
  pdaRecords
} = {}) {
  const sharedContext = canonicalState?.decisionBundle?.context || {};
  const exposure = sharedContext?.productExposureState || {};
  const rows = normalizeRoutineRows(exposure?.rows || exposure?.selectedProducts || []);
  const pdaIndex = indexPdaRecords(pdaRecords);
  const candidateRoutineWindows = Object.fromEntries(
    (Array.isArray(candidates) ? candidates : [])
      .map((candidate) => {
        const id = productId(candidate);
        const record = pdaIndex.get(id);
        return [id, categoryWindows(candidate?.category || record?.category, presenceState(record))];
      })
      .filter(([id]) => id)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
  );

  return {
    candidate_set: (Array.isArray(candidates) ? candidates : [])
      .map((candidate) => ({
        product_id: productId(candidate),
        category: text(candidate?.category).toLowerCase() || null
      }))
      .filter((candidate) => candidate.product_id)
      .sort((left, right) => left.product_id.localeCompare(right.product_id, "en")),
    current_product_set: rows,
    current_product_set_completeness: exposure?.unknownExposurePresent === true ||
      rows.some((row) => ["not_in_db", "unanswered"].includes(row.source_state))
      ? "partial"
      : rows.length ? "known" : "empty",
    candidate_routine_windows: candidateRoutineWindows,
    safety_state: {
      level: text(sharedContext?.safetyState?.level).toLowerCase() || "unknown",
      sensitive_burden: sharedContext?.safetyState?.sensitiveBurden === true
        ? "yes"
        : sharedContext?.safetyState?.sensitiveBurden === false ? "no" : "unknown",
      exfoliation_expansion_allowed: sharedContext?.safetyState?.exfoliationExpansionAllowed === true
        ? "yes"
        : sharedContext?.safetyState?.exfoliationExpansionAllowed === false ? "no" : "unknown"
    },
    user_sensitivity_state: text(sharedContext?.skinState?.sensitivity).toLowerCase() || "unknown",
    recent_skin_or_product_change_state: {
      recent_skin_change: normalizeYesNoUnknown(
        sharedContext?.conditionSignalState?.recentSkinChange ?? sharedContext?.safetyState?.recentSkinChange
      ),
      recent_product_change: normalizeYesNoUnknown(
        sharedContext?.conditionSignalState?.recentProductChange ??
          sharedContext?.safetyState?.recentlyChangedProduct ??
          sharedContext?.safetyState?.recentProductChange
      )
    },
    reaction_instability_state: {
      product_reaction: normalizeYesNoUnknown(sharedContext?.conditionSignalState?.productReaction),
      reaction_link_state: text(exposure?.reactionLinkState).toLowerCase() || "unknown",
      recent_exposure_state: text(exposure?.recentExposureState).toLowerCase() || "unknown"
    }
  };
}

function currentProductRecords(externalContext, pdaIndex, candidateId) {
  const rows = Array.isArray(externalContext?.current_product_set)
    ? externalContext.current_product_set
    : [];
  return rows
    .filter((row) => row?.source_state === "selected" && row?.product_id && row.product_id !== candidateId)
    .map((row) => ({ row, record: pdaIndex.get(row.product_id) || null }))
    .sort((left, right) => left.row.product_id.localeCompare(right.row.product_id, "en"));
}

function overlapState(candidateRecord, currentRecords, externalContext) {
  const candidatePresence = presenceState(candidateRecord);
  if (["missing", "blocked", "not_applicable", "unknown"].includes(candidatePresence)) {
    return { state: candidatePresence, items: [] };
  }
  if (candidatePresence === "not_established") return { state: "not_established", items: [] };

  const candidateIdentities = new Set(identityItems(candidateRecord));
  const byIdentity = new Map();
  let unresolved = externalContext?.current_product_set_completeness === "partial";
  for (const { row, record } of currentRecords) {
    const currentPresence = presenceState(record);
    if (["missing", "unknown", "blocked"].includes(currentPresence)) unresolved = true;
    if (currentPresence !== "present") continue;
    for (const identity of identityItems(record)) {
      if (!candidateIdentities.has(identity)) continue;
      const ids = byIdentity.get(identity) || [];
      ids.push(row.product_id);
      byIdentity.set(identity, ids);
    }
  }
  const items = Array.from(byIdentity.entries())
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([identity, productIds]) => ({
      identity,
      current_product_ids: sortedUnique(productIds)
    }));
  if (items.length) return { state: "present", items };
  if (unresolved) return { state: "unknown", items: [] };
  return { state: "not_established", items: [] };
}

function duplicateState(candidateRecord, currentRecords, externalContext) {
  const candidatePresence = presenceState(candidateRecord);
  if (["missing", "blocked", "not_applicable", "unknown"].includes(candidatePresence)) return candidatePresence;
  if (candidatePresence === "not_established") return "not_established";

  let unresolved = externalContext?.current_product_set_completeness === "partial";
  for (const { record } of currentRecords) {
    const state = presenceState(record);
    if (state === "present") return "present";
    if (["missing", "unknown", "blocked"].includes(state)) unresolved = true;
  }
  return unresolved ? "unknown" : "not_established";
}

function routineStackingState(candidateRecord, currentRecords, externalContext) {
  return duplicateState(candidateRecord, currentRecords, externalContext);
}

function sameWindowState(candidateId, candidateRecord, currentRecords, externalContext) {
  const candidatePresence = presenceState(candidateRecord);
  if (["missing", "blocked", "not_applicable", "unknown"].includes(candidatePresence)) return candidatePresence;
  if (candidatePresence === "not_established") return "not_established";

  const candidateWindows = sortedUnique(externalContext?.candidate_routine_windows?.[candidateId]);
  if (!candidateWindows.length) return "unknown";
  let unresolved = externalContext?.current_product_set_completeness === "partial";
  for (const { row, record } of currentRecords) {
    const currentPresence = presenceState(record);
    if (["missing", "unknown", "blocked"].includes(currentPresence)) unresolved = true;
    if (currentPresence !== "present") continue;
    const windows = sortedUnique(row?.routine_windows);
    if (!windows.length) {
      unresolved = true;
      continue;
    }
    if (candidateWindows.some((window) => windows.includes(window))) return "present";
  }
  return unresolved ? "unknown" : "not_established";
}

function recommendedUseFrequencyContext(record) {
  const presence = presenceState(record);
  if (presence === "not_applicable") return { state: "not_applicable", values: [] };
  if (presence === "blocked") return { state: "blocked", values: [] };
  if (presence === "missing") return { state: "missing", values: [] };
  const values = Array.isArray(record?.pda?.context?.recommended_use_frequency)
    ? record.pda.context.recommended_use_frequency
    : [];
  if (values.length) {
    return {
      state: "present",
      values: cloneStable(values)
    };
  }
  if (record?.pda?.coverage?.missing_context_keys?.includes("recommended_use_frequency")) {
    return { state: "missing", values: [] };
  }
  return { state: presence === "unknown" ? "unknown" : "not_established", values: [] };
}

function sensitivityInteractionState(record, externalContext) {
  const presence = presenceState(record);
  if (["missing", "blocked", "not_applicable"].includes(presence)) return presence;
  if (presence === "unknown") return "unknown";
  if (presence === "not_established") return "none_established";

  const sensitivity = text(externalContext?.user_sensitivity_state).toLowerCase() || "unknown";
  const safety = externalContext?.safety_state || {};
  if (
    sensitivity === "high" ||
    safety.sensitive_burden === "yes" ||
    ["caution", "stabilize_first"].includes(safety.level)
  ) return "caution";
  if (sensitivity === "low" && safety.sensitive_burden === "no" && safety.level === "stable") {
    return "none_established";
  }
  return "unknown";
}

function reactionInstabilityInteractionState(record, externalContext) {
  const presence = presenceState(record);
  if (["missing", "blocked", "not_applicable"].includes(presence)) return presence;
  if (presence === "unknown") return "unknown";
  if (presence === "not_established") return "none_established";

  const changes = externalContext?.recent_skin_or_product_change_state || {};
  const reaction = externalContext?.reaction_instability_state || {};
  const values = [
    changes.recent_skin_change,
    changes.recent_product_change,
    reaction.product_reaction,
    reaction.reaction_link_state,
    reaction.recent_exposure_state
  ].map((value) => text(value).toLowerCase() || "unknown");
  if (values.some((value) => KNOWN_YES_VALUES.has(value))) return "caution";
  if (values.every((value) => KNOWN_NO_VALUES.has(value))) return "none_established";
  return "unknown";
}

function cautionRestrictionState({
  record,
  duplicateExfoliationState,
  sameWindowConflictState,
  sensitivityInteractionState: sensitivityState,
  reactionInstabilityInteractionState: reactionState,
  externalContext
}) {
  const presence = presenceState(record);
  if (["missing", "blocked", "not_applicable"].includes(presence)) {
    return { state: presence, reason_codes: [] };
  }
  if (presence === "unknown") {
    return { state: "unknown", reason_codes: ["GOVERNED_EXFOLIATION_SIGNAL_UNKNOWN"] };
  }
  if (presence === "not_established") return { state: "none_established", reason_codes: [] };

  const reasons = [];
  const expansionAllowed = externalContext?.safety_state?.exfoliation_expansion_allowed || "unknown";
  if (expansionAllowed === "no") reasons.push("EXFOLIATION_EXPANSION_NOT_ALLOWED");
  if (duplicateExfoliationState === "present") reasons.push("DUPLICATE_EXFOLIATION_PRESENT");
  if (sameWindowConflictState === "present") reasons.push("SAME_WINDOW_EXFOLIATION_CONFLICT");
  if (sensitivityState === "caution") reasons.push("SENSITIVITY_INTERACTION_CAUTION");
  if (reactionState === "caution") reasons.push("REACTION_INSTABILITY_CAUTION");

  if (expansionAllowed === "no" || reactionState === "caution") {
    return { state: "restriction_candidate", reason_codes: sortedUnique(reasons) };
  }
  if (reasons.length) return { state: "caution", reason_codes: sortedUnique(reasons) };
  if (
    expansionAllowed === "unknown" ||
    [duplicateExfoliationState, sameWindowConflictState, sensitivityState, reactionState].includes("unknown")
  ) {
    return { state: "unknown", reason_codes: ["EXTERNAL_CONTEXT_UNCERTAIN"] };
  }
  return { state: "none_established", reason_codes: [] };
}

function coverageState(record) {
  if (!record || typeof record !== "object") {
    return { state: "missing", applicable_category: null, missing_context_keys: [] };
  }
  const coverage = record?.pda?.coverage || {};
  return {
    state: text(coverage.state) || "unknown",
    applicable_category: coverage.applicable_category ?? null,
    missing_context_keys: sortedUnique(coverage.missing_context_keys)
  };
}

function uncertaintyState(record, externalContext) {
  const intrinsic = sortedUnique(record?.pda?.uncertainty?.reasons);
  const external = [];
  if (externalContext?.current_product_set_completeness === "partial") {
    external.push("CURRENT_PRODUCT_SET_PARTIAL");
  }
  if (externalContext?.safety_state?.level === "unknown") external.push("SAFETY_STATE_UNKNOWN");
  if (externalContext?.user_sensitivity_state === "unknown") external.push("USER_SENSITIVITY_UNKNOWN");
  return {
    intrinsic_reasons: intrinsic,
    external_context_reasons: sortedUnique(external),
    unknown_preserved: true,
    missing_preserved: true
  };
}

function provenance(record, authority = {}) {
  return {
    adapter_version: EXFOLIATION_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
    pda_contract_version: record?.pda?.contract_version || authority?.contract_version || null,
    pda_signal_status: record?.pda?.signal_status || null,
    pda_multi_active_status: record?.pda?.multi_active_status || null,
    pda_mapper_version: authority?.mapper_version || null,
    pda_snapshot_sha256: authority?.snapshot_sha256 || null,
    evidence_provenance: cloneStable(record?.pda?.evidence_provenance || []),
    cross_product_overlap_derivation: "GOVERNED_ACTIVE_IDENTITY_INTERSECTION_ONLY",
    external_context_embedded_in_intrinsic_pda: false
  };
}

export function adaptExfoliationNonNumericPdaShadowDecisionInput({
  product,
  pdaRecord,
  pdaRecords,
  externalContext,
  pdaAuthority
} = {}) {
  const id = productId(product || pdaRecord);
  const pdaIndex = indexPdaRecords(pdaRecords);
  const record = pdaRecord || pdaIndex.get(id) || null;
  const currentRecords = currentProductRecords(externalContext, pdaIndex, id);
  const activeIdentitySet = pdaSetState(record);
  const identityOverlapSet = overlapState(record, currentRecords, externalContext);
  const duplicateExfoliationState = duplicateState(record, currentRecords, externalContext);
  const routineStacking = routineStackingState(record, currentRecords, externalContext);
  const sameWindowConflict = sameWindowState(id, record, currentRecords, externalContext);
  const sensitivityState = sensitivityInteractionState(record, externalContext);
  const reactionState = reactionInstabilityInteractionState(record, externalContext);
  const cautionRestriction = cautionRestrictionState({
    record,
    duplicateExfoliationState,
    sameWindowConflictState: sameWindowConflict,
    sensitivityInteractionState: sensitivityState,
    reactionInstabilityInteractionState: reactionState,
    externalContext
  });

  return {
    product_id: id,
    shadow_decision_input: {
      active_presence_state: presenceState(record),
      active_identity_set: activeIdentitySet,
      identity_overlap_set: identityOverlapSet,
      duplicate_exfoliation_state: duplicateExfoliationState,
      routine_stacking_state: routineStacking,
      same_window_conflict_state: sameWindowConflict,
      recommended_use_frequency_context: recommendedUseFrequencyContext(record),
      sensitivity_interaction_state: sensitivityState,
      reaction_instability_interaction_state: reactionState,
      caution_restriction_shadow_input: cautionRestriction,
      coverage_state: coverageState(record),
      uncertainty_state: uncertaintyState(record, externalContext),
      provenance: provenance(record, pdaAuthority)
    }
  };
}

export function buildExfoliationNonNumericPdaShadowDecisionInputs({
  candidates,
  pdaArtifact,
  canonicalState
} = {}) {
  const products = Array.isArray(candidates) ? candidates : [];
  const pdaRecords = Array.isArray(pdaArtifact?.products) ? pdaArtifact.products : [];
  if (!pdaArtifact || !pdaRecords.length) {
    return {
      adapter_version: EXFOLIATION_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
      status: "pda_artifact_not_supplied",
      shadow_only: true,
      rows: []
    };
  }

  const externalContext = buildExfoliationNonNumericPdaShadowExternalContext({
    canonicalState,
    candidates: products,
    pdaRecords
  });
  const pdaIndex = indexPdaRecords(pdaRecords);
  const pdaAuthority = {
    contract_version: pdaArtifact?.contract_authority?.contract_version || null,
    mapper_version: pdaArtifact?.mapper_version || null,
    snapshot_sha256: pdaArtifact?.snapshot_sha256 || null
  };
  const rows = products.map((product) =>
    adaptExfoliationNonNumericPdaShadowDecisionInput({
      product,
      pdaRecord: pdaIndex.get(productId(product)) || null,
      pdaRecords,
      externalContext,
      pdaAuthority
    })
  );

  return {
    adapter_version: EXFOLIATION_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
    status: "evaluated",
    shadow_only: true,
    authority: pdaAuthority,
    external_context: externalContext,
    rows
  };
}
