# AI Context Architecture and Document Hierarchy Plan

## 1. Status and scope

- Status: implementation-ready diagnosis; no `.codex/` restructure implementation in this phase.
- Final state: `ready_for_agent_context_restructure`.
- Branch inspected: `codex/survey-input-contract-refactor`.
- Execution profile: the requested Terra Max operating path; Sol escalation was evaluated and is not required.
- Task classification: diagnosis plus limited documentation execution.
- Security delta: N. This task only inventories and classifies repository documents.
- Security delta rationale: no DB, Auth, RLS, Storage, Provider, Payment, Secret, Production, route, or hosted operation was changed or executed.
- Protected-area code was not opened for modification and no runtime claim was newly verified.
- This plan applies the decisions supplied in the task; it does not replace them with a new AI operating philosophy.

## 2. Investigation boundary and method

The investigation started at depth 1-2 and expanded only inside root `AGENTS.md`, existing `.codex/`, the named `docs/` groups, `scripts/README.md`, package script names, and verifier/review/run inventories.
Evidence anchors: [AGENTS.md](../../AGENTS.md), [AI_ROUTER.md](../../.codex/AI_ROUTER.md), [AI_REVIEW_CHECKLIST.md](../../.codex/AI_REVIEW_CHECKLIST.md), and [architecture README](README.md).
It used headings, filenames, limited sections, file counts, and physical line counts.
It did not access production, Supabase, Docker, providers, routes, secrets, runtime behavior, or broad repository content.
Two preliminary PowerShell summary expressions produced bounded errors; corrected commands returned count-only results without expanding scope or changing files.

## 3. Current baseline

Physical line counts were measured without token estimation.

| Group | Files | Lines | Current dominant role |
| --- | ---: | ---: | --- |
| `docs/` root | 12 | 6,163 | mixed contract, setup, checklist, debug, policy |
| `docs/architecture/` | 40 | 7,454 | mixed map, contract, design, Phase plan, audit |
| `docs/reviews/` | 31 | 3,714 | dated verification and Phase evidence |
| `docs/runbooks/` | 2 | 127 | isolated shadow execution procedures |
| `docs/security/` | 5 | 917 | audit, backlog, implementation record, SQL verifier |
| All `docs/` | 90 | 18,375 | L3-L5 roles mixed by location |
| Core `.codex` Markdown set | 6 | 2,660 | routing, context, validation, sync, audit log |
| Root `AGENTS.md` | 1 | 153 | repository-wide agent enforcement |
| `scripts/verify-*.mjs` | 63 | 12,147 | executable/static verifier implementations |
| `scripts/review-*` and `scripts/run-*` | 26 | 9,014 | evidence generation and controlled runners |

Additional signals:

- `AI_WORK_LOG.md` has 157 entries; 43 headings include `Phase`.
- 26 architecture files and 28 review files contain Phase-number language.
- Seven architecture/review filename families overlap directly.
- `package.json` exposes ten script names, but most of the 63 verifier files are invoked directly with `node`.
- `scripts/README.md` documents data/import workflows but does not index the large verifier estate.
- `docs/archive/`, `docs/legacy/`, and `docs/contracts/` do not currently exist.
- The preliminary repository Markdown-link scan found almost no real relative Markdown links; references are mostly prose or backticked paths.

Baseline meaning:

- document volume alone is not the primary defect;
- the primary defect is role and freshness ambiguity across high-volume groups;
- future comparison should measure fewer default reads and shorter handoffs, not merely fewer files.

## 4. Existing AI entry-point diagnosis

### 4.1 Is `.codex/` already the AI entry point?

Partly. Root `AGENTS.md` already routes agents into `.codex` documents, so `.codex/` is the practical operating-document home.
It is not yet a clean entry layer because operating rules, current-context claims, audit logs, tool configuration, images, and local logs share the same directory without a short README/router boundary.

`AGENTS.md` currently enforces task classification, protected areas, risk, validation, work-log updates, and stop conditions.
`.codex/AI_ROUTER.md` repeats task-type routing.
`.codex/AI_REVIEW_CHECKLIST.md` supplies validation categories.
`.codex/PROJECT_SYNC_RULES.md` supplies Git and workstation operating rules.
`.codex/AI_CONTEXT.md` declares a current-context taxonomy but currently contains no Active, Bridge, Candidate, or Deactivated items.
`.codex/AI_REVISIT.md` carries product, Auth, DB, UX, and flow assertions without `last_verified` evidence.

### 4.2 Keep, integrate, update, or retire

| Existing item | Proposed treatment | Reason |
| --- | --- | --- |
| `AGENTS.md` | keep, then shorten only after parity verification | it is the repository-recognized enforcement surface |
| `.codex/AI_ROUTER.md` | preserve its routing logic, then integrate into `CONTEXT_ROUTER` and execution rules | task classification is useful but too narrow for delta-based context routing |
| `.codex/AI_REVIEW_CHECKLIST.md` | integrate into `VERIFY_RULES` | useful categories; currently not routed by delta |
| `.codex/PROJECT_SYNC_RULES.md` | keep as detailed reference; copy only minimum Git rules into L1 | workstation detail is too long for every task |
| `.codex/AI_WORK_LOG.md` | keep as L4 audit only | large chronological record, not current context |
| `.codex/AI_CONTEXT.md` | retire or archive after L0/L2 parity exists | empty state buckets add an ambiguous context source |
| `.codex/AI_REVISIT.md` | revalidate, then split references or archive | mixes current claims across several domains without freshness evidence |
| `.codex/hooks.json` and hook code | keep as executable configuration | configuration is not an AI context document |
| `.codex` images and local logs | keep outside routing; follow existing Git hygiene | artifacts must never become default reads |
The preservation obligation applies to the roles already implemented by `AGENTS.md` and these `.codex` rules.

### 4.3 Source-of-truth misuse risks

- `docs/architecture/README.md` calls maps canonical while the directory also contains many Phase plans and audits.
- `domain-map.md`, `contracts.md`, and `decisions.md` can be useful L3 references, but code/schema/config still outrank them.
- `AI_REVISIT.md` uses imperative current-state language without a freshness marker.
- dated security findings may be mistaken for current production state.
- a Phase status such as `ready_for_*` can be mistaken for present runtime approval.
- verifier documentation can drift from the actual script that currently enforces a check.

Rule: `.codex` operating context may summarize and route, but it must never supersede code, schema, config, or verifier output.
When those sources disagree, report the mismatch and treat the executable/current source as authoritative.

## 5. Current document-role conflicts

| Conflict | Evidence | Consequence |
| --- | --- | --- |
| architecture vs history | 40 architecture files; 26 contain Phase language | location implies current design even when content is a step artifact |
| architecture vs review | seven directly overlapping filename families | agents may read both as independent requirements |
| review vs runbook | isolated-shadow readiness, runbook, execution runbook, and controlled-run review coexist | current gate is not discoverable from location alone |
| contract vs draft | files such as `survey-input-contract.md` and `premium-functional-plan-db.md` say Draft | draft language can be mistaken for accepted contract |
| security boundary vs security audit | `docs/security/` mixes audits, remediation, implementation notes, and SQL | historical findings may be confused with global operating safety rules |
| verifier meaning vs command | 63 verifier files but only ten package scripts | prose command lists can silently become stale |
| `.codex` context vs audit | router/context/revisit rules sit beside a 2,063-line work log | agents may read audit history as operating context |
| root docs role mixing | setup, QA, deploy, storage policy, tagging rules, auth debug log | default-read status is unclear |

Highest-risk default references are Phase-numbered architecture plans/checklists, dated security reports, the auth debug log, `AI_WORK_LOG`, `AI_REVISIT`, and either isolated-shadow runbook when detached from the later controlled-run result.

## 6. L0-L5 application plan

| Layer | Repository application | Default read? |
| --- | --- | --- |
| L0 Entry | `.codex/README.md`, `.codex/CONTEXT_ROUTER.md` | yes, minimal |
| L1 Operating | execution, verification, security, and resource logging rules | conditional by router |
| L2 Domain State | approved, lazily created current-state summaries | only when relevant and present |
| L3 Source of Truth | current architecture, contracts, policy, runbooks, scripts/config | only through relevant reference |
| L4 Audit/History | reviews, security audits, work/resource logs, Phase evidence | evidence lookup only |
| L5 Archive | confirmed superseded or unsafe-default-reference documents | no |

L0 README states purpose and precedence; the router selects reads but stores no branch purpose, Phase history, or fixed domain enum.
L1 execution rules absorb classification, scope, Git, stop, handoff, reporting, and resource triggers; verification and security rules stay section-routable.
Keep resource rules inside execution rules initially to avoid another file.
L2 initially contains only domain governance and template files; individual domains require the gate and approval.
L3 retains validated maps, contracts, decisions, policies, runbooks, scripts, package commands, code, schema, and config, with executable sources taking precedence.
L4 contains dated reviews, security audits, remediation evidence, Phase results, and work/resource logs; Phase-shaped architecture files move logically here before any physical move.
L5 requires replacement and supersession proof; candidates are obsolete Phase plans, superseded runbooks, debug history, empty context taxonomy, and stale plans.
Suggested archive marker: `Status: archived`, `Default reference: no`, `Use only for historical audit`.

## 7. Minimal target `.codex/` structure

```text
.codex/
  README.md
  CONTEXT_ROUTER.md
  AI_EXECUTION_RULES.md
  VERIFY_RULES.md
  SECURITY_BOUNDARIES.md
  domains/
    README.md
    _TEMPLATE.md
  AI_WORK_LOG.md
  AI_RESOURCE_USAGE_LOG.md  # only if/when observations exist
  hooks.json                # existing tool configuration, not context
```

This is seven documents and no individual domain file.
It is smaller than the example because resource usage rules fit in execution rules.
If later rules become independently complex, separation requires a measured need and user approval.

Always-read minimum:

1. root `AGENTS.md` as the repository enforcement surface;
2. `.codex/README.md` as the entry and precedence statement;
3. `.codex/CONTEXT_ROUTER.md` as the delta router.

All L1 sections, L2 documents, L3 sources, and L4 evidence are conditional reads.

## 8. Context routing contract

The router should perform this sequence:

1. classify execution, diagnosis, design, review, or recovery;
2. state the requested delta and explicit non-targets;
3. answer Y/N for DB, Auth, RLS, Storage, Provider, Payment, Secret, and Production change/execution;
4. treat indirect impact or uncertainty as Y;
5. select only the relevant operating-rule sections;
6. look for a relevant approved domain file without assuming it exists;
7. follow only necessary L3 references;
8. consult L4 only for continuity, evidence, or prior failure;
9. record why security sections, verification sections, and `.codex` logs were or were not read.

| Task type | Required operating scope | Typical conditional sources |
| --- | --- | --- |
| documentation/rules | execution docs section; document verification section | affected rules and link targets |
| low-risk implementation | execution scope/Git; relevant static/build verification | code owner docs, package scripts |
| diagnosis | diagnosis/stop rules; evidence-appropriate verification | code/config/log slice, recent related audit |
| review | review rules; requested check sections | diff, verifier output, relevant contract |
| recovery | recovery/stop rules; narrow verification | failure logs and last known-good contract |
| protected-surface work | relevant security sections plus high-risk execution rules | current code/schema/config and approved runbook |

### Security loading

Global safety principles always apply even when the document body is not loaded.

- Load only the DB/RLS/Storage section for a bounded data-policy delta.
- Load only Auth/Secret sections for an authentication or credential-handling delta.
- Load only Provider/Payment/Production sections for those operations.
- Load the full document only when several protected surfaces interact, the impact is ambiguous, or the operation has high failure cost.
- A docs-only inventory that neither changes nor authorizes a protected operation is N; completion must state why.
- A document change that could authorize, weaken, or misstate a protected operation is Y even without runtime execution.

### Verification loading

- Documentation work: headings, duplication, paths/references, status markers, `git diff --check`.
- Logic work: relevant static verifier, focused tests, then build only when proportionate.
- API/DB/Auth work: relevant contract and safety verifiers; runtime checks only with explicit safe authority.
- Read the full verification document only for cross-cutting or release-level work.
- Commands in prose are explanatory; resolve the current command from `package.json` or `scripts/` before execution.
- A verifier name, input contract, or output status change must update the relevant verification meaning in the same task.

## 9. Domain lazy creation and approval

### Creation gate

A domain is eligible only when evidence shows all of the following:

- the same context has been injected at least twice;
- a current contract, blocker, prohibition, or verifier exists;
- follow-on work is likely;
- existing L3/L4 material does not expose current state efficiently;
- a summary would materially shorten future prompts.

Eligibility permits a proposal, not creation.
The agent must name the evidence, proposed filename, scope, and sources, then obtain explicit user approval.
Absence of a domain file never blocks ordinary work.

Strong current candidates, not approved creations:

| Candidate | Evidence | Caution |
| --- | --- | --- |
| shadow/evaluator runtime boundary | 48 matching docs and 72 matching scripts | must collapse Phase history into present gate only |
| survey input contract | three docs, three scripts, active branch context | draft vs implemented contract must be verified |
| product taxonomy/ranking/review pipeline | six docs and 23 scripts | DB, import, and display terminology must remain distinct |
| premium/result persistence | multiple contracts plus storage/revisit records | Auth/payment/security boundaries require section routing |

Security itself is not a domain-state substitute for `SECURITY_BOUNDARIES`.
An Auth or payment domain may be proposed later only for verified current contracts, never to weaken global boundaries.

### `domains/README.md` design

It should contain purpose, non-source-of-truth warning, discovery rules, lazy-creation gate, approval requirement, naming guidance, update-in-place rule, and deletion/archive review rule.
It must not enumerate required domain filenames.

### `_TEMPLATE.md` design

```markdown
# <Domain name>

Status: current summary, not source of truth

## Current purpose
## Current structure
## Current contract
## Current prohibitions
## Current blockers
## Current verifiers
## Last verified
- files:
- checks:
- status: docs_only_not_runtime_verified | static_verified | runtime_verified
## Source references
## Next entry conditions
```

Template rules:

- replace current sections instead of appending Phase history;
- summarize enough to remain independently readable;
- reference, do not copy, source documents;
- identify unknown or stale claims explicitly;
- use the most conservative verified status;
- require user approval before first creation.

## 10. Loose coupling and broken-reference fallback

- L0/L1 must never hard-code a complete domain filename enum.
- Domain existence is optional and discovered at task time.
- Links are references, not prerequisites.
- A moved source does not invalidate an independently readable current-state summary.
- A broken link is a `Reference Maintenance Issue`, not automatic task failure.
- Check the referenced path, then one named parent/sibling scope only.
- If unresolved, prefer actual code/schema/config/verifier evidence.
- Do not refresh or repair the document during a structure-diagnosis task.
- Do not launch repository-wide search because one reference is broken.
- Propose reference repair as a separate bounded task.

## 11. Operating context and audit roles inside `.codex`

- `.codex` is the operating-context home as well as the location of scoped audit and tool artifacts.
- `.codex/README.md`, router, operating rules, and approved domains are L0-L2.
- `.codex/AI_WORK_LOG.md` and a future `AI_RESOURCE_USAGE_LOG.md` are L4 audit logs inside the same directory.
- Existing hooks/environments remain tool configuration, not context sources.
- The router must not read full logs by default.
- For continuity, read only the latest relevant entry or a named Phase/task slice.
- Resource observations record only values exposed by the environment; never estimate tokens, credits, or balances.

## 12. Model handoff template

Sol, Terra, and Luna handoffs should contain only:

```text
Entry: <L0 files>
Task and model role: <name and why this model>
Delta: <requested change or diagnosis>
Confirmed decisions: <short list>
Allowed scope: <paths/actions>
Forbidden scope: <paths/actions>
Security routing: <Y/N plus sections>
Verification set: <current commands/checks>
Open uncertainty: <only unresolved facts>
Completion report: <required fields>
```

Do not attach full chat history, complete reviews, all architecture documents, or all Phase logs.
Terra includes mechanical verification unless failure cost requires Sol judgment.
Luna receives only bounded mechanical edits or compression work.
Sol is reserved for complex repository diagnosis or protected/runtime approval judgments.

## 13. Read-only command guardrails

- Begin with depth 1-2 directory summaries.
- Narrow to an explicit directory before filename or heading search.
- Prefer count, filename, H1-H3, and selected-section output.
- Never run unbounded root `find`, `grep -R`, `wc -l`, or large `cat`.
- Use `rg --files` or scoped `rg`; cap result count where content may be large.
- Count lines without printing lines.
- Validate the counting expression on one file before aggregating large groups.
- If a parser emits repeated errors, stop and correct it instead of piping more output.
- Expand one scope level at a time and record the reason.
- Treat broken-reference fallback as bounded maintenance, not a discovery mandate.

## 14. Routing walkthroughs

### Scenario A: document or AI operating-rule change

| Decision | Route |
| --- | --- |
| default reads | `AGENTS.md`, `.codex/README.md`, `CONTEXT_ROUTER.md` |
| conditional reads | execution documentation section; `VERIFY_RULES` documentation section; affected rule only |
| do not read | domain files, security audits, full work log, unrelated Phase docs |
| security loading | N unless wording authorizes or weakens protected operations |
| verification loading | headings, duplication, references, status markers, diff check only |
| `.codex` logs | no; latest relevant entry only if continuity is explicitly needed |

This scenario is valid for the next restructure because it creates operating documents but does not change protected runtime surfaces.

### Scenario B: DB/Auth/Payment/Provider boundary work

| Decision | Route |
| --- | --- |
| default reads | `AGENTS.md`, `.codex/README.md`, `CONTEXT_ROUTER.md` |
| conditional reads | high-risk execution rules, relevant security sections, relevant verification sections, existing domain if present |
| source reads | actual code/schema/config, current verifier, approved runbook |
| do not read | all domains, all security audits, all reviews, entire work log |
| security loading | Y; full document only for multi-surface or ambiguous impact |
| verification loading | contract/safety sections and current scripts; runtime only with safe authority |
| `.codex` logs | latest related failed/blocked entry only when it affects the gate |

This scenario is valid because the route fails closed when safe authority or current evidence is missing.

## 15. Minimal restructure sequence

Do not begin with moves or deletion.

1. Freeze this inventory and approve the seven-file target.
2. Create L0/L1 plus the two domain governance files; create no individual domain.
3. Preserve `AGENTS.md` enforcement and point it to L0 without deleting duplicated rules yet.
4. Add precedence and status statements to the new entry layer.
5. Route documentation-only trial work through the new entry and compare missed rules.
6. Route one protected-surface diagnosis without execution and verify conditional security loading.
7. Reconcile parity with `AI_ROUTER`, `AI_REVIEW_CHECKLIST`, and minimum Git rules.
8. Mark old operating documents as non-entry references before considering retirement.
9. Classify L3/L4 files with metadata or indexes; do not move them in the same step.
10. Propose archive candidates with replacement evidence and obtain separate approval.
11. Propose the first individual domain only after repeated-use evidence and explicit approval.

## 16. Prompt and token reduction mechanism

The structure reduces prompt length by routing from delta rather than replaying history.
L0 is stable and short; L1 loads by section; L2 contains current state only; L3 is followed selectively; L4/L5 are normally excluded.
Handoffs transfer decisions, scope, and verification instead of conversations.
No token estimate is made because token usage was not observable in this investigation.

## 17. Remaining risks and escalation

- Current-state claims inside existing architecture and security documents were not runtime-reverified.
- Architecture Phase chains may contain supersession relationships that filenames alone cannot prove.
- The verifier estate lacks one discoverable command index and may contain historical checks.
- Root `AGENTS.md` and restructured `.codex` rules may conflict until parity is explicitly tested.
- Some `.codex` files have useful operating content that cannot be retired before replacement.
- Archive candidates require document-by-document replacement evidence.
- The active branch name describes survey work, but the user explicitly authorized this Phase X documentation task on the current branch.

Sol escalation is not required for this plan because no protected operation or current security approval is being decided.
Recommend Sol only if the implementation phase attempts to declare security/Auth/DB/payment/provider documents current without code/schema/config/verifier proof.

## 18. Phase completion boundary

- Actual file moves: none.
- Actual file deletion: none.
- Actual `.codex/` restructure documents: not created.
- Individual domain documents: not created.
- Feature/runtime code: not changed.
- DB/Auth/Payment/Provider/Supabase/Docker/production operations: not run.
- Next phase: prepare and approve the bounded prompt for actual `.codex` restructure implementation.
