# Analyze No-write Capture Boundary

This document defines the write boundary for future analyze capture work. It is not runtime policy approval.

## Phase 20 Skip Reason

Phase 20 stopped with `capture_run_not_executed_db_mutating_guard_path`.

The reason is structural: the current `/api/analyze` success path performs analysis guard RPC mutations before recommendation generation and premium report store mutations before the shadow capture call. Running the route unchanged would not satisfy a no-write capture requirement.

## Phase 21 Purpose

Phase 21 is a static boundary investigation only.

It does not:

- send an actual `/api/analyze` request
- add a no-write flag
- modify route behavior
- change evaluator hard filters, scores, or weights
- connect CandidatePolicy
- change UI or API response fields
- change DB/Supabase schema or product data
- edit capture fixture originals

## Pure Analysis / Recommendation Boundary

The route has a usable pure or read-only analysis shape, but it is currently interleaved with mutation guards.

The pure/read-oriented stages are:

1. Request parse and validation
   - parse multipart form data
   - validate required survey fields
   - validate upload type and size
   - normalize `formInput`

2. Survey contract normalization
   - build `SurveyInputContract` for parallel dev audit and future shadow capture
   - note: the current dev audit helper also appends a local audit file, so a strict no-write route would need to skip or isolate that side effect

3. Photo analysis boundary
   - deterministic fallback if no model key is available
   - optional remote model call if configured
   - this is not a DB write, but it is still an external side effect policy concern

4. Product read boundary
   - current product snapshots are read from `product-source`
   - recommendation product pool is read by the decision engine through product-source
   - this is a read boundary, not a write boundary

5. Recommendation generation
   - `buildSkinMatchDecisionBundle(formInput, ...)`
   - when diagnostics are enabled, the existing candidate source is available through `decision.diagnostics.candidateSource`

6. Public result payload
   - optional explanation text may be generated
   - `buildFreeDecisionPayload(decision)` creates the current free result payload

## DB Write / Mutation Boundary

The mutation boundary currently includes:

- `guardAnalysisRequest(...)` in `/api/analyze`
- `claim_analysis_idempotency` RPC
- `consume_analysis_rate_limits` RPC
- `complete_analysis_idempotency` RPC
- `fail_analysis_idempotency` RPC
- `createPremiumReportSession(...)`
- premium report store insert
- premium report store prune delete
- local dev survey contract audit append
- local functional shadow fixture write

The first DB mutation risk appears before recommendation generation, because `guardAnalysisRequest(...)` runs before `buildSkinMatchDecisionBundle(...)`.

The current functional shadow capture call runs after:

1. premium report store work
2. response object construction
3. analysis guard completion

That ordering is why Phase 20 could not safely execute target scenarios under a no-DB-write constraint.

## Why Current Target Capture Cannot Run Unchanged

Running the current route unchanged would potentially mutate:

- idempotency state
- rate limit counters
- premium report session rows
- expired premium session rows
- local development audit/capture files

Only the local functional shadow capture file is intended for this work. The other mutations are unrelated to coverage collection and are not allowed under the Phase 20/21 constraints.

## Capture Insertion Point Candidates

### Candidate A: After Public Decision, Before Premium Store

Point: immediately after `buildFreeDecisionPayload(decision)`.

Advantages:

- has `formInput`
- has full `decision`
- has `publicDecision`
- has candidate source diagnostics when enabled

Risks:

- analysis guard mutations already happened earlier
- optional remote model calls may already have happened
- route behavior would need a dev-only no-write branch

Recommendation: viable only in a separately approved route-boundary task.

### Candidate B: Candidate Source Boundary Inside Decision Engine

Point: where the decision engine builds or returns candidate source diagnostics.

Advantages:

- closest to the actual product pool used by existing ranking
- can preserve complete/product_row evidence
- avoids response and premium store work

Risks:

- may require pure helper extraction
- may not include exact public payload without extra pure construction

Recommendation: preferred boundary for a script-only replay runner.

### Candidate C: Route-external Pure Engine Replay

Point: a local script builds the survey input, calls the existing decision engine with diagnostics, then writes sanitized shadow artifacts.

Advantages:

- no API response changes
- no route guard/session writes
- no route runtime changes
- suitable for target scenario coverage expansion

Risks:

- not exact `/api/analyze` execution
- must document route parity gaps
- must not fabricate product rows

Recommendation: best next implementation step.

### Candidate D: Isolated Dev DB Route Execution

Point: run current `/api/analyze` unchanged against an isolated dev database.

Advantages:

- highest route parity
- no code changes

Risks:

- still writes by design
- requires strict environment isolation
- not allowed when the task forbids DB/Supabase mutation

Recommendation: acceptable only with explicit isolated DB approval.

## Option Comparison

### Option 1: Dev-only No-write Analyze Capture Mode

Add a development-only no-write flag in `/api/analyze` that skips guard/session mutation blocks and writes only sanitized capture artifacts.

Advantages:

- preserves the `/api/analyze` request contract
- can produce target captures without DB writes

Risks:

- touches protected route behavior
- must not affect production
- must not alter response shape
- must define behavior for guard state, write token, premium report state, and optional remote model calls

Required guardrails:

- `NODE_ENV === "development"`
- explicit no-write capture env flag
- no API response field additions
- capture failures swallowed
- no production import or execution side effects

Recommendation: not first. Implement only as a separately approved route-boundary task.

### Option 2: Pure Engine Replay Runner

Create a script-only runner that constructs target scenario `formInput`, calls `buildSkinMatchDecisionBundle` with candidate diagnostics, and writes sanitized shadow artifacts.

Advantages:

- avoids DB mutation
- avoids API response changes
- keeps runtime code untouched
- can expand target scenario evidence quickly

Risks:

- not exact route execution
- must document differences from route guard, premium storage, and optional explanation generation
- must use existing product source only and never synthetic product rows

Recommendation: recommended next step.

### Option 3: Isolated Dev DB Write-allowed Capture

Run the existing route unchanged in an isolated dev database where guard/session writes are allowed.

Advantages:

- highest fidelity to the real route
- no route code changes

Risks:

- still performs writes
- requires environment isolation and cleanup expectations
- cannot be used when the task requires no DB/Supabase mutation

Recommendation: valid operational path only after explicit isolated DB approval.

## Recommended Next Work

Recommended Phase 22 direction:

Implement a script-only pure engine replay runner for the four target scenarios. The runner should:

- use SurveyInputContract-compatible inputs
- use existing product source reads only
- enable candidate source diagnostics
- write sanitized capture-like artifacts marked as replay-generated
- re-run actual coverage collectors separately, without treating replay output as actual `/api/analyze` capture unless explicitly labeled

If exact route parity is required, open a separate route-boundary task for Option 1 or approve an isolated dev DB run for Option 3.

## Runtime Non-application

This boundary design does not change runtime behavior. It does not approve evaluator changes, hard filter changes, CandidatePolicy integration, UI/API response changes, DB/Supabase changes, or product data changes.

## Phase 22 Resume Point

Resume with:

`Phase 22: Pure Engine Target Scenario Replay Runner`

Goal:

Use a script-only no-write path to replay the four Phase 19 scenarios through the shared decision engine and produce sanitized candidate source artifacts, while clearly separating replay evidence from actual `/api/analyze` capture evidence.
