# AI Resource Usage Log

## Record rules

- This is an append-only audit log, not default operating context.
- Read only a named or recent relevant entry when resource continuity is needed.
- Record observed values only; do not estimate tokens, credits, balances, or usage percentages.
- Use `user_observed` for user-provided values and `not_observable` when no value is available.
- Do not copy task reports or Phase history into entries.

## Entries

### Phase X

- model: Sol
- reasoning_level: high
- usage_percent: 30
- measurement_source: user_observed
- final_status: ready_for_agent_context_restructure

### Phase X+1

- model: Terra
- reasoning_level: high
- usage_percent: 9
- measurement_source: user_observed
- final_status: codex_context_entry_implemented

### Phase X+2

- model: Terra
- reasoning_level: high
- usage_percent: not_observable
- measurement_source: not_observable
- final_status: codex_l1_rules_and_resource_log_implemented
