# .codex operating context entry

## Purpose

`.codex` is the repository's AI operating-context entry and Codex execution-record location.
It routes an agent to the smallest relevant set of instructions and evidence; it is not a source of truth.

When a `.codex` document conflicts with actual code, schema, configuration, or current verifier output, prefer the executable/current source and report the mismatch.

## Entry order

1. Read [AGENTS.md](../AGENTS.md) for repository-wide constraints.
2. Read this file for role boundaries and entry behavior.
3. Read the canonical [AI_ROUTER.md](AI_ROUTER.md) to classify the current delta and select conditional reads.
4. Read only the documents, sources, and checks selected by the router.

Do not load every `.codex`, architecture, review, Phase, or runbook document at task start.

## Role boundaries

| Role | Contents | Default behavior |
| --- | --- | --- |
| Operating context | this README, `AI_ROUTER.md`, conditionally selected rules/context | short, task-scoped reads |
| Audit log | `AI_WORK_LOG.md` and an existing resource-usage log | read only as a relevant recent/known entry |
| Tool config/artifacts | `hooks.json`, `hooks/`, environments, screenshots, local logs, profiles, temporary output | not AI context unless the task explicitly needs it |

[AI_CONTEXT.md](AI_CONTEXT.md) is a conditional current-context reference, not a mandatory startup read.
[AI_EXECUTION_RULES.md](AI_EXECUTION_RULES.md), [AI_REVIEW_CHECKLIST.md](AI_REVIEW_CHECKLIST.md), and [SECURITY_BOUNDARIES.md](SECURITY_BOUNDARIES.md) are conditional L1 execution, verification, and security references.
[PROJECT_SYNC_RULES.md](PROJECT_SYNC_RULES.md) remains the detailed Git/workstation reference.

## Conditional routing principles

The router first identifies the requested delta and task type.
It then asks whether DB, Auth, RLS, Storage, Provider, Payment, Secret, or Production is directly or indirectly affected.
Ambiguity is `Y`; a `Y` result adds only the relevant protection and verification reads.

The full work log and [AI_RESOURCE_USAGE_LOG.md](AI_RESOURCE_USAGE_LOG.md) are audit records, not default context.
Old Phase, review, and runbook material is evidence only and is not default context either.

## Protection boundary

The repository-wide protected-area rules remain in [AGENTS.md](../AGENTS.md).
The router decides whether the current delta needs the related boundary evidence; it does not grant permission to change a protected surface.
For a non-protected documentation task, record the `N` basis instead of loading unrelated security detail.
For a protected or ambiguous delta, treat it as `Y` and load only the relevant current source material.

Runtime, production, database, provider, payment, and security approval remains separate from ordinary document routing.

## Record handling

Use `AI_WORK_LOG.md` for concise Medium-or-higher task outcomes or problems.
Read only a recent or named relevant entry when continuity is needed.
Use an existing resource-usage log only for observed values; do not estimate tokens, credits, or account balance.
If no resource-usage log exists, this entry layer does not require one to be created.

## Domain documents

Read an existing domain document only when the router finds it relevant.
If no domain document exists, continue with bounded repository evidence; its absence does not fail the task.
Do not create a domain document or `.codex/domains/` proactively.
First creation requires repeated-use evidence and explicit user approval.

## Reference fallback

Links are references, not hard dependencies.
When a reference is missing or stale, confirm the named path and one bounded sibling/parent scope, then use actual code, schema, config, or verifier evidence.
Report the condition as a `Reference Maintenance Issue`; do not start a repository-wide search or silently repair unrelated documents.

## Maintenance boundary

Keep L0 documents short and routing-focused.
Do not copy detailed architecture, Phase history, security policy, verifier commands, or audit prose into this README.
Use links to existing detailed rules and resolve current commands from `package.json` or the relevant `scripts/` path when needed.

Do not store the current branch purpose, a running task diary, or a fixed domain list here.
Update a routing statement only when the reusable entry behavior changes.
Record task-specific outcomes in the work log rather than enlarging L0.

Before ending a task, report the selected path and checks rather than replaying the full context history.
Keep new entry guidance as a pointer to current evidence, not a second detailed specification.
