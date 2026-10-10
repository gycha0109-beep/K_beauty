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

기본 입력은 14자리 버전 `YYYYMMDDHHMMSS_description.sql`만 허용합니다. 실제 main의 2026-10-10 파일 143개 중 7개는 기존 8자리 날짜 버전이므로, 8자리 파일도 입력 대상으로 읽으려면 `--allow-legacy-date-versions`를 **명시적으로** 지정해야 합니다. 그러나 `20260824` 버전이 두 파일에 중복돼 있어, 해당 옵션을 켜도 현 저장소 전체 입력은 `repo_duplicate_version`으로 안전하게 중단됩니다. 중복은 임의로 제거·이름 변경·실행 순서 확정하지 말고 원본 이력과 별도 대조해야 합니다. 이 옵션은 8자리 버전을 있는 그대로 비교할 뿐 14자리로 자동 보정하거나 적용 여부를 확정하지 않습니다. 잘못된 버전·설명, 중복, 예상하지 못한 파일과 심볼릭 링크는 무시하지 않고 중단합니다. 빈 목록도 비교 완료로 인정하지 않습니다.

## 8자리 중복 버전 사전 진단 (DB 이력 없이 실행 가능)

현재 저장소의 20260824 버전은 PR #303 (커밋 aa3042eb5c94128d4af7a4286231a1fc390362a5)에서 동시에 추가된 서로 다른 SQL 2개입니다. 하나는 `products.name_en`, `brand_en` 컬럼 추가, 다른 하나는 상품 표시명 백필입니다. **같은 날짜라는 사실은 실행 이력·실행 순서 증거가 아닙니다.**

호스팅 DB 정체성 확인이나 JSON 수집 전에, 다음 오프라인 명령으로 파일 구조를 먼저 진단합니다.

```bash
node scripts/facelab/audit/inspect-face-lab-migration-inventory.mjs \
  --repo-dir supabase/migrations \
  --out-dir /path/to/local-inventory-diagnostic
```

산출물: `migration-inventory-preflight.json`, `migration-inventory-preflight.md`.

- SHA-256은 SQL 내용에 대해 **로컬 계산만** 수행하며 SQL은 실행하지 않습니다.
- 14자리/8자리 버전 수, 중복 그룹과 충돌한 파일, 이상한 파일명 개수를 결정적으로 집계합니다.
- 형식이 틀린 파일명 원문은 비밀 노출 예방을 위해 출력하지 않습니다.
- 중복이 발견돼도 진단 자체는 정상 완료될 수 있지만 결과 `status=HOLD`, `inventoryReconciliationEligible=false`입니다. 실제 비교기에서는 계속 `repo_duplicate_version`으로 중단합니다.
- 이름/버전을 자동 교정·삭제하거나 다른 파일을 무시하지 않습니다.
- Hosted 이력, Vercel/Supabase 프로젝트 동일성, 실제 SQL 실행 여부, 물리 객체 상태는 검증하지 않습니다.

## 로컬 실행

```bash
node scripts/facelab/audit/compare-face-lab-migration-history.mjs \
  --repo-dir supabase/migrations \
  --hosted-list /path/to/nonsecret-migrations.json \
  --out-dir /path/to/local-audit-output \
  --allow-legacy-date-versions \
  --git-commit YOUR_40_CHARACTER_COMMIT_SHA \
  --snapshot-at 2026-10-10T09:00:00Z

node scripts/facelab/audit/verify-face-lab-migration-history.mjs
```

출력: `migration-reconciliation.csv`, `migration-reconciliation-review.md`, `migration-reconciliation-summary.json`.

커밋 SHA와 기준 시점은 입력을 제공한 운영자가 기입하는 **선언 메타데이터**이며, 실제 저장소/호스팅 대상과의 동일성을 자동 검증하지 않습니다. JSON에는 대조 불일치 대상과 보류 상태만 기록합니다. CSV 문자열은 스프레드시트 수식으로 실행되지 않도록 무력화합니다. 출력 폴더는 SQL 원본 디렉터리 밖으로 지정해야 합니다.

## 분류와 의미

- **같은 버전·같은 이름**: `exact_record`, 목록상 일치일 뿐 실제 SQL 적용 증거는 아님.
- **같은 버전·이름 다름**: `version_match_name_drift`, SQL 및 객체 대조 필요.
- **서로 다른 버전·고유한 정규화 이름 일치**: `renamed_or_reversioned_candidate`, 양쪽 각각 단독 이력으로 남고 **자동 확정하지 않음**.
- **저장소 전용/이력 전용**: `repo_only`, `hosted_only`(적용 누락이나 과잉 적용이 확인된 뜻이 아님).
- 이름이 중복돼 어느 쪽과 대응할지 모호하면 `ambiguous_candidate`로 분류하고 가능한 버전들을 모두 표시; 고유 후보로 간주하지 않음.
- Face Lab·Auth·Admin·RLS·Storage 등 보안 관련 이름은 우선 검토 표식을 붙이나, 이름만으로 SQL 실제 영향 여부는 확정하지 않음.

`matched+repo_only=repo_count`, `matched+hosted_only=hosted_count`를 검증하고 모든 불일치 기록을 CSV에 보존합니다.

## 운영 안전 경계

**Production 판정은 항상 `HOLD`**. Vercel ↔ Supabase 실제 배포 프로젝트 동일성, SQL 실행 시점·실제 DB 객체 상태, 권한 및 RLS 안전성은 이 오프라인 도구가 검증하지 못합니다. 비교 결과를 근거로 기존 이력을 삭제/교정하거나 SQL을 재실행하지 마십시오.

호스팅 프로젝트 조사에서 2026-10-09에 확인한 142/171/101/41/70 수치는 과거 스냅샷이고, 저장소 2026-10-10 실제 SQL 수는 143입니다. 서로 다른 시점의 수치를 맞추지 말고 **동일 기준 시점**의 목록을 별도 수집해야 합니다. 원본 프로젝트 키/DB URL/사용자 자료는 JSON에 넣지 않습니다.
