# AI Router

## Purpose and precedence

This is the canonical `.codex` router.
Read it after [AGENTS.md](../AGENTS.md) and [.codex README](README.md).
It chooses what to read; it does not replace the actual code, schema, config, package command, or verifier result.

When evidence conflicts, prefer the executable/current source and report the mismatch.
Do not store a long-term branch purpose or Phase history here.

## Start with the delta

1. State the requested change, diagnosis, review, or recovery and explicit non-targets.
2. Classify it as execution, diagnosis, design, review, or recovery.
3. Answer `Y` or `N` for DB, Auth, RLS, Storage, Provider, Payment, Secret, and Production impact or execution.
4. Treat direct impact, indirect impact, and uncertainty as `Y`.
5. Select only the necessary operating rules, source material, and verification scope.

Routing priority:

1. Protected or critical impact: do not modify until the relevant boundary is understood and authority is explicit.
2. Build/runtime failure, regression, or uncontrolled scope: recovery.
3. Unknown cause, data flow, or impact: diagnosis.
4. New capability, cross-layer contract, or structural change: design before implementation.
5. Existing change/result inspection: review.
6. Bounded, understood change: execution.

## Minimum and conditional reads

Always read:

- [AGENTS.md](../AGENTS.md)
- [.codex README](README.md)
- this router

Read only when selected by the delta:

| Need | Conditional reference |
| --- | --- |
| current cross-task context | [AI_CONTEXT.md](AI_CONTEXT.md), only the relevant section |
| execution scope, Git/change control, handoff, or reporting | [AI_EXECUTION_RULES.md](AI_EXECUTION_RULES.md), only the relevant section |
| Git/workstation/data synchronization | [PROJECT_SYNC_RULES.md](PROJECT_SYNC_RULES.md), only the needed section |
| verification meaning | [AI_REVIEW_CHECKLIST.md](AI_REVIEW_CHECKLIST.md), only the task-type section |
| continuity, prior failure, or resource observation | the latest relevant slice of `AI_WORK_LOG.md` or `AI_RESOURCE_USAGE_LOG.md`, never the full history |
| protected-surface decision with `Y` delta | [SECURITY_BOUNDARIES.md](SECURITY_BOUNDARIES.md), relevant `AGENTS.md` protected-area rules, and current code/schema/config/verifier |
| detailed design/contract/runbook | the named source reference, not its whole directory |
| existing domain summary | only if a relevant approved domain document exists |

Do not default-read audit logs, dated Phase/review/runbook material, screenshots, local logs, profiles, temporary artifacts, or unrelated domains.

## Security and verification routing

For a `Y` security delta, apply the relevant `AGENTS.md` Protected Areas section first.
Then read only the matching [SECURITY_BOUNDARIES.md](SECURITY_BOUNDARIES.md) section and source material needed for the affected boundary.
Do not load unrelated security history or a full security corpus merely because one protected category is involved.

For an `N` security delta, state the basis in the completion report and do not load unnecessary security detail.

If a required security boundary cannot be established from the bounded current evidence, stop before protected execution and report the uncertainty.
Do not create a replacement security policy in this router; recommend a focused follow-up or Sol judgment when the failure cost requires it.

Select verification by task type:

- documentation/rules: headings, paths, references, scope, and diff checks;
- bounded implementation: relevant static check or focused test, then proportionate build/test only when allowed;
- diagnosis/review: evidence appropriate to the question, without implementing a fix unless authorized;
- API/DB/Auth/Provider/Payment: current contract and safety verifiers, with runtime execution only under explicit safe authority.

Resolve the actual command from current `package.json` or the relevant `scripts/` path before running it.
Do not treat a documented command as authoritative when it disagrees with the executable script.

## Source selection and scope control

Use the smallest source that can answer the task:

- current code, schema, config, package script, or verifier for executable facts;
- a named contract or runbook for detailed intended behavior;
- a review, Phase record, or work-log slice only for evidence/history;
- a domain summary only when it exists and the task needs its current-state context.

Do not promote an old document's conclusion into current fact without verification.
Do not copy long source text into L0 documents or complete reports.
If the necessary evidence is outside the approved scope, report the boundary and request direction rather than widening the task.

## Task-type behavior

| Type | First action | Completion boundary |
| --- | --- | --- |
| execution | modify only the bounded requested files | report changed files and verification |
| diagnosis | inspect narrow evidence before modification | report cause candidates and minimum next step |
| design | describe current/target structure and risk | do not implement without scope approval |
| review | inspect diff/result before modification | report findings, omissions, and risk |
| recovery | contain failure and inspect last relevant change | propose the smallest recovery path |

If an execution task grows beyond its known cause or file boundary, switch to diagnosis.
If any task produces a build/runtime regression or loses scope control, switch to recovery.

## Domains, references, and history

An existing relevant domain document may be read as a current-state summary.
If it is absent, continue with bounded source evidence; do not fail the task and do not create `.codex/domains/` or a domain document without explicit user approval.

Links are references, not hard dependencies.
For a broken reference, check the named path and one bounded parent/sibling scope, then prefer code/schema/config/verifier evidence.
Report `Reference Maintenance Issue`; do not repair unrelated documents or begin a repository-wide search.

Phase, review, runbook, and work-log records are audit evidence, not default current context.
Read only a named or latest relevant slice when continuity or evidence requires it.

## Investigation and handoff limits

Start with depth 1-2 structure and narrow to an explicit directory before searching.
Use scoped `rg`, filenames, counts, headings, and selected sections; avoid global `grep`, `find`, or large `cat` output.
If a command produces repeated parser/output errors, stop and correct the command instead of widening the search.

Sol, Terra, and Luna handoffs contain only L0 entry, task/model role, delta, confirmed decisions, allowed/forbidden scope, security routing, verification set, and open uncertainty.
Do not transfer full chat history, all Phase records, or whole architecture/review directories.

## Completion report

Report task type, delta/security decision, files read or changed, verification, unperformed checks with reason, Reference Maintenance Issues, and remaining risk.
For Medium-or-higher work or a problem, append a concise entry to `AI_WORK_LOG.md`.
