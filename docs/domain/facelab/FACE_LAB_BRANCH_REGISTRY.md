# [Face Lab] GitHub 브랜치·PR 관리 대장

> 작성: 2026-10-13. 최신 `main` 및 당시 **열려 있는** Face Lab PR 12건 기준. PR 상태는 변하므로 실행 전 GitHub를 다시 조회한다.  
> 기준: [FACE_LAB_V2_ROADMAP.md](FACE_LAB_V2_ROADMAP.md)  
> 목표: 프로젝트의 PR/브랜치 식별이 **명백하고**, 오래된 Draft·연구·운영 DB 관련 PR을 제품 main 구현으로 혼동하지 않도록 한다.

## 1. 규칙 (새 PR/브랜치)

- **브랜치:** `face-lab/<type>-<topic>-YYYYMMDD`
  - 예: `face-lab/feat-personal-color-observation-20261013`
  - type: `feat` / `fix` / `docs` / `research` / `test` / `ops`
  - 브랜치명은 Git의 허용된 문자만 사용. 공백·대괄호 `[` 불가.
- **PR 제목:** 반드시 **`[Face Lab]`** 접두. 뒤에 내용·단계를 명확히 쓴다.
- **PR 본문:** milestone(M0~M6), source of truth, main 대비 diff/검증, 본인 작업 범위, 독립 보안/운영 HOLD, 원래 PR 링크를 쓴다.
- **커밋:** 가능하면 `Watchtower-Track: face-research` 유지. 외부 트랙과 섞어서 커밋하지 않는다.
- **main:** 새 브랜치는 우선 최신 main에서 분기. 다른 PR 작업 내용을 전제로 하려면 그 PR의 미병합 상태를 분명히 적는다.
- **CI:** 브랜치 이름만으로 Gate를 우회하거나 Ready로 올리지 않는다. Draft 유지, 승인 없는 머지 금지.

## 2. 현재 열려 있는 Face Lab 관련 PR (2026-10-13 관찰)

> 아래 기존 브랜치명은 **역사적 ref**이다. 이미 열려 있는 PR의 HEAD를 무심코 rename하면 GitHub가 해당 PR을 **close**할 수 있으므로 **이름 변경 없이 보존**한다. 식별성은 이미 PR 제목 `[Face Lab]`로 먼저 통일했다.

| PR | 트랙/범위 | 기존 브랜치 | 상태/처리 |
| --- | --- | --- | --- |
| [#1261](https://github.com/gycha0109-beep/K_beauty/pull/1261) | 구 완결 계획 Draft | `docs/face-research/face-lab-v2-product-roadmap-20261013` | **현재 본 완결 로드맵 PR로 대체 예정**. 새 PR 성립 후 이전 문서는 superseded로 표시·닫기 |
| [#1264](https://github.com/gycha0109-beep/K_beauty/pull/1264) | **M0** Premium 저장/편집 UX | `feat/face-research/premium-p0-save-recovery-20261013` | Open Draft; 보안/실기기 확인 전 병합 금지 |
| [#1242](https://github.com/gycha0109-beep/K_beauty/pull/1242) | **M1** Human blind pair | `feat/face-research/human-pairwise-pilot-seal-and-private-reveal-20261012` | Open Draft; 실제 평가자 결과는 별도 |
| [#1233](https://github.com/gycha0109-beep/K_beauty/pull/1233) | **M3/M4** Subject-Variant Try-On 카탈로그 연결 | `fix/face-research/try-on-catalog-bridge-current-main-20261012` | Open Draft; 운영 identity/권리 미확인 |
| [#1225](https://github.com/gycha0109-beep/K_beauty/pull/1225) | **M3 운영** Supabase Production identity readback | `feat/face-lab/p1-d2c14-production-readback-guard` | Open; 운영 승인과 별개, 임의 병합 금지 |
| [#1209](https://github.com/gycha0109-beep/K_beauty/pull/1209) | **M3 운영** migration reconciliation | `fix/face-research/p1d2c6-offline-reconciler-hardening` | Open; migration owner 판정 필요 |
| [#840](https://github.com/gycha0109-beep/K_beauty/pull/840) | **M3 운영** hosted migration history | `fix/face-research/migration-history-alignment` | Open; 구 흐름 이력/중복 판정 |
| [#756](https://github.com/gycha0109-beep/K_beauty/pull/756) | V2 기본 target-to-style | `feat/facelab-v2-product` | Open 구형 PR; main 반영 여부 diff 재평가, 재병합 금지 |
| [#542](https://github.com/gycha0109-beep/K_beauty/pull/542) | Face Space/Archetype 연구 | `research/facelab-reverse-archetype-r-a2-pilot-v1` | Open 연구 PR; V2 핵심 엔진과 분리 |
| [#276](https://github.com/gycha0109-beep/K_beauty/pull/276) | 연구·리뷰 governance | `governance/face-eval-d2d-x-link-ready` | Open 구형 연구 PR; read-only 근거 |
| [#134](https://github.com/gycha0109-beep/K_beauty/pull/134) | Provider E2E dispatch | `chore/activate-face-lab-provider-dispatch` | Open Draft 구형; 재사용 여부 재검토 |
| [#133](https://github.com/gycha0109-beep/K_beauty/pull/133) | vision foundation | `integration/face-vision-main-baseline` | Open Draft 구형; 현재 Vision 계약과 diff 검토 |

**제외:** Full Report 4섹터 #663은 **Face Lab 전용 PR이 아니므로** 별도 도메인에서 관리한다. Taxonomy/migration #1232도 `taxonomy-ai` 소유이며 Face Lab 이름을 덧씌우지 않는다.

## 3. 기존 브랜치를 직접 rename하지 않는 이유

GitHub 문서 기준, **열려 있는 PR의 head branch를 rename하면 해당 PR이 닫힌다.** 따라서 "브랜치명 통일"을 위해 기존 브랜치들을 즉시 일괄 rename하는 것은 **기존 PR/검토 이력 및 작업 흐름 유지**라는 상위 목표와 충돌한다.

- 먼저 **기존 PR 제목 12건을 `[Face Lab]`로 정렬**하고 위 대응표로 조회.
- HEAD rename은 **해당 PR을 종료·교체할 것을 명시적으로 결정**했거나 PR 없이 보관하는 브랜치에만 수행.
- 교체가 필요한 경우: old PR/HEAD/CI 기록 → 새 `face-lab/*` branch에서 정확한 diff/권한 확인 → **새 PR 생성 및 link** → old PR은 `superseded by #...` 기록 후 종료. Draft/권한/보안 HOLD를 그대로 승계한다.
- 단순 새 브랜치 alias를 모든 구 PR에 생성하면 동일 변경이 두 위치에 존재해 더 혼란스러우므로 **임의 생성 금지**.
- 새 PR이 생겼다고 미병합 구 PR의 코드가 main에 들어왔다고 판단하지 않는다.

참고: [GitHub 공식 branch rename 설명](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch), [Git refname 규칙](https://git-scm.com/docs/git-check-ref-format).

## 4. 향후 작업자 체크리스트

1. PR 작성 전 브랜치명 `face-lab/` 식별자와 제목 `[Face Lab]` 확인.
2. 로드맵 M0~M6 중 딱 하나를 주 목표로 삼는다.
3. 신규 기능이 기존 `main`에 없는지 실제 source/CI에서 확인하고, Draft PR을 이미 반영된 코드로 착각하지 않는다.
4. 다른 owner DB/Auth/RLS/Provider/Security를 건드려야 한다면 **별도 승인**을 먼저 받는다.
5. CI·실기기·Human·운영증거를 구분 기록. SCA gate FAIL이면 배포/병합 보류.
6. 완료/교체된 PR은 해당 행을 업데이트하거나 링크를 달고, 새 PR 제목을 일관되게 유지한다.

**변경 기록:** GitHub PR 제목 통일은 제품 코드/브랜치 ref/CI 상태를 변경하지 않는다. 향후 새 PR은 신규 접두 규칙을 즉시 적용한다.
