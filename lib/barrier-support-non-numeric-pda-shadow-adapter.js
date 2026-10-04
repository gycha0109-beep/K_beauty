export const BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION =
  "barrier-support-non-numeric-pda-shadow-recommendation-adapter-v1";

const PRESENCE_BY_SIGNAL = Object.freeze({
  GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE: "present",
  GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE: "explicit_negative",
  GOVERNED_BARRIER_CLAIM_UNKNOWN: "unknown",
  GOVERNED_BARRIER_CLAIM_BLOCKED: "blocked",
  NOT_APPLICABLE: "not_applicable"
});

const RELEVANT_USER_AXES = new Set(["barrier", "dehydration"]);

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
  return value == null ? value : stable(structuredClone(value));
}

function sortedUnique(values) {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, "en"));
}

function productId(value) {
  return text(value?.id || value?.productId || value?.product_id || value);
}

function indexPdaRecords(records) {
  const index = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const id = productId(record);
    if (id && !index.has(id)) index.set(id, record);
  }
  return index;
}

function normalizeConcernAxes(value) {
  if (!Array.isArray(value)) return null;
  return sortedUnique(value);
}

function usageRoleContext(productState, presence) {
  if (presence === "not_applicable") {
    return { state: "not_applicable", values: [] };
  }

  const rawState = text(productState?.primary_use_role_state).toUpperCase();
  if (rawState === "ESTABLISHED") {
    return {
      state: "established",
      values: sortedUnique(productState?.primary_use_role_values)
    };
  }
  if (rawState === "BLOCKED") return { state: "blocked", values: [] };
  if (rawState === "UNKNOWN") return { state: "unknown", values: [] };
  return { state: "missing", values: [] };
}

function userRelevance(presence, concernAxes) {
  if (presence === "not_applicable") {
    return { state: "not_applicable", relevant_axes: [] };
  }
  if (concernAxes === null) {
    return { state: "unknown", relevant_axes: [] };
  }
  const relevant = concernAxes.filter((axis) => RELEVANT_USER_AXES.has(axis));
  return {
    state: relevant.length ? "relevant" : "not_relevant",
    relevant_axes: relevant
  };
}

function annotationAuthority(presence, relevance) {
  if (presence === "not_applicable") return "not_applicable";
  if (presence === "blocked") return "blocked";
  if (relevance === "unknown") return "held_unknown_user_context";
  if (relevance === "not_relevant") return "not_relevant";
  if (presence === "unknown") return "held_unknown_product_fact";
  if (presence === "present") return "positive_claim_context_available";
  if (presence === "explicit_negative") return "explicit_negative_claim_context_available";
  return "held_unknown_product_fact";
}

export function adaptBarrierSupportNonNumericPdaShadowAnnotationInput({
  productState,
  userContext
} = {}) {
  const state = productState || {};
  const presence = PRESENCE_BY_SIGNAL[text(state.signal_state)] || "unknown";
  const concernAxes = normalizeConcernAxes(userContext?.concern_axes);
  const relevance = userRelevance(presence, concernAxes);
  const role = usageRoleContext(state, presence);

  return {
    barrier_claim_presence_state: presence,
    user_relevance_state: relevance.state,
    relevant_user_axes: relevance.relevant_axes,
    usage_role_context: role,
    annotation_authority_state: annotationAuthority(presence, relevance.state),
    coverage_state: state.coverage_state ?? null,
    uncertainty_state: {
      reasons: Array.isArray(state.uncertainty_reasons)
        ? [...state.uncertainty_reasons]
        : []
    },
    scope_state: state.scope_resolution_state ?? null,
    provenance: state.provenance ?? "PRESERVE_INTRINSIC_ONLY",
    numeric_contribution: null,
    rank_effect: "NONE",
    eligibility_effect: "NONE"
  };
}

export function buildBarrierSupportNonNumericPdaShadowUserContext(canonicalState = {}) {
  const context = canonicalState?.decisionBundle?.context || {};
  const answers = context?.survey?.answers || {};
  const selected = sortedUnique([
    answers?.mainConcern,
    ...(Array.isArray(answers?.mainConcerns) ? answers.mainConcerns : [])
  ]);

  if (selected.length) {
    return {
      concern_axes: selected,
      source: "survey_answers"
    };
  }

  const priorityAxis = text(context?.skinState?.priorityAxis);
  if (priorityAxis) {
    return {
      concern_axes: [priorityAxis],
      source: "priority_axis_fallback"
    };
  }

  return {
    concern_axes: null,
    source: "missing"
  };
}

function recordToProductState(record, authority = {}) {
  if (!record || typeof record !== "object") {
    return {
      signal_state: "GOVERNED_BARRIER_CLAIM_UNKNOWN",
      signal_value: null,
      coverage_state: "missing_fact",
      primary_use_role_state: "MISSING",
      primary_use_role_values: [],
      scope_resolution_state: "NO_SIGNAL",
      uncertainty_reasons: ["PDA_ARTIFACT_ROW_MISSING"],
      provenance: {
        adapter_version: BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
        pda_contract_version: authority.contract_version ?? null,
        pda_mapper_version: authority.mapper_version ?? null,
        pda_snapshot_sha256: authority.snapshot_sha256 ?? null,
        subject_scope: null,
        scope_resolution: { state: "NO_SIGNAL", fact_scopes: [] },
        evidence_provenance: [],
        intrinsic_pda_preserved: true,
        external_user_context_embedded_in_product_fact: false
      }
    };
  }

  const pda = record.pda || {};
  const role = pda?.context?.primary_use_role || {};
  return {
    signal_state: pda?.signal?.state ?? "GOVERNED_BARRIER_CLAIM_UNKNOWN",
    signal_value: pda?.signal?.value ?? null,
    coverage_state: pda?.coverage?.state ?? null,
    primary_use_role_state: role?.state ?? "MISSING",
    primary_use_role_values: (Array.isArray(role?.items) ? role.items : [])
      .map((item) => item?.value)
      .filter((value) => value != null),
    scope_resolution_state: pda?.scope_resolution?.state ?? null,
    uncertainty_reasons: Array.isArray(pda?.uncertainty?.reasons)
      ? [...pda.uncertainty.reasons]
      : [],
    provenance: {
      adapter_version: BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
      pda_contract_version: pda?.contract_version ?? authority.contract_version ?? null,
      pda_mapper_version: authority.mapper_version ?? null,
      pda_snapshot_sha256: authority.snapshot_sha256 ?? null,
      subject_scope: cloneStable(pda?.subject_scope ?? null),
      scope_resolution: cloneStable(pda?.scope_resolution ?? null),
      evidence_provenance: cloneStable(pda?.evidence_provenance ?? []),
      intrinsic_pda_preserved: true,
      external_user_context_embedded_in_product_fact: false
    }
  };
}

export function buildBarrierSupportNonNumericPdaShadowAnnotationInputs({
  candidates,
  pdaArtifact,
  canonicalState
} = {}) {
  const products = Array.isArray(candidates) ? candidates : [];
  const records = Array.isArray(pdaArtifact?.products) ? pdaArtifact.products : [];

  if (!pdaArtifact || !records.length) {
    return {
      adapter_version: BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
      status: "pda_artifact_not_supplied",
      shadow_only: true,
      rows: []
    };
  }

  const index = indexPdaRecords(records);
  const externalContext = buildBarrierSupportNonNumericPdaShadowUserContext(canonicalState);
  const authority = {
    contract_version: pdaArtifact?.contract_authority?.contract_version ?? null,
    mapper_version: pdaArtifact?.mapper_version ?? null,
    snapshot_sha256: pdaArtifact?.snapshot_sha256 ?? null
  };

  const rows = products.map((product) => {
    const id = productId(product);
    const record = index.get(id) || null;
    return {
      product_id: id,
      shadow_annotation_input: adaptBarrierSupportNonNumericPdaShadowAnnotationInput({
        productState: recordToProductState(record, authority),
        userContext: externalContext
      })
    };
  });

  return {
    adapter_version: BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION,
    status: "evaluated",
    shadow_only: true,
    authority,
    external_context: externalContext,
    rows
  };
}
