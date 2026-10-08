import {
  getFaceLabVisualTryOnSlotSupport,
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS
} from "./visual-try-on-registry.js";
import {
  bindFaceLabCatalogTryOnReferences
} from "./catalog-reference-resolver.js";
import {
  createFaceLabProductVariantRef
} from "./product-variant-authority.js";

export const FACE_LAB_TRY_ON_LOOK_SESSION_VERSION =
  "face-lab-try-on-look-session-v1";

const MAX_ACTION_HISTORY = 32;
const MAX_REVISION = 100_000;
const MAX_SELECTIONS = FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS.length;
const ACTIONS = new Set(["add", "replace", "remove", "clear"]);

function text(value) {
  return typeof value === "string" && value.trim()
    ? value.trim() : null;
}

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function invalid(reason, extra = {}) {
  return {
    sessionVersion: FACE_LAB_TRY_ON_LOOK_SESSION_VERSION,
    status: "invalid",
    reason,
    state: null,
    authority: null,
    renderSpec: null,
    provenance: [],
    referenceCount: 0,
    imageModelInvoked: false,
    ...extra
  };
}

function validSlot(slotKey) {
  return Boolean(
    text(slotKey) &&
    getFaceLabVisualTryOnSlotSupport(slotKey)?.supportState === "supported"
  );
}

function inspectState(state) {
  if (
    !isObject(state) ||
    state.sessionVersion !== FACE_LAB_TRY_ON_LOOK_SESSION_VERSION ||
    !text(state.sessionId) ||
    state.sessionId.length > 160 ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    state.revision >= MAX_REVISION ||
    !Array.isArray(state.selections) ||
    state.selections.length > MAX_SELECTIONS ||
    !Array.isArray(state.history) ||
    state.history.length > MAX_ACTION_HISTORY
  ) {
    return { valid: false, reason: "look_state_invalid" };
  }
  const seen = new Set();
  for (const selection of state.selections) {
    const slotKey = selection?.slotKey;
    if (
      !isObject(selection) ||
      !validSlot(slotKey) ||
      seen.has(slotKey) ||
      selection.referenceAssets !== undefined
    ) {
      return { valid: false, reason: "look_state_selection_invalid" };
    }
    seen.add(slotKey);
  }
  if (state.history.some(entry =>
    !isObject(entry) ||
    !Number.isSafeInteger(entry.revision) ||
    !ACTIONS.has(entry.action) ||
    !Array.isArray(entry.slotKeys) ||
    entry.slotKeys.some(key => !validSlot(key))
  )) {
    return { valid: false, reason: "look_state_history_invalid" };
  }
  return { valid: true };
}

function resultFromSelections(state, catalogAssets) {
  if (state.selections.length === 0) {
    return {
      sessionVersion: FACE_LAB_TRY_ON_LOOK_SESSION_VERSION,
      status: "ready",
      reason: "empty_look",
      state,
      authority: null,
      renderSpec: null,
      provenance: [],
      referenceCount: 0,
      imageModelInvoked: false
    };
  }

  const bound = bindFaceLabCatalogTryOnReferences({
    sessionId: state.sessionId,
    productSelections: state.selections,
    catalogAssets
  });

  if (bound.status !== "ready") {
    return invalid(bound.reason);
  }
  return {
    sessionVersion: FACE_LAB_TRY_ON_LOOK_SESSION_VERSION,
    status: "ready",
    reason: "look_composed",
    state,
    authority: bound.authority,
    renderSpec: bound.authority.renderSpec,
    provenance: bound.provenance,
    referenceCount: bound.authority.referenceAssets.length,
    imageModelInvoked: false
  };
}

export function createFaceLabVisualTryOnLookSession({
  sessionId
} = {}) {
  const normalizedId = text(sessionId);
  if (!normalizedId || normalizedId.length > 160) {
    return invalid("session_id_invalid");
  }
  return resultFromSelections({
    sessionVersion: FACE_LAB_TRY_ON_LOOK_SESSION_VERSION,
    sessionId: normalizedId,
    revision: 0,
    selections: [],
    history: []
  }, []);
}

/**
 * Pure reducer for a product-driven "virtual vanity" session.
 * The client cannot silently supply reference assets; all selected assets
 * are resolved anew by the catalog reference authority.
 *
 * No database write, network request, image generation, or provider call.
 */
export function applyFaceLabVisualTryOnLookAction({
  state,
  expectedRevision,
  action,
  catalogAssets = []
} = {}) {
  const inspected = inspectState(state);
  if (!inspected.valid) {
    return invalid(inspected.reason);
  }
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== state.revision
  ) {
    return invalid("look_revision_conflict");
  }
  if (
    !isObject(action) ||
    !ACTIONS.has(action.type)
  ) {
    return invalid("look_action_invalid");
  }
  if (!Array.isArray(catalogAssets)) {
    return invalid("look_catalog_assets_invalid");
  }
  const slotKey = text(action.slotKey);
  const next = state.selections.map(selection =>
    structuredClone(selection)
  );
  const index = next.findIndex(selection =>
    selection.slotKey === slotKey
  );
  let affectedSlots = [];
  let selectedVariantRef = null;

  if (action.type === "clear") {
    if (next.length === 0) {
      return invalid("look_already_empty");
    }
    affectedSlots = next.map(selection => selection.slotKey).sort();
    next.length = 0;
  } else if (!validSlot(slotKey)) {
    return invalid("look_action_slot_invalid");
  } else if (action.type === "remove") {
    if (index < 0) {
      return invalid("look_slot_not_selected");
    }
    next.splice(index, 1);
    affectedSlots = [slotKey];
  } else {
    const selection = action.selection;
    if (
      !isObject(selection) ||
      selection.slotKey !== slotKey ||
      selection.referenceAssets !== undefined
    ) {
      return invalid("look_action_selection_invalid");
    }
    selectedVariantRef = createFaceLabProductVariantRef({
      productId: selection.product?.id,
      variantId: selection.variant?.variantId
    });
    if (!selectedVariantRef) {
      return invalid("look_action_variant_invalid");
    }
    if (action.type === "add") {
      if (index >= 0) {
        return invalid("look_slot_already_selected");
      }
      next.push(structuredClone(selection));
    } else {
      if (index < 0) {
        return invalid("look_slot_not_selected");
      }
      next[index] = structuredClone(selection);
    }
    affectedSlots = [slotKey];
  }

  next.sort((a, b) => a.slotKey.localeCompare(b.slotKey));

  const revision = state.revision + 1;
  const history = [
    ...state.history.map(entry => structuredClone(entry)),
    {
      revision,
      action: action.type,
      slotKeys: affectedSlots,
      selectedVariantRef
    }
  ].slice(-MAX_ACTION_HISTORY);

  const nextState = {
    sessionVersion: FACE_LAB_TRY_ON_LOOK_SESSION_VERSION,
    sessionId: state.sessionId,
    revision,
    selections: next,
    history
  };

  return resultFromSelections(nextState, catalogAssets);
}
