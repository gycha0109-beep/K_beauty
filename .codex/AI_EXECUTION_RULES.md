# AI Execution Rules

## Purpose and precedence

This is the canonical conditional L1 execution-rules surface.
Read it only when the router selects execution scope, Git/change control, model handoff, or completion reporting.
It complements [AGENTS.md](../AGENTS.md), [AI_ROUTER.md](AI_ROUTER.md), and the detailed [PROJECT_SYNC_RULES.md](PROJECT_SYNC_RULES.md); it does not replace them.

Codex applies confirmed direction to the repository. It does not create a new operating philosophy or expand a bounded task into redesign.

## Execution discipline

- Confirm current repository state, requested delta, non-targets, and allowed paths before changing files.
- Use the smallest change that satisfies the confirmed goal.
- Inspect or modify only files directly relevant to the task.
- Do not introduce unrelated refactors, duplicate policy paths, or long-term branch-state documents.
- If cause, impact, contract, or allowed scope becomes unclear, stop implementation and return to diagnosis or request direction.
- Treat code, schema, config, package commands, and verifier output as stronger evidence than context documents.

## Scoped investigation and change control

- Start from the router-selected path and depth 1-2 structure.
- Use scoped filenames, headings, counts, and selected sections before widening investigation.
- Do not use global repository searches or large unbounded output to resolve one uncertainty.
- Preserve existing user changes; never overwrite or revert them without explicit direction.
- Follow `PROJECT_SYNC_RULES.md` only for the relevant Git, workstation, sync, or local-data section.
- Do not use destructive Git commands such as reset, rebase, force push, or unapproved history rewrite.
- Do not stage or commit unless the user explicitly asks.

## Model roles and escalation

- GPT conversation decides design, strategy, and confirmed direction.
- Terra handles ordinary implementation, documentation restructuring, verifier work, and mechanical verification.
- Luna handles bounded simple edits, cleanup, naming, and report compression.
- Sol is reserved for complex repository diagnosis or DB/Auth/RLS/Provider/Payment/Runtime/Security risk judgment.
- Do not create a fixed Sol-to-Terra-to-Sol pipeline.
- Escalate only when the current bounded evidence cannot safely determine a high-cost protected decision.

## Handoff and completion

Handoffs contain L0 entry, task/model role, delta, confirmed decisions, allowed/forbidden scope, security routing, verification set, and open uncertainty only.
Do not transfer full chat history, all Phase records, or whole documentation directories.

Completion reporting must state the task type, routing/security decision, changed files, verification, unperformed checks and reason, reference issues, and remaining risk.
For Medium-or-higher work or a problem, append a concise entry to `AI_WORK_LOG.md`.
Resource logging is optional evidence: append only an observed user-provided or environment-observed value, and do not make it a completion condition.
