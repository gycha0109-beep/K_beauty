# FACE LAB EVALUATION STRATEGY

> Status: current evaluation-method authority for Face Lab
> Scope: synthetic evaluation, human annotation, consensus, calibration, promotion, holdout, and evidence interpretation
> Product architecture is owned by `FACE_LAB_MASTER_SPEC.md`.
> Current implementation status is owned by `FACE_LAB_CURRENT_STATE.md`.

## 1. Core principle

Face Lab must separate generation, observation, judgment, calibration, and promotion.

```text
Generation intent
≠ observed visual fact
≠ archetype decision
≠ human consensus
≠ dataset promotion
≠ production activation
```

The most important invariant is:

> An image is not ground truth merely because a prompt asked a model to generate a target feature or archetype.

## 2. Evaluation layers

Face Lab evaluation uses different evidence classes for different questions.

### 2.1 Technical fixture evidence

Purpose:

- parser and schema behavior,
- image validation,
- eligibility,
- failure states,
- storage/reentry,
- deterministic replay,
- privacy boundaries,
- version drift.

Synthetic or hand-built fixtures are appropriate here.

### 2.2 Controlled synthetic evidence

Purpose:

- controlled visual cue tests,
- coverage/stress testing,
- observation failure discovery,
- ambiguity and hold behavior,
- rubric contradiction discovery,
- generation/provider comparison,
- exploratory archetype indicator testing.

Synthetic evidence may become purpose-scoped synthetic Gold under the synthetic promotion contract, but this does not make generation intent an observed truth and does not replace real-world calibration.

### 2.3 Human-annotated real evidence

Purpose:

- real-world archetype calibration,
- ambiguity distribution,
- ranking/hold evaluation,
- style-language validity,
- production threshold validation,
- subgroup/coverage analysis,
- locked real holdout evaluation.

For production archetype claims, this is the higher-value authority.

## 3. Synthetic campaign flow

The synthetic evaluation workflow is:

```text
Campaign Specification
→ GenerationSpec
→ Prompt Compiler
→ Generated Candidate
→ technical / eligibility gate
→ blind observation
→ blind human or independent judge review where required
→ sealed judgment / consensus
→ intent reveal
→ target alignment
→ purpose-specific promotion
→ report / dataset placement / holdout
```

Generation and evaluation must remain independently auditable.

## 4. Generation contract

Generation is responsible for:

1. structured target conditions,
2. provider-specific prompt compilation,
3. generation provenance,
4. immutable candidate identity and file integrity.

Generation is not responsible for assigning actual visual labels.

A `GenerationSpec` may contain intended targets such as:

- subject/capture variation,
- archetype target or intended mixture,
- skin cue targets,
- exclusions,
- provider profile.

These are intent metadata only.

## 5. Blind observation

Observation must not receive the generation target before the observation is sealed.

The observation layer should see the image and the observation contract, not the prompt target.

This prevents confirmation bias such as:

```text
prompt says cat
→ observer searches for cat features
```

Observation must stay field-level and evidence-backed.

## 6. Human judgment and consensus

Human review is not a decoration on top of an AI decision. It is an independent evidence source.

### 6.1 Archetype annotation

A production-calibration annotation format should preserve more than one forced top-1 label. At minimum it should be able to represent:

- first-choice archetype,
- second/third candidate where meaningful,
- confidence,
- visible evidence tags,
- `uncertain` / `not assessable`,
- ambiguity between nearby archetypes.

The exact annotation schema may evolve, but ambiguity must never be collapsed merely to simplify scoring.

### 6.2 Reviewer count

Not every exploratory image requires the same number of reviewers.

Recommended policy:

- high-agreement exploratory samples may use lighter review,
- conflicts and boundary cases require human escalation,
- benchmark and locked holdout samples require multiple independent human judgments,
- production calibration must not rely on a single reviewer's opinion as objective truth.

### 6.3 Consensus

Archetype is not treated as a single natural-science label with guaranteed universal agreement.

Consensus should preserve:

- top-k agreement,
- ranking agreement,
- confidence distribution,
- disagreement/ambiguity,
- evidence-tag agreement.

A consensus distribution can be valid evidence even when no forced top-1 label is appropriate.

## 7. Archetype scoring evaluation

The Bejewely archetype engine must be evaluated from observations, not from prompt language.

```text
FaceLabObservationAnalysis
→ deterministic rubric scorer
→ ranking / contribution ledger
→ hold checks
```

Evaluation questions include:

- does the human consensus top-k overlap with engine top-k,
- does the intended archetype land in a plausible observed rank on controlled synthetic tests,
- are nearby archetypes separated by the correct evidence axes,
- do missing required axes lead to hold rather than arbitrary classification,
- do low margin and contradiction cases hold,
- are weights stable across relevant appearance variation,
- are decisions stable under benign capture variation.

## 8. Intent alignment

Intent alignment is performed only after blind observation/judgment is sealed.

For each evaluation purpose, compare intended and observed values independently.

Examples:

```text
capture control      → pass
archetype stress     → pass
redness cue          → pass
blemish cue          → fail
```

A single aggregate “good image / bad image” score is discouraged because one candidate may be valid for one purpose and invalid for another.

## 9. Purpose-specific promotion

Dataset eligibility is purpose-scoped.

A candidate may be retained for:

- technical fixture,
- observation evaluation,
- archetype evaluation,
- skin-cue evaluation,
- styling evaluation,
- holdout.

Promotion must be based on the evidence required for that purpose, not merely on successful generation or one alignment flag.

Synthetic Gold and real Gold remain separate concepts.

## 10. Synthetic vs real authority

### 10.1 Synthetic data is appropriate for

- controlled perturbation,
- rare boundary construction,
- negative controls,
- observation stress tests,
- deterministic regression,
- pipeline rehearsal,
- exploratory rubric analysis,
- identifying likely generation-side or observation-side failure modes.

### 10.2 Synthetic data is not sufficient by itself for

- final real-world archetype truth,
- production threshold activation,
- population-level performance claims,
- demographic fairness claims,
- proving styling usefulness to real users.

A synthetic model target can influence what is generated; therefore it cannot be treated as independent truth about the generated result.

### 10.3 Real-data calibration

Production calibration should use consented real-person evaluation data with:

- explicit evaluation consent,
- independent annotation,
- multiple reviewers for benchmark/holdout,
- subject-level split controls,
- versioned taxonomy and rubric,
- ambiguity preservation,
- deletion/withdrawal governance where applicable.

## 11. Avoiding circular AI evaluation

The following pattern is prohibited as sole validation:

```text
AI generates “cat”
→ AI judges “cat”
→ system declares cat ground truth
```

Independent model judgments can be useful diagnostic evidence, but final production calibration cannot be based solely on an AI judging another AI-generated target.

## 12. Leakage and dataset splits

Evaluation data must be protected against leakage across development and holdout.

At minimum:

- exact and near-duplicate families must not cross protected splits,
- same-subject real images must remain grouped,
- generated variants derived from a common source/seed/reference relationship must be considered coupled,
- taxonomy/rubric versions used during development must be recorded,
- locked holdout must not be repeatedly inspected to tune weights.

## 13. Version and provenance requirements

Every meaningful evaluation artifact should be traceable to the relevant versions of:

- observation contract,
- taxonomy/registry,
- scoring engine,
- generation spec/compiler/provider profile where synthetic,
- reviewer/consensus contract,
- promotion policy,
- dataset split/version,
- report/calibration run.

Historical results must remain interpretable after later code changes.

## 14. Privacy and rights

Synthetic and real data have different governance concerns.

### Synthetic

- generation/provider usage rights must be reviewed for the intended internal evaluation use,
- real-person reference-image use must not be silently introduced,
- candidate provenance must remain auditable.

### Real

- evaluation use requires separate, informed consent,
- source images and identifiers require a dedicated protected storage/governance path,
- service-use consent is not evaluation consent,
- withdrawal/deletion requirements must be defined before operational collection,
- raw images must not leak into normal production report storage.

## 15. Diagnostic interpretation

Evaluation should distinguish failure classes instead of jumping directly to causality.

Useful diagnostic concepts include:

- **generation-side signal weak possible**: the target cue may not have been rendered strongly enough,
- **observation-side miss possible**: an independently reviewable cue is visible but the observation layer misses it,
- **ambiguous visual cue**: the evidence cannot distinguish weak generation from observer miss,
- **contract limitation**: the schema cannot represent the needed distinction,
- **reviewer limitation**: the reviewer cannot reliably evaluate that axis.

These are diagnostic labels, not causal proof.

## 16. Lessons from the first controlled skin-cue pilot

The first diversified skin-cue pilot established several process rules:

1. Human uncertainty must remain uncertainty; it must not be imputed into success/failure.
2. Cue-specific denominators are required.
3. Human↔target, T4↔target, and Human↔T4 are different relations and must not be collapsed.
4. Unsupported observation dimensions, such as an unavailable count contract, must remain not available/not comparable.
5. A clear human-positive/T4-negative example can be flagged as an observation-side miss candidate without claiming the full cause.
6. A technically successful pipeline run does not automatically justify production calibration.

## 17. Archetype calibration program

The next archetype evaluation program should proceed in this order:

```text
A. Calibration protocol
   define questions, axes, metrics, hold criteria, reviewer contract

B. Human annotation / consensus contract
   define labels, ranking, evidence tags, uncertainty, reviewer independence

C. Synthetic archetype stress set
   exercise rubric boundaries and observation failures

D. Real calibration set
   consented, independently annotated, subject-grouped

E. Weight / threshold calibration
   tune rubric and hold policy using development data

F. Locked validation / holdout
   evaluate without further tuning

G. Production activation review
   decide whether taxonomy and thresholds are ready
```

Synthetic stress work and real-data preparation may run in parallel, but synthetic results alone must not activate production archetype decisions.

## 18. Historical source consolidation

This strategy consolidates the still-valid evaluation principles from:

- `Face_Lab_구현_명세_0716_수정본.md`
- `face_lab_진행상황_0727.txt`
- `bejewely-face-analyze-pipeline-07-30.txt`

The July 30 generation/judgment/promotion architecture remains foundational, while current repository contracts provide the exact executable semantics.
