# EVAL-P8 — Bounded LLM Judge Evaluation v1

## 1. Stage Result

`SEMANTIC_RESULT = SUCCESS`

`TERMINAL_OUTCOME = BOUNDED_LLM_JUDGE_DIAGNOSTIC_CHANNEL_ESTABLISHED_WITH_PARTIAL_BLINDNESS_AND_RELEASE_BLOCKER_AUTHORITY_NOT_GRANTED`

This Stage establishes a bounded qualitative LLM Judge channel for synthetic Persona explanation diagnostics.

It does **not** establish:

- product correctness truth,
- Recommendation rank / Top-K truth,
- real-user preference truth,
- satisfaction or conversion prediction,
- market prevalence,
- organic Production evidence,
- controlled Production evidence,
- release-blocker authority,
- SHADOW or ENFORCE authorization.

`LLM_JUDGE_AUTHORITY = DIAGNOSTIC_ONLY`

`EVIDENCE_CLASS = SYNTHETIC_SIMULATION_EVIDENCE`

---

## 2. Starting Authority

- EVAL-P7 accepted main: `94052be8bef3846f74794477372197b36efe5b58`
- EVAL-P6 accepted main: `ee8f06485a0e7d41396682ac9d44f5b1402abeaa`
- EVAL-P5 accepted main: `269fe701a7f3ee967d12e15c88e9e5767af895f6`
- EVAL-P4 accepted main: `a4772e3cd44d68f67fe4bbf25926ba0942f353b3`
- immutable P3 materialization source: `4265450ddcf40bdb4359a3d5c82d22b00a1024dd`
- frozen Recommendation reference: `783afb91a964f5d762f46846f9ef854902b48e95`

P8 did not reopen P1-P7 semantics.

---

## 3. Judge Contract

Contract:

`fixtures/persona-evaluation/eval-p8-llm-judge-contract-v1.json`

Prompt version:

`eval-p8-llm-judge-prompt-v1.1`

Prompt semantic hash:

`3d8bbe0fa758b3f73ed20bebec1f2d23105bc72a34a321c188fb327ce420054d`

The judge is limited to three non-numeric criteria:

1. `PRIORITY_REFLECTION`
2. `UNCERTAINTY_APPROPRIATENESS`
3. `TRADEOFF_CLARITY`

The contract explicitly forbids:

- numeric quality scores,
- product-quality oracle behavior,
- using Recommendation rank or score as reference truth,
- release decisions,
- ENFORCE decisions,
- satisfaction prediction,
- conversion prediction,
- market-prevalence claims.

Semantic labels and overall judge signals are **not CI blocking**.

Only the deterministic judge contract, prompt lineage, sample identity, response schema, and execution lineage are hard validation concerns in P8.

---

## 4. Bounded Sample

Source:

`eval-p6-locked-regression-cohort-v1`

Source cohort size:

`37 = 29 Coverage + 8 Adversarial`

P8 judge sample:

`16 = 8 Coverage + 8 Adversarial`

Sampling rule:

`FIRST_COVERAGE_MEMBER_PER_PRIMARY_CONCERN_PLUS_ALL_ADVERSARIAL_MEMBERS`

Coverage includes exactly one first LOCKED member for each primary concern:

- oiliness,
- dehydration,
- acne,
- pores,
- redness,
- barrier,
- uneven_tone,
- uv.

All eight P6 Adversarial members are included.

This is deliberately non-representative and adversarially oversampled.

Therefore:

- no population prevalence claim is allowed,
- no market prevalence claim is allowed,
- no cross-cohort raw-rate quality comparison is allowed,
- no percentage in this sample may be promoted to a real-user KPI.

Weighting strategy remains `NONE`.

---

## 5. Input Materialization and Bias Controls

P8 regenerates Recommendation explanations from:

- immutable P3 Persona materialization,
- exact P6 LOCKED membership,
- frozen 164-product Recommendation fixture,
- source-faithful metadata projection,
- current unchanged Recommendation decision engine.

Input materialization runs twice and must be byte-identical.

Final case-set semantic hash:

`e6e7fe7abb868b6335a0640033ccda20138eef8537f05b15d8e90c6275232e78`

The final judge payload excludes:

- product name,
- brand identity,
- comparison text containing product identity,
- numeric Recommendation score,
- rank position,
- score breakdown.

The materializer hard-fails if a frozen product name or qualifying brand identity occurs in the serialized judge case set.

### Pre-observation masking defect

The first debugging artifact exposed product identities inside `topPick.comparison_reason` even though the intended contract declared identity masking.

That artifact was rejected as non-authoritative before final observations were frozen.

Remediation:

- removed `comparison_reason` from the allowed judge input surface,
- removed it from the projected payload,
- advanced the prompt contract to `eval-p8-llm-judge-prompt-v1.1`,
- added direct product-name / brand leakage assertions,
- regenerated a new deterministic case set.

Because the same ChatGPT execution surface had already seen the rejected debugging artifact, P8 does **not** claim a fully blind judge execution.

`BLINDNESS_INTEGRITY = PARTIAL`

`PRE_OBSERVATION_IDENTITY_EXPOSURE = true`

`BRAND_BLINDNESS_CLAIM_ALLOWED = false`

This limitation is explicit provenance, not hidden from the result.

---

## 6. Judge Execution Lineage

Observation fixture:

`fixtures/persona-evaluation/eval-p8-llm-judge-observations-v1.json`

Execution lineage:

- provider: `OpenAI`
- execution surface: `ChatGPT conversation`
- model identifier: `GPT-5.6 Sol`
- temperature: `UNAVAILABLE_PLATFORM_MANAGED`
- seed: `UNAVAILABLE_PLATFORM_MANAGED`
- sampling configuration: `SINGLE_BOUNDED_PASS_16_CASES_PLATFORM_MANAGED`
- execution timestamp: `2026-08-21T16:03:42+09:00`
- response schema: `eval-p8-llm-judge-response-v1`

Observation semantic hash:

`b883051f0f64ddac7753945fe7e5ff5f30803da74fad8a02da708329c31cfda3`

Repeatability authority:

`NOT_ESTABLISHED`

P8 does not claim byte-level LLM output determinism.

---

## 7. Diagnostic Observations

### Priority reflection

- `SUPPORTED = 14`
- `PARTIAL = 2`
- `UNSUPPORTED = 0`

Partial cases:

- `EVAL-P8-P3-C07`
- `EVAL-P8-P3-A02`

These cases show a weaker bridge between the stated Persona priority and the explanation's dominant selected-axis / product-fit narrative.

### Uncertainty appropriateness

- `SUPPORTED = 11`
- `PARTIAL = 1`
- `UNSUPPORTED = 4`

Unsupported cases:

- `EVAL-P8-P3-C02`
- `EVAL-P8-P3-C03`
- `EVAL-P8-P3-C06`
- `EVAL-P8-P3-A05`

Partial case:

- `EVAL-P8-P3-A02`

The primary diagnostic pattern is not Recommendation rank quality. It is explanation evidence alignment.

Observed examples include:

- `postWashFeeling=comfortable` while the explanation states continuing post-cleansing tightness,
- `postWashFeeling=still_oily` while the explanation states post-cleansing tightness,
- `sensitivity=low|medium` while generated survey evidence states that sensitivity is high,
- a high-sensitivity case where current redness is narrated more strongly than the supplied Persona directly establishes.

These are diagnostic explanation-grounding signals only.

P8 does not convert them into Production engine failures or release blockers.

### Trade-off clarity

- `SUPPORTED = 16`
- `PARTIAL = 0`
- `UNSUPPORTED = 0`
- `NOT_APPLICABLE = 0`

All 16 bounded cases provided an understandable constraint / substitution / usage-frequency trade-off without using Recommendation rank as objective truth.

### Overall diagnostic signal

- `CLEAR_ALIGNMENT = 10`
- `MIXED = 2`
- `CONCERN = 4`

Concern cases:

- `EVAL-P8-P3-C02`
- `EVAL-P8-P3-C03`
- `EVAL-P8-P3-C06`
- `EVAL-P8-P3-A05`

Mixed cases:

- `EVAL-P8-P3-C07`
- `EVAL-P8-P3-A02`

Cases containing at least one explicitly recorded unsupported Persona-grounding claim:

`5`

Again, these are raw diagnostic counts over a deliberately non-representative synthetic sample, not quality percentages.

---

## 8. CI Validation

Observed-green pre-closeout head:

`09affd26803461f1b414f414222e2c01ff4b80bf`

PR CI:

- run: `32457236575`
- job: `96696870202`
- result: `SUCCESS`

Artifact:

- ID: `9437687591`
- name: `eval-p8-bounded-llm-judge-09affd26803461f1b414f414222e2c01ff4b80bf`
- ZIP digest: `sha256:168b6fed16b4f655130db48264b0871dc2da1995eca888e8ed3577cfc3703c85`

The run passed:

- exact authority / ancestry,
- bounded additive P8 scope,
- Production / Product Fact / Hosted 0-delta gate,
- required observation presence and JSON parse,
- P4 LOCKED source reconstruction,
- frozen Recommendation reference verification,
- judge input pass A/B deterministic byte equality,
- product / brand identity redaction assertions,
- prompt / case-set semantic-hash verification,
- observation schema / lineage / exact case-ID finalization,
- semantic judge labels remaining non-blocking,
- P6 37-Persona baseline / candidate semantic zero-delta,
- P3 deterministic harness,
- historical 164×12 Recommendation replay,
- Production build.

The final closeout commit must replay the same semantic evidence before merge.

---

## 9. Production Boundary

P8 performs no Production semantic mutation.

- Production Recommendation mutation: `0`
- Product Fact writes: `0`
- Hosted / Supabase writes: `0`
- Production network calls from the bounded materializer: `0`
- organic evidence writes: `0`
- controlled Production probes: `0`
- SHADOW mode changes: `0`
- ENFORCE authorization: `NO`
- ENFORCE activation: `NO`
- Production configuration changes: `0`

The LLM Judge execution is an offline synthetic evaluation action and is not organic Production traffic.

---

## 10. Frozen Interpretation

P8 establishes that a bounded LLM Judge channel can be operated with:

- frozen qualitative rubric,
- prompt/model lineage,
- deterministic case identity,
- identity-masked inputs,
- non-numeric responses,
- explicit diagnostic authority,
- explicit blindness limitation,
- deterministic hard evaluation preceding soft evaluation,
- no Production or ENFORCE authority transfer.

P8 also surfaced explanation-grounding issues that deterministic Recommendation regression did not identify, which is the intended complementary role of the soft evaluator.

It does **not** establish that the LLM Judge is stable enough for release-blocker authority.

Any future promotion beyond `DIAGNOSTIC_ONLY` requires a separate governed Stage with independent judge-contract validation and repeatability / bias evidence.

---

## 11. Final Stage Boundary

Authoritative P8 outcome:

`BOUNDED_LLM_JUDGE_DIAGNOSTIC_CHANNEL_ESTABLISHED_WITH_PARTIAL_BLINDNESS_AND_RELEASE_BLOCKER_AUTHORITY_NOT_GRANTED`

P8 may close successfully if final-head and merged-main exact-SHA CI reproduce the frozen prompt hash, case-set hash, observation hash, regression invariance, and Production boundary.

P9 aggregate calibration is not part of P8 and is not authorized by this document.
