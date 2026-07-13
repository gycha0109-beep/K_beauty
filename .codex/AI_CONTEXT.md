# AI_CONTEXT.md

> Role: conditional reference
> Default read: no
> Canonical authority: no; actual code/config/verifier and L0/L1 rules take precedence.
> Read when: the router selects a non-empty relevant Active, Bridge, Candidate, or Deactivated item.
> Canonical references: `README.md`, `AI_ROUTER.md`, `AI_EXECUTION_RULES.md`

## 목적

이 문서는 현재 작업에 반영할 기준과 보류·폐기된 맥락을 분리해, AI 에이전트가 필요한 컨텍스트만 참조하도록 관리한다.

단순 작업 로그는 기록하지 않는다. 작업 이력과 반복 규칙 후보는 `.codex/AI_WORK_LOG.md`에 기록한다.

---

## 작성 원칙

- Active에는 현재 작업에 반드시 반영할 최신 기준만 적는다.
- Bridge에는 다른 작업이나 프로젝트에도 참고 가능한 연결 맥락을 적는다.
- Candidates에는 아직 확정되지 않은 선택지나 실험 후보를 적는다.
- Deactivated에는 현재 작업에서 되살리지 않을 방향을 적는다.
- 오래된 결정을 Active에 유지하지 않는다.
- 실패한 방향을 반복적으로 상세 설명하지 않는다.
- 현재 작업과 무관한 정보를 Active에 넣지 않는다.

---

## 승격 기준

Work Log의 `규칙 승격 후보` 중 3회 이상 반복되거나, 사고 방지 가치가 높은 항목만 Context 또는 상위 규칙으로 승격한다.

승격 시에는 아래 기준을 따른다.

- 현재 작업에 바로 적용할 기준이면 Active
- 다른 작업에도 참고 가능한 기준이면 Bridge
- 검토 중인 선택지면 Candidates
- 반복을 막아야 할 폐기 방향이면 Deactivated

---

## Active Context

현재 작업에 반드시 반영할 최신 기준.

- The controlled local shadow route comparison passed on a loopback disposable target with the local provider stub. The Phase 46.1 evaluator-to-hint-to-receiver policy shadow path is implemented but not yet executed. It requires development, the existing dry-run flag, a separate policy-shadow flag, and the local provider-stub/local-marker/loopback gates; it records sanitized candidate IDs, decision codes, and aggregate safety counts only, without changing the public response or recommendations.

---

## Bridge Context

다른 작업이나 프로젝트에도 참고 가능한 연결 맥락.

-

---

## Candidates Context

검토 후보나 보류된 선택지.

-

---

## Deactivated Context

현재 작업에서 되살리지 않을 방향이나 반복 금지 패턴.

-
