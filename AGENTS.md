# AGENTS.md

## 1. Core Rules

- 요청과 직접 관련된 파일만 수정한다.
- 요청 없는 대규모 리팩토링은 하지 않는다.
- 기존 핵심 플로우를 깨뜨리지 않는다.
- 불확실하면 구현하지 말고 원인/선택지/리스크를 보고한다.
- 작업 완료 후 변경 파일, 검증 결과, 남은 리스크만 요약한다.

## 2. Git / Branch

- 작업 시작 전 현재 브랜치와 `git status`를 확인한다.
- 기존 변경사항은 임의로 덮어쓰거나 정리하지 않는다.
- 작은 문구/스타일/단순 수정은 현재 브랜치에서 진행 가능하다.
- 대규모 UI 구조 변경, API/DB/auth/payment/storage 변경, 여러 파일 리팩토링은 별도 브랜치를 권장한다.
- 현재 브랜치가 작업 목적과 맞지 않으면 작업을 시작하지 말고 보고한다.
- 작업 완료 후 현재 브랜치와 변경 파일 목록을 보고한다.

## 3. Protected Areas

사용자 승인 없이 아래 영역을 직접 수정하지 않는다.

- `.env*`
- auth/callback/redirect
- Supabase schema / migration / RLS policy
- payment
- production data
- API response field names
- 저장 데이터 구조
- 배포 설정
- 패키지 대규모 변경

필요해 보이면 수정하지 말고 제안만 한다.

## 4. Risk Levels

- Low: 문구, 아이콘, 작은 스타일 수정 → 직접 수정 가능
- Medium: 컴포넌트 구조, 레이아웃, 추천 문구 생성 로직 → 수정 후 검증 보고
- High: API, DB query, 저장 로직, 인증, 환경 변수 → 직접 수정 금지, 제안만
- Critical: 결제, 개인정보, production DB, 권한 정책, 배포 설정 → 작업 중단 후 승인 요청

## 5. Context

필요 시 `.codex/AI_CONTEXT.md`를 확인한다.

- Active: 이번 작업에 반영할 최신 기준
- Bridge: 참고 기준
- Candidates: 검토 후보
- Deactivated: 되살리지 않을 방향

Deactivated 내용을 현재 기준으로 되살리지 않는다.

## 6. Validation

작업 후 필요한 범위에서 `.codex/AI_REVIEW_CHECKLIST.md`를 기준으로 검증한다.

기본 확인:
- build 통과
- 핵심 페이지 진입 가능
- 주요 CTA 유지
- 모바일 레이아웃 유지
- 콘솔 에러 없음
- Protected Areas 침범 없음
- 작업 목표 달성

작업 유형별 확인:
- UI 작업: UI 작업 검증 항목 확인
- API/데이터 작업: API/데이터 작업 검증 항목 확인
- AI 결과물 작업: AI 결과물 검증 항목 확인

## 7. Rollback Stop Conditions

아래 상황이면 임의로 계속 수정하지 말고 원인과 롤백 후보를 보고한다.

- build 실패
- 핵심 플로우 실패
- API 응답 호환성 깨짐
- 저장/auth/payment 영향 발생
- 수정 범위가 예상보다 커짐
- 원인 파악 없이 파일을 계속 수정해야 함

## 8. Work Log

Medium 이상 작업 또는 문제가 발생한 작업은 `.codex/AI_WORK_LOG.md`에 남긴다.

형식:
- 날짜:
- 작업명:
- 목표:
- 변경 파일:
- 검증 결과:
- 문제/주의점:
- 다음 작업:

## 9. UI Feedback

- 메타포 피드백은 문제 탐지용으로만 사용한다.
- 실제 수정은 component / hierarchy / spacing / contrast / glow / divider / padding 단위로 수행한다.
- hierarchy, spacing rhythm, visual fatigue, card fragmentation 판단은 screenshot 기준으로 한다.

## 10. revisit 기능 구현

- 세부 사항은 `.codex/AI_REVISIT.md`를 참조한다.
- 브랜치를 확인하고 작업한다.