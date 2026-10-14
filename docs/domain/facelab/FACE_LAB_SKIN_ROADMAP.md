# [Face Lab / Skin Track] BEJEWELY 피부 상태 분석·판단 로드맵 S0–S5

> **작성:** 2026-10-14 KST / **상태:** 신규 개발 계획 초안(Draft), 운영 승인 아님
> **기준선:** `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2` 조회 및 현재 아키텍처 문서 기준. 실서비스 정확도·실기기·Human 평가 완료를 의미하지 않음.
> **트랙:** `face-lab-skin` / **범위:** 피부 사진의 관찰 신호, 설문·제품 정보 통합, 현재 피부 고민/부담·컨디션 판단, 변화 추적과 Premium 표현.
> **동반 트랙:** [Style Track V2 로드맵](FACE_LAB_V2_STYLE_ROADMAP.md) — 별도 Draft [#1277](https://github.com/gycha0109-beep/K_beauty/pull/1277)에서 파일명 변경 중. Style **M0–M6**과 Skin **S0–S5**를 혼용하지 않는다.
> **문서 권위:** 실행 상태는 최신 코드/검증 결과가 우선. 판단·저장 권위는 기존 `SharedSkinDecisionContext v4`와 `premium-decision-bundle-v5`. 새 정책을 이 문서만으로 활성화하지 않는다.

## 0. 제품 목적과 책임 경계

**Skin Track의 사용자 질문:** “사진과 내 응답으로 확인할 수 있는 피부 신호는 무엇이며, 지금의 루틴에서 무엇을 유지·조정·보류하고 변화는 어떻게 확인할 것인가?”

- 피부 사진은 *관찰 근거*다. 사진으로 피부 타입, 수분량, 피지 분비량, 장벽 기능, 염증, 질환 또는 제품 반응의 원인을 직접 측정하거나 의료 진단하지 않는다.
- 피부 설문·현재 사용 제품·환경/사용감·과거 기록은 서로 다른 증거다. 관찰된 `붉어 보임`, `표면 광택`, `모공 가시성`, `톤 불균일` 등을 실제 질환·생리 상태의 확진으로 바꾸지 않는다.
- 사용자 경험은 **현재 상태의 근거와 불확실성 → 피부 고민 우선순위 → 현재 제품 및 루틴의 영향 검토 → 당장의 대응 → 다음 촬영에서 변화 확인**이다. 충분하지 않은 근거는 `unknown` 또는 `insufficient_evidence`로 남긴다.
- **Style Track**은 얼굴 특징/추구미, 미용 목적의 Personal Color/팔레트, SKU/Shade, 가상 룩 소유. Skin Track의 `uneven_tone`/붉은기/장벽·컨디션 신호는 Style의 피부톤 미용 적합도 또는 계절형 판정과 별개다.
- **공유:** 촬영 UI, 원본 업로드 경계, 사진 방향/품질·Eligibility, **한 번의** Unified Vision Provider 요청. 서로 다른 목적의 이중 Provider 호출·원본 재저장은 금지.

## 1. 이미 있는 구현과 검증되지 않은 것

| 층위 | current-main 실제 구현/계약 | 현재 판정 / 미검증 |
| --- | --- | --- |
| 사진 입력·공통 Vision | `app/api/analyze/route.js`, `lib/server/vision-observation-service.js`, `lib/vision-observation-normalizer.js`, `lib/image-analysis-eligibility.js` | 단일 입력/단일 Provider와 fail-closed 분기 구현. 기기·조명·화장에 대한 실제 재현성 미검증 |
| 피부 관찰 근거 | `lib/skin-observation-projector.js`, `lib/vision-observation-contract.js`, `lib/photo-evidence.js` | `oiliness/dehydration/acne/uneven_tone/pores/redness/barrier` 등의 시각적 단서·신뢰도. 의료적 측정/진단 근거 아님 |
| 사진+설문 판단 | `lib/skin-match-decision-engine-core.js`, `lib/shared-skin-decision-context-v4.js` | 사진 반영은 `skinAnalysisEligible === true`가 전제. 점수·우선순위 충돌 및 신뢰도 민감도 실증 필요 |
| Premium 정책 | `lib/premium-decision-state.js`, `lib/functional-policy.js`, `lib/routine-policy.js`, `lib/condition-policy.js`, `lib/cross-domain-consistency.js` | 기능성/루틴/상황 대응은 이미 구현. 실제 피부 상태 정확도와 개별 판단의 안전성·이해도 별도 검증 |
| Premium 표시·재진입 | `lib/premium-condition-projection.js`, `components/full-report/PremiumConditionResponseSection.jsx`, Premium session/snapshot/reentry | 결정 상태의 일관성·근거/불확실성 설명, 실브라우저/Android 인수 필요 |
| 합성 회귀 평가 | `docs/architecture/premium-integrated-evaluation-pack-v2.md`, `scripts/verify-premium-integrated-evaluation-v2.mjs`, `scripts/verify-shared-skin-decision-context-v4.mjs`, `scripts/verify-unified-vision-pipeline.mjs` | 평가 문서 기준 31개 변형/462 assertions. **합성 결정론 검증이지 실제 사진 판독 정확도 측정 아님** |

**현행 기준 문서:** `docs/architecture/skin-decision-engine-current-main-closeout-v1.md`, `docs/architecture/shared-skin-decision-context-v4.md`, `docs/architecture/premium-integrated-evaluation-pack-v2.md`, `docs/domain/facelab/unified-vision-observation-contract-v1.md`.

**핵심 금지:** 이미 존재하는 피부 결정 엔진을 별도 “Skin V2” 계산기로 무단 복제하거나, **기존 추천/Top Pick/score/eligibility, CandidateExposurePolicy shadow, Admin catalog, API field, 저장 schema**를 조용히 변경하지 않는다. 변경이 필요하면 영향 분석 → 좁은 별도 PR → #167 frozen recommendation baseline과 현행 policy/보안 검증 → 권한 있는 승인 순서로 진행한다.

## 2. 단계별 로드맵

| 단계 | 핵심 질문 | 예상 산출물 | 선행·완료 조건 |
| --- | --- | --- | --- |
| **S0 — 전수 감사** | 지금 사진의 어떤 신호가 어떤 계산과 행동으로 이어지는가? | source→canonical context→policy→UI 매핑, 위험·누락·테스트 감사서, 기준선 | **즉시 착수 가능**, 코드/스키마 변경 없음 |
| **S1 — 사진 관찰 신뢰성** | 정상/왜곡 사진에서 신호 추출·보류가 재현되는가? | 신호별 참조 세트·품질 게이트·반복 촬영 평가/abstain 프로토콜 | S0 계약 동결, real-photo는 동의·비공개 보관 승인 필요 |
| **S2 — 종합 판단 타당성** | 설문/사진/제품이 충돌해도 올바르게 보수적으로 판단하는가? | 증거 우선순위·교차 도메인 결정 평가/안전성 회귀 | S0 + 기존 v4, 실제 판단 평가는 독립 검수 |
| **S3 — 피부 변화 추적** | 같은 사용자의 변화와 촬영 조건 차이를 구별하는가? | 캡처 세션 비교 계약, 시간축·사진 품질 분리, 변경 근거·보류 | S1 평가 틀과 사용자 동의·보관 정책 별도 승인 |
| **S4 — 결과 UX / 모바일** | 근거·현재 행동·변화·보류가 이해되고 복구 가능한가? | Premium Skin 화면·상태·재진입·Android 수용 | S2·S3 안정화, 실제 화면/기기 인수 |
| **S5 — 실사용·릴리스 게이트** | 실제 사진·Human/보안·기존 추천과의 안전성이 증명됐는가? | 전반 인수 기록과 `PRODUCT_READY`/`RELEASE_READY` 분리 결정 | 실사진·독립 검수·보안/CI·개인정보·운영 승인 필요 |

**병렬 규칙:** S0·S2의 순수 로직 감사 및 S4의 비활성 UI 탐색은 실사진 수집과 병렬. 외부 증거가 부족하면 **해당 검증/승격 단계만 HOLD**하고 문서·합성 회귀 보강은 진행한다.

## 3. S0 — 현재 Skin Engine 전수 감사 (첫 작업)

1. **관찰 계약:** `vision-observation-contract`→정규화→`projectSkinObservation`에서 각 피부 축의 실제 입력, `status`, `confidence`, 사진 품질, `unknown` 의미를 표로 고정한다. 사진 품질/뷰 조건별로 “볼 수 있는 것”과 “볼 수 없는 것”을 명시한다.
2. **실제 점수 경로:** `skin-match-decision-engine-core.js`의 `applyPhotoWeights`와 설문·환경 점수를 추적한다. `skinAnalysisEligible` 조건만으로 사진 축의 **근거 없음/낮은 confidence/관찰 불가**가 0점 또는 음성 판정처럼 반영되는지 우선 조사한다. 이는 **검증할 의심 지점**이지 확정 결함이 아니다.
3. **canonical 증거:** `shared-skin-decision-context-v4`의 `photo/skinState/concernState/uncertaintyState/evidence-ledger`가 원래 근거를 훼손하지 않고, legacy/재진입에서 Unknown을 보존하는지 추적한다.
4. **정책 연결:** Functional/Routine/Condition/CrossDomainConsistency → effective bundle → Premium 표시까지 `HOLD`, `maintain/reduce/pause` 판단이 실제 증거와 연결되는지, 표시만 정상으로 바뀌는 경로가 없는지 조사한다.
5. **회귀 기준:** 현재 31개/462 assertion 평가 시나리오의 커버리지 매트릭스를 만들되 수치를 최신 실측 PASS로 간주하지 않는다. 빈 입력, 사진 없음, provider 실패, 피부 사진 부적격, 관찰-설문 충돌, 부분 confidence, 제품 미확인, 과다 기능성, 재진입, 비용/개인정보 경계를 보강 후보로 정리한다.
6. **산출물:** `docs/domain/facelab/`에 S0 감사 결과(실제 결과가 존재할 때만), S1 가설과 평가 데이터 요구 목록. 장애·재현이 확인되지 않은 항목은 `검증 필요`; 높은 위험의 정책 변경은 승인 대기.

**S0 DoD:** source/consumer/권위 소유자·입력 신호별 규칙·근거 부족 처리·현재 테스트 증거·P0/P1/별도 owner 항목과 첫 안전한 후속 PR을 명시. **보완 구현·정확도 수치를 꾸미지 않음.**

## 4. S1 — 사진 기반 상태 관찰 평가

- 축: **표면 광택, 들뜸·건조해 보이는 결, 눈에 띄는 국소 트러블, 모공 가시성, 붉어 보임, 톤 차이**. `barrier/dehydration/acne` 등의 내부 고민 축은 원인·진단 또는 기기 계측값과 같지 않음.
- 촬영 변인: 같은 사람 반복/다른 기기·노출·화이트밸런스·조명 방향·각도·해상도·메이크업/필터·가림. 하나의 좋은 사진에서만 PASS하지 않는다.
- 자료 권리: 독립 동의, 촬영·사용 범위·보유기간·철회·익명화/비공개 저장 정책이 승인되기 전 실제 얼굴 사진을 GitHub/CI/공개 문서에 넣지 않는다.
- 평가: 축별 전문가/합의된 주석과 **관찰 일치·오탐·미탐·보류율·재촬영 편차**를 기록. 의료 라벨/진단처럼 호칭하지 않는다.
- 결과: confidence가 낮거나 촬영 영향이 큰 상황에서는 해당 축을 판단 보류하고, 사진이 없는 설문-only 경로가 정상 동작해야 한다.

**S1 DoD:** 출처·동의가 있는 독립 평가 세트, 신호별 혼동/불일치 보고, 허위 확신 없는 보류 기준, 재현 가능한 평가 버전 및 실패 예시(개인정보 제외). 합성 fixture PASS만으로 완료 금지.

## 5. S2 — 설문·사진·제품 통합 및 대응 안전성

- 현재 규칙을 우선 검증: `redness/barrier/dehydration/acne/oiliness/pores/uneven_tone/uv`, 사용 제품 노출, 세안·민감·최근 변경·환경 부담.
- **우선순위 충돌:** 설문과 사진이 상반돼도 무조건 사진 우위/설문 우위로 뒤집지 않으며, 근거/상충/불확실성과 confidence ceiling을 유지.
- **원인 귀속 금지:** 제품 교체가 있었다는 사실만으로 트러블 원인을 특정 제품 탓으로 확정하지 않는다. 미확인 제품이나 빈 카탈로그가 이미 승인된 후보로 승격되지 않는다.
- **상황 대응:** 현재 루틴 점검, 기능성 조정, 악화 시 `maintain/reduce/pause_optional`, 보호 유지 등은 기존 정책을 재사용. 증거 없이 과도한 성분 추가·의학적 판단을 하지 않는다.
- 제품 추천 가중치/Top Pick 변경은 이번 Skin 로드맵 자체 승인 대상이 아니다. 필요하면 frozen #167 164상품×12상황 참고와 최신 exact-head 회귀를 별도 확인한다.

**S2 DoD:** 합성·경계/negative 검사 + 독립 리뷰 케이스에서 근거→판단→행동 추적 가능, 충돌·정보 부족시 안전한 보류, 기존 추천 불변성/저장 호환 PASS. 실사용 적합성은 별도.

## 6. S3 — 피부 변화 추적 / 반복 사진 비교

- **입력 구분:** 사진 간 신호 변화, 촬영 조건 변화, 설문상 체감 변화, 제품·루틴 변경을 서로 다른 기록으로 관리.
- **세션 authority:** 새 사진의 품질·기기·조건·관찰 가능 축·촬영 시점·현재 상태를 함께 비교. 사진 없는 세션, 품질 불일치, 메이크업/광원 변화가 크면 수치상 호전/악화를 단정하지 않는다.
- **정량화 원칙:** 원본 픽셀의 단순 RGB 차이·단일 AI 숫자 차이를 피부 개선의 확정치로 제시하지 않는다. 변화 표시에는 관찰 근거와 비교 가능 상태가 필수.
- **비저장 선행:** 우선 메모리·합성 fixtures로 `comparable / limited / not_comparable` 평가 계약을 설계. 얼굴 원본/crop/얼굴 특징·새 저장 schema나 장기 보관은 개인정보·DB/RLS owner 승인 전 **HOLD**.
- **리포트 동선:** 타임라인에서 유지할 것/바꿀 것/재촬영 요청을 구별, 이전 결정과 새 판단의 불일치·복구를 표시.

**S3 DoD:** 진짜 개선과 촬영 오차를 분리하는 평가 프로토콜 및 Human 검수, 안정된 권한·보관 경계, 동일 증거의 결정론적 재진입; 개인정보 저장 승인 전 실제 지속 저장을 완료로 보고하지 않음.

## 7. S4 — Premium Skin UX 및 실기기 인수

- Premium Full Report의 기존 **현재 루틴 점검 / 문제 추적 / 다음 변화 플랜 / 상황별 대응**과 Skin Track의 역할을 매핑한다. 새 UI가 기존 4섹터를 무단 교체하거나 Face Lab Style 허브를 침범하지 않는다.
- Skin 출력은 **지금 확인된 피부 신호 → 가장 중요한 판단/보류 → 유지/조정 행동 → 근거 펼쳐보기 → 다음 비교 기준** 순서로 전달하고, 상태가 불명확하면 확인 방법을 제시한다.
- `not_provided / unavailable / insufficient_evidence / ineligible / available`, 현재 제품 미확인, 저장·재진입 실패를 명시. `UNKNOWN/HOLD`를 UI에서 임의로 `SAFE/사용 가능`으로 변경하지 않는다.
- 브라우저·Android 양쪽의 촬영 화면, 사진 방향, 네트워크 실패, 접근성/다크모드, 320px 폭, 리포트 재진입·다른 계정 간 상태 분리를 검증.

**S4 DoD:** 사용자가 신호/불확실성/행동 근거를 이해하는지 실제 수용, 사용자 경로 브라우저/Android 회귀 PASS, 변경 없는 기존 Premium 4섹터와의 호환 확인.

## 8. S5 — 실사용 평가와 출시 판단

- **PRODUCT_READY:** S0–S4의 필수 UX·데이터 품질·판단 안전성과 실제 독립 검증 근거가 충족되고 치명적 미해결 오판 없음.
- **RELEASE_READY:** 별도로 보안·취약점·개인정보·서버 권한/로그/운영/비용·응답/저장 호환·롤백·필수 CI 게이트가 통과하고 승인됨.
- SCA 취약점 이슈 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)와 production DB/RLS/Provider/결제 권한은 다른 owner의 독립 게이트. 실패를 없애기 위해 예외 기한을 임의 연장하거나 차단을 해제하지 않는다.
- 실제 Human 평가/실기기/정확도 증거가 없는 개발용 PASS는 `EVIDENCE_PENDING`으로 남긴다. Style 트랙의 출시 준비도와 Skin 트랙의 준비도를 별도로 기록한다.

**S5 DoD:** source, exact HEAD, 검증 표본·판정자·측정 방법, 실패/개선의 정량 근거, 보안/개인정보 승인, rollback 및 운영 책임자 서명. 하나라도 핵심 외부 증거가 없으면 출시 HOLD.

## 9. 첫 실행 백로그 및 PR 규칙

| 우선 | 작업 | 실행권한 / 검증 경계 |
| --- | --- | --- |
| **Now S0-P0** | `applyPhotoWeights` 사진 신호 0/unknown·축별 confidence 반영 상태 추적 | **읽기 전용 감사**, 재현 없이는 결함 확정 금지 |
| **Now S0-P0** | Vision normalized `skin` → projector → v4 canonical → policy → 4섹터 UI 매핑 표 작성 | 읽기 전용, main/미병합 구분 |
| **Now S0-P1** | provider absent/failure, 조명/메이크업, 설문 충돌, 피부 단서 부족의 기존 verifier 커버리지 조사 | pure-fixture 보강안만, 실제 호출/저장 없음 |
| **Parallel S1-P1** | 동의/비식별·신호 축별 Human 평가 프로토콜 문서 설계 | 실제 사진 수집·보관 실행은 승인 전 HOLD |
| **Later S2/S3** | 근거 없는 정량화 차단과 이력 비교 계약·회귀 | API/DB/원본 저장/추천 승격 금지 |
| **After approval S4/S5** | 브라우저·Android 실제 사진 비교, 독립 평가, 보안·운영 수용 | 제품 및 릴리스 게이트 각각 별도 |

- **브랜치:** 신규 `face-lab/<type>-skin-<scope>-YYYYMMDD`, PR 제목 **`[Face Lab / Skin]`**. Style 마일스톤은 `[Face Lab / Style]`을 권장하되 기존 열려 있는 PR 브랜치는 임의 rename하지 않는다.
- **PR 단위:** S 단계 한 가지 주제, 변경 파일/HEAD, 증거/합성·실제 구분, negative case, 추천 불변성, SCA·운영 HOLD, 다음 gate를 문서화. 동일 Canonical context·Vision을 중복 구현하지 않는다.
- **중단:** 보안/DB/Auth/RLS/결제/개인정보/Provider/운영 쓰기나 정책 활성화가 필요한 순간, 승인 및 검증 준비가 될 때까지 **그 변경만** 중단.
- **검증 명령(로컬, 현행 파일 기준):** `node scripts/verify-unified-vision-pipeline.mjs`, `node scripts/verify-shared-skin-decision-context-v4.mjs`, `node scripts/verify-premium-integrated-evaluation-v2.mjs`. 실제 통과 여부는 PR exact-head CI/로컬 실행 결과로 별도 기록.

## 10. 확인 출처와 명시적 미확정

1. `main` 경로: `app/api/analyze/route.js`, `lib/server/vision-observation-service.js`, `lib/vision-observation-normalizer.js`, `lib/skin-observation-projector.js`, `lib/skin-match-decision-engine-core.js`, `lib/shared-skin-decision-context-v4.js`, `lib/premium-decision-state.js`.
2. `docs/architecture/skin-decision-engine-current-main-closeout-v1.md`, `docs/architecture/shared-skin-decision-context-v4.md`, `docs/architecture/premium-integrated-evaluation-pack-v2.md`, `docs/domain/facelab/unified-vision-observation-contract-v1.md`.
3. [Style 로드맵 #1277](https://github.com/gycha0109-beep/K_beauty/pull/1277)은 **미병합**. 사진 입력/Shared Vision은 공유하되 제품/마일스톤/품질 증거는 분리.
4. 실제 피부사진 데이터셋, 의료·전문가 주석의 신뢰도, 실사용 정확도 지표, 디바이스 반복 평가, 장기변화 관측, 운영 보관/권한 승인은 **현재 증거 미확보**. 이 로드맵의 목표이지 달성 결과가 아님.

**완료 보고 규칙:** `확인 완료 / 수정 필요 / 외부 실행·검증 필요`를 구분하고, 합성 PASS를 임상·사용자 정확도 PASS로 표현하지 않는다.
