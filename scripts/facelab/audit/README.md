# Face Lab — 오프라인 마이그레이션 이력 비교

#1201의 4나-2 준비 단계. **네트워크/DB 연결·SQL 실행 없음**. 로컬 디렉터리의 `.sql` 파일 이름과 SHA-256 지문 및 별도로 확보한 Supabase 마이그레이션 이력 목록만 비교합니다.

## 입력

Supabase 목록은 비밀값을 제거한 JSON으로 저장합니다. 대상 프로젝트의 **Production 연결 동일성 검증은 이 도구가 수행하지 않습니다**.

```json
{
  "migrations": [
    {"version": "20261001080202", "name": "example_migration_a"},
    {"version": "20261001080214", "name": "example_migration_b"}
  ]
}
```

`version`은 문자열로 저장해야 하며 길이 14자리의 숫자입니다. 파일은 `YYYYMMDDHHMMSS_description.sql` 형식으로 검사합니다. 중복 버전·경로 침범·이상한 문자·잘못된 해시가 있으면 안전하게 오류로 중단합니다.

## 로컬 실행

```bash
node scripts/facelab/audit/compare-face-lab-migration-history.mjs \
  --repo-dir supabase/migrations \
  --hosted-list /path/to/nonsecret-migrations.json \
  --out-dir /path/to/local-audit-output

node scripts/facelab/audit/verify-face-lab-migration-history.mjs
```

출력: `migration-reconciliation.csv`, `migration-reconciliation-review.md`, `migration-reconciliation-summary.json`.

## 분류와 의미

- **같은 버전·같은 이름**: `exact_record`, 목록상 일치일 뿐 실제 SQL 적용 증거는 아님.
- **같은 버전·이름 다름**: `version_match_name_drift`, SQL 및 객체 대조 필요.
- **서로 다른 버전·고유한 정규화 이름 일치**: `renamed_or_reversioned_candidate`, 양쪽 각각 단독 이력으로 남고 **자동 확정하지 않음**.
- **저장소 전용/이력 전용**: `repo_only_unresolved`, `hosted_only_unresolved`.
- 이름이 중복돼 어느 쪽과 대응할지 모호하면 고유 후보로 간주하지 않음.
- Face Lab·Auth·Admin·RLS·Storage 등 보안 관련 이름은 우선 검토 표식을 붙이나, 이름만으로 SQL 실제 영향 여부는 확정하지 않음.

`matched+repo_only=repo_count`, `matched+hosted_only=hosted_count`를 검증하고 모든 불일치 기록을 CSV에 보존합니다.

## 운영 안전 경계

**Production 판정은 항상 `HOLD`**. Vercel ↔ Supabase 실제 배포 프로젝트 동일성, SQL 실행 시점·실제 DB 객체 상태, 권한 및 RLS 안전성은 이 오프라인 도구가 검증하지 못합니다. 비교 결과를 근거로 기존 이력을 삭제/교정하거나 SQL을 재실행하지 마십시오.

호스팅 프로젝트 조사에서 2026-10-09에 확인한 142/171/101/41/70 수치는 과거 스냅샷이므로 입력값을 임의로 맞추지 말고 **새 기준 시점**의 목록을 별도 수집해야 합니다. 원본 프로젝트 키/DB URL/사용자 자료는 JSON에 넣지 않습니다.
