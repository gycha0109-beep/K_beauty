from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# A coherent orchestrated state should remain raw; fallback is only for actual contradictions.
replace_once(
    "scripts/verify-cross-domain-consistency.mjs",
    'assert.equal(decisionState.effectivePolicySource, "stabilization_fallback");',
    'assert.equal(decisionState.effectivePolicySource, "raw");\nassert.equal(decisionState.consistency.verdict, "consistent");'
)

# Bundle v5 is a deliberate canonical contract migration; update exact legacy version assertions.
for verifier in Path("scripts").glob("verify-*.mjs"):
    text = verifier.read_text(encoding="utf-8")
    if "premium-decision-bundle-v4" in text:
        verifier.write_text(text.replace("premium-decision-bundle-v4", "premium-decision-bundle-v5"), encoding="utf-8")

# The main bundle verifier also proves the new metadata contract.
replace_once(
    "scripts/verify-premium-decision-state.mjs",
    'assert.equal(emptyState.decisionBundle.version, "premium-decision-bundle-v5");',
    'assert.equal(emptyState.decisionBundle.version, "premium-decision-bundle-v5");\nassert.ok(emptyState.decisionBundle.rawPolicies.functional);\nassert.ok(emptyState.decisionBundle.consistency);\nassert.equal(emptyState.decisionBundle.effectivePolicySource, "raw");'
)
