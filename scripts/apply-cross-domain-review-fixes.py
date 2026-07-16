from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

path = "lib/cross-domain-consistency.js"
replace_once(
    path,
    'const STOP_ACTIONS = new Set(["hold", "remove", "replace", "stop"]);',
    'const STOP_ACTIONS = new Set(["hold", "remove", "replace", "stop"]);\nconst CAUSATION_ACTIONS = new Set(["remove", "replace", "stop"]);\nconst CAUSATION_REASON_TOKENS = ["reaction", "suspected_product", "product_blame", "caused_by_product"];'
)
replace_once(
    path,
    '''function productActionFor(policy = {}, row = {}) {
  const actions = policy?.productActions || [];
  return actions.filter((item) => {
    if (row?.productId && item?.productId) return String(item.productId) === String(row.productId);
    return !row?.productId && item?.slotKey && (row?.routineSlots || []).includes(item.slotKey);
  });
}
''',
    '''function productActionFor(policy = {}, row = {}) {
  const actions = policy?.productActions || [];
  return actions.filter((item) => {
    if (row?.productId && item?.productId) return String(item.productId) === String(row.productId);
    return !row?.productId && !item?.productId && item?.slotKey && (row?.routineSlots || []).includes(item.slotKey);
  });
}

function claimsProductCausation(item = {}) {
  if (CAUSATION_ACTIONS.has(item?.action)) return true;
  if (item?.action !== "hold") return false;
  return (item?.reasonCodes || []).some((code) =>
    CAUSATION_REASON_TOKENS.some((token) => String(code || "").includes(token))
  );
}
'''
)
replace_once(
    path,
    '''  const productSpecificStops = (routinePolicy?.productActions || []).filter((item) => item?.productId && STOP_ACTIONS.has(item?.action));
  if (productSpecificStops.length && !reactionEvidence(sharedContext)) {
''',
    '''  const productSpecificCausation = (routinePolicy?.productActions || [])
    .filter((item) => item?.productId && claimsProductCausation(item));
  if (productSpecificCausation.length && !reactionEvidence(sharedContext)) {
'''
)

path = "scripts/verify-cross-domain-consistency.mjs"
replace_once(
    path,
    '''const noReaction = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({ productActions: [{ slotKey: "pm.treatment", productId: "known", action: "hold" }] })
});
assert.ok(noReaction.violations.some((item) => item.ruleId === "CONSISTENCY_PRODUCT_BLAME_WITHOUT_REACTION_EVIDENCE"));
''',
    '''const genericStabilizationHold = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({
    productActions: [{
      slotKey: "pm.treatment",
      productId: "known",
      action: "hold",
      reasonCodes: ["stabilize_first_active_hold"]
    }]
  })
});
assert.ok(
  !genericStabilizationHold.violations.some((item) => item.ruleId === "CONSISTENCY_PRODUCT_BLAME_WITHOUT_REACTION_EVIDENCE"),
  "a generic stabilization hold must not be misclassified as product causation"
);

const noReaction = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({
    productActions: [{
      slotKey: "pm.treatment",
      productId: "known",
      action: "hold",
      reasonCodes: ["suspected_product_reaction"]
    }]
  })
});
assert.ok(noReaction.violations.some((item) => item.ruleId === "CONSISTENCY_PRODUCT_BLAME_WITHOUT_REACTION_EVIDENCE"));

const unknownWithoutId = buildCrossDomainConsistency({
  ...normalInput,
  sharedContext: baseContext({
    productExposureState: {
      rows: [{ sourceState: "not_in_db", productId: null, routineSlots: ["pm.treatment"], evaluable: false }],
      unknownProductCount: 1,
      duplicateActiveAxes: []
    }
  }),
  routinePolicy: baseRoutine({
    productActions: [{ slotKey: "pm.treatment", productId: "known", action: "hold" }],
    confidence: "medium"
  }),
  conditionPolicy: baseCondition({ confidence: "medium" })
});
assert.ok(
  !unknownWithoutId.violations.some((item) => item.ruleId === "CONSISTENCY_UNKNOWN_PRODUCT_STOP"),
  "a slot-shared known product action must not be assigned to an unidentified unknown product"
);
'''
)

# Document the distinction between stabilization hold and causation.
path = "docs/architecture/cross-domain-consistency-v1.md"
p = Path(path)
text = p.read_text(encoding="utf-8")
text = text.replace(
    "The fallback blocks new active expansion, sets active frequency to zero, keeps cleansing/hydration/barrier support/sun protection, forbids unknown-product replacement, and preserves actual condition signals without inventing product causation.",
    "The fallback blocks new active expansion, sets active frequency to zero, keeps cleansing/hydration/barrier support/sun protection, forbids unknown-product replacement, and preserves actual condition signals without inventing product causation. A known active product may receive a generic stabilization hold without being labeled as the cause of a reaction; product-specific causation requires explicit reaction evidence."
)
p.write_text(text, encoding="utf-8")
