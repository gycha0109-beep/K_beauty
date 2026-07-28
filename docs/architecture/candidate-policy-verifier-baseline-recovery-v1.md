# CandidatePolicy verifier baseline recovery v1

## Scope

This recovery makes the evaluator-boundary shadow integration and CandidatePolicy
hint-receiver verifiers reproducible from a fresh checkout. It changes verifier
inputs, artifact orchestration, and validation only. It does not connect or alter
CandidatePolicy runtime behavior, FunctionalPolicy, GoalPolicy, stabilization
guards, current-product transport, sunscreen protection rules, or production
data.

## Reproduced failure and hidden prerequisite

At baseline `b17d322cf0b04311407be75fdcda88b1a973800a`, each verifier failed when
run independently without ignored files:

- `verify-evaluator-boundary-integration-design.mjs` required
  `tmp/functional-shadow-captures/candidate-exposure-audit.json`.
- `verify-candidate-policy-hint-receiver-design.mjs` required
  `tmp/evaluator-boundary-integration-whatif.json`.

The files were outputs of earlier producer commands rather than tracked input
fixtures. The former suite depended on a historical local execution order and
repository `tmp` state. A fresh worktree did not have that state.

## Recovery contract

`scripts/lib/candidate-policy-verifier-baseline.mjs` is the shared deterministic
orchestrator. It writes four anonymous contract captures, then runs the existing
producer chain:

1. `run-functional-candidate-exposure-audit.mjs`
2. `collect-evaluator-boundary-actual-coverage.mjs`
3. `plan-evaluator-boundary-target-captures.mjs`
4. `run-pure-engine-target-scenario-replay.mjs`
5. `review-evaluator-boundary-readiness.mjs`
6. `run-evaluator-boundary-integration-whatif.mjs`
7. `run-candidate-policy-hint-receiver-whatif.mjs`, when requested

The candidate exposure producer continues to call
`lib/functional-candidate-exposure-audit.js`. The fixture is labeled
`deterministic_contract_fixture`; it is never labeled actual or production
evidence. The pure replay producer remains fail-closed and records the expected
offline `read_only_product_source_missing_config` state instead of opening a DB
or network connection.

The baseline contract uses:

- schema version `candidate-policy-verifier-baseline-v1`;
- fixed clock `2026-07-28T00:00:00.000Z`;
- stable fixture IDs and no random identifiers;
- repository-relative CLI paths;
- exact generated-file sets;
- semantic SHA-256 hashes excluding only `generatedAt` and `durationMs`;
- schema, provenance, aggregate, non-empty, and forbidden-field validation.

The fixture has no product names, brands, URLs, customer data, credentials, or
production rows. It exists only to exercise production verifier modules.

## Standalone and suite behavior

Each recovered verifier creates two independent directories with `mkdtemp()` in
the operating-system temp root. It generates every prerequisite itself, compares
the exact file sets and semantic hashes, validates the existing assertions, and
removes both directories in `finally`. Missing prerequisites, producer failures,
schema mismatches, and semantic tampering remain non-zero failures.

The first run pre-populates invalid files under the same artifact names. The
orchestrator removes the isolated output directories before generation, proving
that stale artifacts cannot be reused. Each verifier also mutates a key decision
in a generated artifact and proves that schema/contract validation rejects it.

The security closeout suite uses
`materialize-candidate-policy-verifier-baseline.mjs` as an explicit preparation
step. It generates the same deterministic dependency graph in the suite's
ignored `tmp` layout before downstream producers and verifiers run. The shadow
integration verifier is also named explicitly in the suite discovery contract
because its filename does not match the legacy keyword filter. The frozen exact
manifest therefore grows from 51 to 52 and contains both recovered verifiers;
all other entries remain unchanged.

Standalone commands:

```text
npm run verify:candidate-shadow-integration
npm run verify:candidate-hint-receiver
npm run verify:candidate-policy-baseline
```

No command requires a manually copied artifact, `_local_data`, a database,
Supabase, network access, or CandidatePolicy runtime environment variables.

## Remaining safety findings

This recovery does not normalize existing unsafe findings into expected success.
UVA missing-label fail-open behavior, stabilization active expansion,
FunctionalPolicy/GoalPolicy divergence, missing `currentProductFindings`
transport, and current-product snapshot field loss remain unresolved. They are
inputs to the separate CandidatePolicy Runtime Safety Hardening stage.

The known SEC-06 source-string negative-control failure is unrelated and already
reproduces on baseline `origin/main`; this recovery does not remove or weaken
that verifier.

## Entry gate for the next stage

CandidatePolicy Runtime Safety Hardening may start only after both standalone
verifiers, the focused CandidatePolicy bundle, deterministic/negative controls,
the security closeout target entries, production build, and a fresh clean-room
run pass at the exact recovery commit. Runtime flags and production canaries
remain disabled throughout this recovery.
