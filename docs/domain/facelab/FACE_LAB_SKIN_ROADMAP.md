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

## 11. 2026-10-15 우선순위 갱신 — 사진 0점과 근거 없음의 분리 (S1-A → S2)

**설계 근거:** [축별 관찰 상태 설계 #1317](https://github.com/gycha0109-beep/K_beauty/pull/1317) — `docs/domain/facelab/face-lab-skin-axis-evidence-unknown-rfc-v1-20261015.md`. 실제 `main`에서는 Vision 계약이 불확실/누락도 `0`으로 변환하며, `applyPhotoWeights`는 사진 전체 적격성만 확인하고 개별 축의 confidence를 검사하지 않는다. #1308의 코드 경로 감사로 확인된 **P0**, 실제 사진 오판율/추천 변동 규모는 아직 미측정.

**기존 단계 배치:** S0 위험 감사 → **S1-A 관찰 상태 계약** → **S1-B 공용 Vision 응답 호환성 검증** → **S2-C 비노출 사진 점수 차이 비교** → S1-D 독립 사진 신뢰도 평가 → S2-E 추천·정책 안전성 승인 → S4/S5 실제 기기·제품 출시 근거. S3 추적과 S4 화면 작업은 이 상태를 '정상 피부'로 변환하지 않는다.

**2026-10-15 실제 작업 기록 (모두 별도 Draft PR·미병합, `main` 미적용)**

| 단계 | 제출한 작업 | 아직 끝나지 않은 부분 |
| --- | --- | --- |
| **S0** | [#1308](https://github.com/gycha0109-beep/K_beauty/pull/1308) 사진→판단 코드 감사 | 실제 사진 오판율/정책 영향 실증 |
| **S0→S2** | [#1309](https://github.com/gycha0109-beep/K_beauty/pull/1309) 분석 실패 표시·일부 일치 상태, [#1316](https://github.com/gycha0109-beep/K_beauty/pull/1316) 근거 없는 설문 충돌 표시 보수 | 병합 전 결과 비교 및 기존 저장 리포트 재진입 |
| **S1** | [#1310](https://github.com/gycha0109-beep/K_beauty/pull/1310) 피부 신호·사람 평가 계약, [#1317](https://github.com/gycha0109-beep/K_beauty/pull/1317) 0/unknown 분리 설계, **[#1319](https://github.com/gycha0109-beep/K_beauty/pull/1319) 평가 전용 상태·합성 회귀**, [#1323](https://github.com/gycha0109-beep/K_beauty/pull/1323) v2 단일 Vision 출력·Face 독립성 **합성 검사 PASS**, [#1326](https://github.com/gycha0109-beep/K_beauty/pull/1326) 출력 잘림·Face 비교·기존 Face 기준 부재 검증기(**최종 합성 Main Health/PIE PASS**), [#1328](https://github.com/gycha0109-beep/K_beauty/pull/1328) 비용·지연시간 합성 측정 평가 보강(단독 합성·Main Health·PIE PASS / 보안 #1208 별도 FAIL) | 실제 1회 Provider 응답 정확성/길이/비용, Style·Face 담당 검토, 독립 Human 평가 |
| **S2** | [#1312](https://github.com/gycha0109-beep/K_beauty/pull/1312) 판단 근거 추적, [#1322](https://github.com/gycha0109-beep/K_beauty/pull/1322) 실제 추천 엔진의 108쌍 비노출 합성 비교(첫 검증 PASS, 실제 사진 정확도 미확정) | 실사진·독립 정확도 검증, score-policy 승인, 공개 적용 |
| **S3** | [#1311](https://github.com/gycha0109-beep/K_beauty/pull/1311) 반복 사진 비교 계약 | 동의된 실제 반복 사진 및 개인정보/저장 권한 |
| **S4** | [#1313](https://github.com/gycha0109-beep/K_beauty/pull/1313) Android 저장 리포트의 사진 판단 상태 표시 | 모바일 종합 검사 기존 불일치, 실제 기기/접근성 인수 |
| **S5** | [#1314](https://github.com/gycha0109-beep/K_beauty/pull/1314) 제품·출시 조건을 별도 구분 | 보안 #1208, 사람 평가, 실기기, 저장/개인정보·운영 승인 |

위 표의 '제출'은 **코드 또는 설계 검토 가능**을 뜻하며, 제품 출시/실사진 정확도 또는 병합 완료가 아니다.

**S2-C 진행 기록:** #1322는 #1319 합성 관찰 계약 위에서 **실제 기존 추천 엔진**을 108쌍(9개 가상 사진 조건 × 12설문, 164개 상품)으로 두 번 호출해 사진 점수·고민 1순위·Top Pick·전제품 순위의 변경량을 측정한다. 실제 Provider/사진/저장/운영 적용은 없고, 최종 exact-head `3a7c35be556699c30d95e2ecdd82bedd429ee373` Main Health·PIE **PASS**: 108쌍 중 고민 1순위 10건, Top Pick 17건 변경(이중 의도적 정상 불가능 모순 시험 T09는 각각 3건·4건). **실제 정확도/개선 효과 수치로 전용 금지**. #1319가 미병합이므로 #1322는 기반 변경을 함께 포함한다. 중복 병합 금지.

**S1-B 다음 실제 제출물:** [#1323](https://github.com/gycha0109-beep/K_beauty/pull/1323)에 운영과 완전히 분리된 Skin v2 후보 프롬프트/버전별 변환기/Face v1 parity 및 malformed Skin 부정 사례를 작성했다. 이 작업은 **사진 모델이 실제로 새 형식을 안정적으로 출력한다는 증거는 아니다**. 최초 시험 HEAD `f05c4346d0e04879729781c6225eca91334a6686`에서 Main Health·PIE **PASS**(Face v1 결과 동등성 포함). 프롬프트 문자 +3,142, 최소 합성 Skin JSON +701로 **출력 길이/잘림 위험 확인**, 실제 토큰 수·Provider 실패율은 미측정. 현행 2,200 출력 토큰 제한과 한 번의 Provider 요청/Face·Style 품질/비용을 실제로 검증하려면 공동 소유자의 승인, 허가된 비공개 평가용 사진 및 측정 절차가 필요하다. #1323은 #1319에 쌓인 검토용이며 #1322와 병렬 의존 관계다. 사용자 추천/저장/배포 불변.

**S1-B 비용·지연시간 비저장 측정 사전검사 추가 (2026-10-15):** [#1328](https://github.com/gycha0109-beep/K_beauty/pull/1328)은 #1326 → #1323 → #1319 기반의 별도 Draft로, 기존 응답 구조/Face 품질 판정기를 복제하지 않고 **승인된 시험에서 얻을 v1/v2 소요 시간·비용 추정값**을 가명 case ID와 숫자만으로 모아 비교하는 독립 평가 모듈을 추가했다. 비용·응답시간 미측정, 짝 누락, 중복, 비정상 값, 원본/URL 등 비허용 입력은 보류 또는 거절. `scripts/verify-current-main-health.mjs`에 합성 verifier를 연결함. 직접 로컬 합성 검사 **PASS**. PR HEAD `554c0c25d95814fafc069ca5d533d8bafde9a953`의 전체 Main Health [#38686695750](https://github.com/gycha0109-beep/K_beauty/actions/runs/38686695750) **PASS**, PIE [#38686696166](https://github.com/gycha0109-beep/K_beauty/actions/runs/38686696166) **PASS**, CodeQL **PASS**. Supply Chain Security [#38686695763](https://github.com/gycha0109-beep/K_beauty/actions/runs/38686695763) **FAIL**은 기존 #1208의 `braces@3.0.3` 예외 만료(2026-10-10)이며 신규 Skin 코드와 독립. 전체 검증은 해당 exact HEAD에 근거함. 산출된 측정 수치는 모두 synthetic/수기 추정일 수 있어 실제 Provider 안정성·비용·Human 정확도 또는 사용자 품질의 증거가 아니다. 실제 호출·사진 전송·추천/Style/운영 변경 **0건**, 실제 비용·시간 표본은 여전히 **EVIDENCE_PENDING**. [S1-B 운영 메타데이터 문서](https://github.com/gycha0109-beep/K_beauty/blob/face-lab/research-skin-s1b-operational-metrics-20261015/docs/domain/facelab/face-lab-skin-s1b-operational-metrics-preflight-20261015.md) 참조. 보안 #1208, S1-D/S2-E, S4/S5 게이트는 계속 HOLD. 의존 PR 개별 중복 병합 금지.

**S1-B 평가기 최종 확인:** #1326 exact-head `6d48d5e5a2622f7c6d686c67bc84e629b617d6a6`에서 [전체 기본 검사](https://github.com/gycha0109-beep/K_beauty/actions/runs/38669748024) **PASS**, [PIE](https://github.com/gycha0109-beep/K_beauty/actions/runs/38669748286) **PASS**. 단일 축 누락/중복 및 출력 2,200토큰 한도 종료·완료 사유·사용량 누락·Face 품질 저하, **기준 Face 자체가 관찰 불가능한 경우 비교 PASS 금지**를 합성 JSON으로 검증했다. 기존 고정 추천 164제품×12상황 및 Premium 31변형·462검사도 PASS. 이는 **실제 모델 응답의 성공률이나 정확도가 아닌 시험 도구의 통과**다. 보안 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) 별도 FAIL, 운영·실사진·점수 적용 승인 전 HOLD.

**S1-B 다음 검증 보강:** [#1326](https://github.com/gycha0109-beep/K_beauty/pull/1326)은 기존 #1323 합성 후보에 **Provider 응답 종료 사유(`finish_reason=length`), 실제 사용량(`completion_tokens`), 2,200토큰 상한, 같은 허가 시험 케이스의 v1/v2 Face 관찰 항목 감소**를 구분하는 평가기를 추가했다. 합성 시험 검증 후에도 **실제 사진 모델의 안정성/성능을 입증한 것으로 승격하지 않는다**. 개인 사진이나 원본 모델 응답은 GitHub/CI에 남기지 않으며, 동의된 비공개 시범 시험·공동 Vision/Style 담당 검토·응답 길이/실측 비용이 있어야 다음 단계로 진행한다. #1326은 #1323 → #1319 위에 놓인 검토용 코드이며 #1322와 별도 경로다. 운영 Provider·점수/추천·저장/개인정보는 불변.

**S1-B 사전 위험 확인:** 기존 공용 Provider의 기본 출력 한도는 2,200 tokens이고, 미지원 v2 버전/전체 형식 오류 시 Skin뿐 아니라 Face 관찰도 함께 실패할 수 있다. 따라서 새 Skin 증거를 운영 응답에 끼워 넣기 전에 v1/v2 병행 처리·축별 오류 분리·Face/Style 보존·응답 길이/비용 시험이 필요하다. [#1317 설계 8절](https://github.com/gycha0109-beep/K_beauty/pull/1317)에 근거 경로를 정리했다. **실제 v2 배포·Provider 요청 변경은 HOLD.**

**#1319 검증 기록:** 실제 PR HEAD에서 새 축별 계약/음성 사례 검사 **PASS**, `BEJEWELY Current Main Health` **PASS**, 기존 고정 추천 **164상품×12조건 PASS**, Premium 통합 평가 **31변형·462검사 PASS**, `PIE Prospective Shadow` **PASS**. 이 통과는 synthetic/기존 엔진 보존 확인이며 새로운 사진 추론 정확도를 증명하지 않는다. `Supply Chain Security`의 패키지 취약점 검사는 별도 실패(#1208)로 계속 차단; 실사진 검증·Style/공유 Provider 승인·릴리스도 HOLD.


| 순서 | 작업과 검증 결과물 | 상태 | 다음 게이트 |
| --- | --- | --- | --- |
| **A / Now** | 7개 가시 축 `present(1~5)` / `not_seen(0)` / `unassessable(null)` / `unknown(null)`; confidence/cue/area/reason, 빠진 축·중복·잘못된 값·상충 단서의 거부 또는 보류, 합성 회귀. **서비스 계산·전송·저장 불변** | **S1-A 합성 검사 PASS** — #1317 설계 + #1319 평가 전용 구현, #1319 exact-head `4dae35659e4234e235d848ab4d53c09fb042cbe0` Main Health PASS; 실제 사진 정확도/운영 적용 HOLD | 축별 negative 검사 PASS, v1의 0 소급 복원 금지, Provider 호출 0건 |
| **B / Next** | 공유 단일 Vision 응답에 명시적 `vision-observation-v2` Skin 계약 추가하는 호환 설계/평가. Style/Face 응답과 기존 1회 Provider 경계 보존 | **S1-B 합성 응답 평가기 #1326 최종 HEAD 검증 PASS / 실제 Provider·Human HOLD** — #1323 Main Health/PIE PASS, Skin v2 7축·v1 보존·Face 독립성 확인; #1326 실제 응답 완결성 판정기 합성 검증 추가. 프롬프트 +3,142자·최소 합성 Skin JSON +701자, 실제 2,200-token 출력 한도 안정성 미검증. Provider·Style 검토와 실제 사진 평가 필요 | 응답 형식·안정성·비용·결측 처리 및 Style 영향 검토 |
| **C / Next** | 동일 1회 사진 관찰을 입력으로 기존 결과 vs 축별 관찰 증거가 충분할 때만 가산하는 **비노출** 대안 비교 | **S2-C 합성 비교 PASS** — #1322 최종 HEAD `3a7c35be556699c30d95e2ecdd82bedd429ee373`에서 전체 Main Health/PIE PASS. 164상품×12설문×9합성 사진=108쌍 중 고민 1순위 10건·Top Pick 17건 변화 관찰. 실사진 정확도·운영 적용 HOLD | 164상품 × 12상황 frozen 검증, priority/Top Pick/점수별 차이와 원인 문서화. 기본 운영 결과 불변 |
| **D / Later** | 동의된 실제 사진을 사람이 독립 검수해 축별 오탐·미탐·보류·촬영 조건 편차와 판단자 의견 차이 측정 | **HOLD: 개인정보·실사진 평가 승인** | 신뢰도 경계값/판단 안전성 근거 확보, 합성 PASS를 정확도 PASS로 간주 금지 |
| **E / Last** | 실제 가산 규칙·저장/재진입·UX 활성화와 복귀 계획 | **HOLD: 별도 score/privacy/owner 승인 및 S5** | 과거 결과 재계산 금지, 출시 보안 #1208 별도 해결 |

**항목별 지켜야 할 의미**
- `not_seen`은 충분한 사진과 신뢰할 수 있는 가시성 근거가 있는 **시각적 무단서**일 뿐, 임상적 정상/질환 없음이 아니다.
- `unassessable/unknown`을 0점으로 강제하거나 설문과의 **conflict**, 사진 기반 **안전/정상**으로 승격하지 않는다. 사진 실패/입력 부적격이면 최상위 실패를 우선한다.
- 사진 직접 관찰 단서가 없는 `uv`는 새 축별 사진 증거에서 제외하고, 기존 설문/환경/자외선 차단제 정책은 그대로 둔다. 사진 UV 가중치의 실제 변경은 E 이전 **별도 영향 승인**이 필요하다.
- 과거 `vision-observation-v1`에서 0이 무엇을 의미했는지 **알 수 없다**. 기존 저장 기록과 추천을 소급 변경하지 않는다.
- #1309/#1316 안전한 사진 상태·설문 충돌 수정은 **미병합**이며 새 계약보다 먼저 적용됐다고 전제하지 않는다. 새로운 구현은 독립 브랜치와 별도 Draft PR로 관리한다.

**2026-10-15 S1-D 비공개 사진 입력 준비:** [Draft #1332](https://github.com/gycha0109-beep/K_beauty/pull/1332)는 사용자 제공 사진 **5장의 로컬 헤더 검증**(5/5 JPEG 파싱, TC-03 짧은 변 273px) 후 개인정보를 내보내지 않는 독립 S1 사진 입력 게이트·합성 음성 검사를 추가했다. TC-05 전체 프레임의 밝기 값 <45/255 비율 약 86.8%는 피부 마스크/정확도 판정이 아님. 사진 원본·파일명은 PR/CI에 미포함; 실제 Provider 0건, 독립 Human 0건, 권리·외부전송 승인 미확인. #1310 Human 단서 평가기는 계속 별도 미병합이며 실사진 정확도·제품 준비도는 HOLD. #1332는 main 기반 독립 Draft, 추천/Score/Style/Provider/DB/운영 불변. Exact HEAD `6758ce10a9439031ee0f7062b78d72c9d478228c`: Main Health #38698604951 **PASS**, PIE #38698605800 **PASS**, CodeQL **PASS**, Supply Chain #38698604979 **FAIL**(기존 #1208 `braces` 예외 만료; 예외 변경 없음).

**2026-10-15 S1-B 시험용 키 사용 실증:** 사용자가 `gycha0109-beep/K_beauty` GitHub Actions **Repository Secret**에 `OPENAI_API_KEY2`를 등록했고 임시 연구용 키로 지정했다. [Draft #1334](https://github.com/gycha0109-beep/K_beauty/pull/1334)는 이 키만 읽고 운영 `OPENAI_API_KEY`로 대체하지 않는 **문자열 합성 연결 검사**를 구현했다. GitHub Actions [#38702440175](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702440175) 및 [#38702819285](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702819285)에서 실제 OpenAI Provider **총 2회 텍스트 호출 성공**(각 38 입력/13 출력 tokens, HTTP 200, `finish_reason=stop`, 모델 `gpt-5.6-luna`). 임시 시크릿 사용 워크플로는 실행 후 삭제했고 CI 인벤토리 정책을 변경하지 않았다. 최종 #1334 HEAD `f8930ff268c97ce36d0f295384bdb134e0eead8e` [Main Health #38703269444](https://github.com/gycha0109-beep/K_beauty/actions/runs/38703269444) **PASS**, [PIE #38703269764](https://github.com/gycha0109-beep/K_beauty/actions/runs/38703269764) **PASS**. 실사진·피부 판독 정확도 증거 아님.

**2026-10-15 S1-B 같은 합성 비인물 사진 v1/v2 실호출:** [Draft #1336](https://github.com/gycha0109-beep/K_beauty/pull/1336)은 #1328 → #1326 → #1323 → #1319의 **미병합 의존 스택**에 놓인 연구 PR이다. 개인정보가 없는 메모리 생성 **96×96 비인물 RGB 격자**에 대해 동일한 `OPENAI_API_KEY2`로 v1/v2 프롬프트를 한 번씩 호출했다([Actions #38704168643](https://github.com/gycha0109-beep/K_beauty/actions/runs/38704168643) **SUCCESS**). v1 **2,769 입력/875 출력 tokens, 8,251ms**, v2 **3,529 입력/1,615 출력 tokens, 12,444ms**. 양쪽 모두 JSON 파싱·`finish_reason=stop`이며 2,200 출력 한도 이내. v2는 한 사례에서 출력 +740 tokens, 소요시간 +4,193ms이지만 **1쌍 비인물 시험**으로 비용/분포/피부 정확도를 대표하지 않는다. v2의 기존 eligible-photo 게이트 `INVALID_OR_INCOMPLETE`는 `skinStatus=blocked`에서 발생했다. 비인물 적격성 차단은 정상일 수 있으므로 실제 얼굴 v2 오류라고 판단하지 않으며, 원문을 저장하지 않은 이 실행으로 **실제 반환 7축 완전성은 미확정**이다. 추후 평가기에 적격성/보류 구분과 반환 축 개수 메타데이터를 추가했지만 추가 API 호출은 없었다. 일회성 유료 실행 워크플로는 삭제. 최종 HEAD `e2ef585811b9147e9eaac4e07bcaa278c29aeb36`: [Main Health #38704750418](https://github.com/gycha0109-beep/K_beauty/actions/runs/38704750418) **PASS**, [PIE #38704751072](https://github.com/gycha0109-beep/K_beauty/actions/runs/38704751072) **PASS**, CodeQL **PASS**; Supply Chain #38704750457 **FAIL**은 기존 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) 취약점 예외 만료와 독립. GitHub 전체 테스트 호출은 **문자열 2회 + 비인물 이미지 2회**이며 제공받은 실제 **얼굴 사진은 Provider로 0장 전송**. 독립 Human·실인물 Face parity·보안/S5 승인 없이는 S1-D/제품/릴리스 **HOLD**.

**2026-10-15 S1-B 비인물 v2 계약 충돌 보수 및 실호출 재검증:** [Draft #1336](https://github.com/gycha0109-beep/K_beauty/pull/1336)에서 연구용 v2 후보의 **'항상 7축' vs '분석 부적격이면 빈 배열'** 충돌을 발견했다. **Skin 적격이면 7개 축 / Skin 부적격이면 `skin.axisEvidence: []`**로 우선 연구용 프롬프트를 명시했고, 실제 Provider 결과에서 적격성에 의해 축 판정이 숨겨지기 전에 별도 원문 비저장·메타데이터만 검증하는 `skin-nonface-v2-abstention-audit.mjs`를 추가했다. 비인물 사진에 `present` 또는 `not_seen(0)`가 반환되면 실패로 차단하며, 중복/누락 축·초과 입력/개인정보 필드를 부정 합성 사례로 검증한다. 이 변경은 **공용 Vision/Style 담당 승인 전 미병합 연구 계약**이며 운영 프롬프트·추천은 수정하지 않았다. [KEY2 실제 비인물 재시험 #38707623100](https://github.com/gycha0109-beep/K_beauty/actions/runs/38707623100) **성공**: 동일 96×96 합성 격자에서 v1 입력/출력 2,769/1,418 tokens·11,076ms, 후보 v2 3,634/1,240 tokens·8,699ms. 양쪽 `finish_reason=stop`, `ineligible`, v2 **반환 축 0개**, 근거 없는 긍정/0 신호 **0개**, 신규 별도 보류 감사 `EXPECTED_INELIGIBLE_EMPTY_AXES_RESEARCH_ONLY`. 기존 적격 사진용 v2 구조 게이트 `INVALID_OR_INCOMPLETE`는 비인물 관찰 차단으로 인해 유지되며 **사람 얼굴 v2 실패라고 결론내리지 않는다**. 최초 합성 사진 v1 출력을 포함해 전후 모델 사용량·지연시간에 변동이 있어 **비용·성능 개선 주장 불가**. 임시 유료 트리거 workflow는 재검증 후 삭제, 최종 Draft PR에는 해당 파일 없음. 사용한 API 요청 누계 텍스트 2회 + 비인물 이미지 4회, **실제 얼굴 사진 전송 0건**, S1-D 사람 정확도/Face parity/Human/소유자 승인 및 #1208/S5 **HOLD**. 최종 #1336 HEAD 코드 CI 및 로드맵 자체 CI는 개별 exact SHA로 재확인한다.

**2026-10-16 S1-D 실제 5장 국소 검사 및 권리 게이트:** [Draft #1332](https://github.com/gycha0109-beep/K_beauty/pull/1332)에 TC-01~TC-05 사진의 익명 메타데이터 기반 권리·당사자 동의·외부 AI 제공·보관·철회·검수 항목을 fail-closed로 검사하는 도구와 합성 부정 테스트를 추가했다. 로컬 JPEG 5장 검사 완료, TC-03 짧은 변 273px, TC-04 얼굴 일부, TC-05 전체 픽셀 약 86.79%가 gray<45/255. 이는 **품질 참고치**이지 피부 정확도 근거가 아니다. 로컬 기록상 권한 미확인 5/5, **실제 얼굴 Provider 전송 0장, 독립 평가 0장**. 선언 입력은 실제 동의 확인을 대신하지 못하므로 코드의 Provider 실행 승인은 고정 `false`. 기존 `OPENAI_API_KEY2` GitHub Secret으로 실제 사진을 GitHub Actions에 올리지 않는다. 실제 사람 v1/v2·정확도·보관/권리 검증은 HOLD.

**2026-10-16 S2-E 추천 점수 안전성 합성 비교:** [Draft #1339](https://github.com/gycha0109-beep/K_beauty/pull/1339)는 #1322 기반 미병합 스택으로, 현행 **164개 제품 × 12개 설문 × 10개 합성 사진 조건**의 **120쌍**을 기존 추천 엔진 그대로 비교했다. [Main Health #38832800571](https://github.com/gycha0109-beep/K_beauty/actions/runs/38832800571) **PASS**: 보수적 가상 사진 근거 필터로 사진 가산점이 줄어든 96쌍 중 고민 1순위 17쌍, Top Pick 28쌍, Top 3 순위 36쌍, 전체 순위 84쌍 변동. 두 통제 조건은 12쌍씩 변화 0. 설문/환경 점수 보존, 사진 가산 비증가, 164개 후보 집합 보존을 검증했으며 **추천 규칙 자체는 변경하지 않았다**. 이는 인위적인 극단 입력에 대한 **민감도**로 실사용 오류율/개선율/서비스 적용 근거 아님. [PIE #38832801098](https://github.com/gycha0109-beep/K_beauty/actions/runs/38832801098) **PASS**, CodeQL **PASS**; [Supply Chain #38832800598](https://github.com/gycha0109-beep/K_beauty/actions/runs/38832800598) **FAIL**은 기존 `node-forge` 임시 보안 예외 `GHSA-86w9-cpqp-85rv`의 2026-10-16 만료 때문이며 우회하지 않는다. S2-E 운영 score/Top Pick 승인·S5는 HOLD.

**2026-10-16 S1-D 사용 승인 확인과 비공개 v1/v2 실행 도구:** 사용자가 현재 대화에서 사진 5장의 **사용권한·사진 속 인물 허가·OpenAI API 외부 전송 동의**를 모두 긍정했다. 로컬 전용 비공개 manifest에 해당 사실을 `user_attested`로 기록했으나, 이는 별도 동의 원본문서 검증이나 독립 Human 판정 완료는 아니다. 5/5 원본 JPEG 디코딩 및 메타데이터 제거 후 디코딩을 로컬에서 확인했고, 한 사진(TC-01)의 COMMENT 세그먼트 1개(33 bytes)만 메모리상 제거해도 해상도·디코딩 유지됐다. GitHub에는 **사진·사진 파일명·원문 응답을 넣지 않았다**. [Draft #1340](https://github.com/gycha0109-beep/K_beauty/pull/1340)은 #1336 기반 스택으로 **사람 얼굴을 GitHub Actions에 보내지 않는 비공개 전용 실행기**, 전체 5장 입력 검사 이후에만 시작하는 **v1/v2 사진당 1회, 최대 10회 KEY2-only 호출 제한**, 2,200-token cap, Face 상태/필드·Skin 7축·적격성 메타데이터 감사, raw 데이터 미저장, CI/GitHub Actions 실행 거부와 합성 fixture verifier를 준비했다. **현재 세션에는 `OPENAI_API_KEY2`가 주입되지 않고 GitHub Actions Repository Secret만 존재**하므로 실제 얼굴 Provider 요청 **0건**, S1-D v1/v2 실측 정확도·Face parity **미실행**; 사용자에게 API 키 값을 채팅으로 요구하거나 GitHub Actions를 통해 얼굴을 전달하지 않는다. 검증 전 Draft·미병합, 실제 Human·S2-E 점수 활성화·보안/S5는 계속 HOLD.

**2026-10-16 S1-D 비공개 실인물 평가기 추가 강화:** [Draft #1340](https://github.com/gycha0109-beep/K_beauty/pull/1340)에서 두 추가 위험을 차단했다. (1) 다른 파일명·caseId여도 사진 메타데이터 제거 후 내용이 동일하면 사전 검사 단계에서 **호출 0회로 중단**(SHA-256은 개인 실행 메모리에서만 비교, 미출력·미저장), (2) 전달된 환경 객체뿐 아니라 **실제 CI 프로세스 환경까지** 확인해 GitHub Actions 및 다수의 다른 CI에서 실제 OpenAI 호출을 거부한다. 로컬에서 실제 JPEG 5장의 정리 후 내용이 모두 다름을 확인했다(5/5, 파일·해시·얼굴 데이터 외부 유출 없음). 후속 독립 Human 검수의 비교 대상으로만 사용할 수 있는 **v1 7축 legacy numeric(0은 부재 의미 미검증) / v2 7축 closed enum state·score·confidence**를 비공개 결과에 제한적으로 추가했다. 자유 서술·사진 내용·원문 Provider 응답·파일명은 반환하지 않으며 평가 정답/의료판단을 생성하지 않는다. #1340 exact HEAD `778abdf71451068a6521f1e566c969929882c951`: [Main Health #38844563412](https://github.com/gycha0109-beep/K_beauty/actions/runs/38844563412) **PASS**, [PIE #38844563649](https://github.com/gycha0109-beep/K_beauty/actions/runs/38844563649) **PASS**, 보안 SCA는 기존 node-forge 임시예외 `GHSA-86w9-cpqp-85rv` 만료로 별도 FAIL. **실제 얼굴 API 호출 0/10, S1-D 피부 정확도·독립 Human·S2-E 운영 추천·S5 HOLD.** GitHub Repository Secret `OPENAI_API_KEY2`를 별도 비공개 실행 환경으로 안전하게 주입할 수 없어 실인물 실측을 완료했다고 주장하지 않는다.

**2026-10-16 S1-D 실인물 v1/v2 비공개 실측 (KEY2 10회) — 첫 Human Provider 결과:** 사용자는 독립 비공개 Windows 실행기에서 원본 KEY2를 직접 입력하여 **실제 얼굴 사진 5장에 각각 v1·v2 한 번씩 총 10회** 호출하고, GitHub가 아닌 현재 대화에 제한된 `skin-private-v1v2-cohort-v1` 메타데이터 JSON을 전달했다. 전 건 `finish_reason=stop`, `responseComplete=true`, 길이 잘림 **0**; v1 구조 **5/5 PASS**. v2 기존 구조 게이트 **1/5 PASS, 4/5 INVALID**였으나 이 집계에는 **Skin 적격 사진의 7축 계약 오류 3건**과 **Skin 부적격 사진의 올바른 0축 보류 1건**이 혼합되어 있다. 적격 v2 4장 전부 7축을 반환했고, 그중 `not_seen` 원시 상태 **8건 전부** 명시적 축 계약 검사에서는 `unknown`으로 무효화됐다. 보고서는 개인정보 보호를 위해 원시 `cue/area/reason`을 버렸으므로 **구체적인 위반 필드는 확정할 수 없다**. Face 상태·필드 수 감소 **0/5**, 실제 Face 관찰값 동등성이나 Human 정답은 미검증. v2 출력 1건 **1991/2200 tokens(90% 경계 주의)**. 총 사용 토큰 v1 입력/출력 **15,516/7,073**, v2 **19,841/8,924**; 순차 5장 소규모 시험의 응답 길이·지연 차이를 품질·속도 개선으로 일반화하지 않는다. [Draft #1340](https://github.com/gycha0109-beep/K_beauty/pull/1340)에 신뢰 가능한 ineligible/empty-array를 적격 계약 결함과 별도 집계하는 **research-only 분류** 및 `not_seen` 목표 cue/관찰 area/`reason=none` 요구를 명확히 한 실험 v2 프롬프트와 합성 검증 추가. **실인물 재시험 없이 고쳤다고 판단 금지**, 실측상 v2 전체 승인 FAIL/HOLD, 독립 2인 Human 평가·Face 값/Style parity·near-token-cap 재검증·운영 점수 정책 승인 모두 HOLD. 실제 얼굴·파일명·비밀키·Provider 원문·개별 7축 점수를 GitHub에 업로드하지 않음. 자세한 합계는 [S1-D 메타데이터 감사](https://github.com/gycha0109-beep/K_beauty/blob/face-lab/research-skin-private-v1v2-runner-20261016/docs/domain/facelab/face-lab-skin-s1d-consented-private-v1v2-real-metadata-audit-20261016.md)에 기록. 기존 `node-forge` 보안 예외 만료/HOLD도 유지.

**2026-10-16 S1-D 10회 실인물 실측 이후 자동 진행(재시험 비용 최소화):** [Draft #1340](https://github.com/gycha0109-beep/K_beauty/pull/1340)에서 기존 실인물 v2 적격 3건의 계약 실패 원인 `cue/area/reason`을 **다음 비공개 실행 시에만** 정확한 enum 실패 코드로 분리하는 진단기를 구현했다. 사용자 얼굴·근거 자유서술·파일명·API 키·Provider 원문을 출력하지 않고 기존 strict validator와 불일치하면 HOLD한다. 수정된 v2 후보만 사진당 1회 **총 최대 5회** KEY2로 실행하는 `--live-private-v2-only` 경로를 추가했고, v1은 재호출하지 않는다. 기존 10회 JSON과 이후 5회 JSON을 **로컬 비공개**에서 비교하는 aggregate-only 검증기가 준비됐으며, `not_seen` 무효화 수·7축 구조·Skin 적격성 변화·Face 상태/필드 감소·near-cap만 요약한다. 이 비교는 **원본 사진 동일성, Face 관찰값 동등성, 독립 Human 정답을 보장하지 않고** 운영 점수/배포 승인에 사용 불가하다. 연구 구현 exact HEAD `5095560a4973a60497377774769fbd9463c2d75a`: [Main Health #38856305859](https://github.com/gycha0109-beep/K_beauty/actions/runs/38856305859) **PASS**(합성 5회 제한/진단/집계 검증 포함), [PIE #38856306118](https://github.com/gycha0109-beep/K_beauty/actions/runs/38856306118) **PASS**, CodeQL **PASS**, 기존 node-forge `GHSA-86w9-cpqp-85rv` 예외 만료로 SCA는 계속 FAIL/HOLD. 원래 ZIP 폴더에 추가하는 Windows 전용 실행 스크립트(CMD/PS1, **사진 없음**)를 비공개 파일로 준비했으나 **Windows 실제 재실행 및 새 API 호출 0회**. 다음 사용자 동작은 로컬에서 별도 유료 **RUN5** 승인과 마스킹 KEY2 입력뿐이며, 수정 v2가 실측에서 통과한다는 보증은 없다. 모든 PR Draft·미병합, 운영 Provider/Face/Style/추천 점수/DB/릴리스 불변.

**2026-10-16 S1-D v2-only 첫 호출 오류 및 1회 진단 경로:** 사용자가 제공한 **비공개 metadata-only** 보고서에서 수정 v2 실인물 시험은 첫 요청 **1/5회** 후 `HOLD_INCOMPLETE_PROVIDER_DATA`, `provider_response_invalid`로 중단됐다. 나머지 4장은 **전송되지 않음**. 기존 OpenAI shared transport의 이 오류는 **HTTP 성공·비어 있지 않은 응답 이후**, 외부 envelope JSON 또는 내부 모델 content JSON 처리 실패를 함께 뜻하므로 **2,200 토큰 잘림 여부를 이 결과만으로 확정 불가**. 해당 실패를 다시 5회 호출하며 재현하지 않도록 [Draft #1340](https://github.com/gycha0109-beep/K_beauty/pull/1340)에서 별도 비공개 응답 파서에 원문 저장 없는 `finish_reason`·`completion_tokens`·`nearTokenCap` 제한 진단을 추가하고, **첫 사례 1회만** 테스트하는 `--live-private-v2-probe-one`을 구현했다. 전체 5장 사전검사는 유지하지만 유료 호출은 KEY2로 **최대 1회**이며, 허용된 로컬 사용자 승인 없이는 0회. 새 진단용 Windows 풀패키지는 기존 사진 5장·이전 10회 비교 결과·실패 메타데이터를 **로컬 ZIP**에만 포함하고, 이전 10/5회 실행기 없이 1회 CMD만 제공한다. 구현 SHA `e742296949348346530aaa1dea5b38a5d6c8b8ce`: Main Health/PIE/CodeQL **PASS**, SCA는 기존 만료된 `node-forge` 보안 예외로 계속 **FAIL**. 현재 **새 실제 재호출 0회**(기존 사용자 1회 오류는 이미 기록), Windows 실행 미확인, v2 품질·Human 라벨·Face 값 동등성·점수/배포 **HOLD**. 다음 사용자 동작은 해당 새 ZIP에서 의도적으로 **1회 유료 진단 승인** 후 생성된 메타데이터만 전달하는 것.

**작업 중단 경계:** 공유 Provider 계약, 실제 점수/ranking/Top Pick, API 공개 형태, DB/Auth/RLS/Storage, 개인정보·실사진, Style, 배포 변경이 필요한 순간 해당 단계만 HOLD. 문서·합성 계약/검사는 계속 가능하다.

---

**완료 보고 규칙:** `확인 완료 / 수정 필요 / 외부 실행·검증 필요`를 구분하고, 합성 PASS를 임상·사용자 정확도 PASS로 표현하지 않는다.

## 2026-10-16 S1-D continuation checkpoint (cross-PR, NOT merged)

- [#1340](https://github.com/gycha0109-beep/K_beauty/pull/1340) remains a **Draft independent research branch**, outside `main` and outside this roadmap PR. The operator-supplied local TC-01 corrected v2 one-call probe showed **7/7 structural axis contract PASS** including 4 valid `not_seen` and **Face 19 available fields**. Token use was **1,972/2,200** with only 228 headroom; actual Skin cue truth and Face value equality are **NOT** established.
- **Implementation on #1340:** mandatory successful TC-01 probe metadata gate; five-photo preflight; exactly TC-02~TC-05 v2 continuation (maximum four KEY2 attempts, no v1, no TC-01, no retry); local-only 1+4 metadata merge; strict schema/study/case/diagnostic checks; 10-call historical aggregate comparison; private Windows launcher with explicit authorization and attempted-run lock; synthetic-only regression test.
- **Evidence still due:** actual revised-v2 TC-02~TC-05 KEY2 four-call completion by the local operator, private merge and aggregate comparison, independent two-blinded-reviewer Human reference with consent/governance. No inferred physical photo identity from dimensions alone. Legacy v1 zero remains unverifiable.
- **P4 output budget:** TC-01 is just 8 tokens below the 90% cap warning; do not raise 2,200 or quietly shorten Skin cue/Face requirements. Preserve frozen candidate prompt for the 4 remaining trial cases; conduct output-size optimization on a separate synthetic branch after the cohort.
- **Release gates:** Human truth **HOLD**, recommendation score/Top Pick **HOLD**, Face/Style semantic parity **HOLD**, release/merge/deployment **HOLD**; expired `node-forge` supply-chain exception remains independent security **HOLD**.
- **Evidence distinction:** #1340 synthetic CI PASS (when confirmed at exact head) validates software behavior only; TC-01 probe is real Provider **structure** evidence only; neither is S1 real-person accuracy graduation.

Watchtower-Track: face-lab-skin

## 2026-10-17 S1-D four-case structural closeout (private operator evidence, not model accuracy)

> **Scope:** private study `FACE_LAB_5PHOTO_CONSENTED_PRIVATE_20261016`, **TC-01..TC-04 only**; the user-designated intentional Skin-ineligible TC-05 is excluded from the *normal-path* denominator. Existing TC-05 `provider_output_truncated` remains an observed failed attempt, not a PASS or erased run. This update records **metadata-only aggregate facts**, not source images, per-person scores, filenames, raw Provider output or keys. PR remains Draft.

- Private historical v2 Skin seven-axis contract: **1/4 PASS** for eligible normal-path cases; corrected v2: **4/4 PASS**, **28/28 axis diagnostics valid**. This is **structural contract** evidence only; no independently measured visible-cue accuracy, physiological skin truth or clinical meaning.
- Corrected v2 across four cases: **17 `present` / 10 `not_seen` / 1 `unassessable` / 0 `unknown`**. Prior normalized v2 values include `unknown` due to invalidated `not_seen`; those do not represent proven absent cues. Eight bounded raw axis rows changed in state, score or confidence across runs. No claim is made that changed rows are more accurate without independent Human reference.
- Corrected v2 Face *availability/count* preserved for **TC-01..TC-03** (19 returned fields each), while **TC-04** changed from `partial/14` to `unavailable/0`. The partial-face capture makes abstention plausible and possibly conservative, but **cannot establish Face semantic value parity nor root-cause certainty**. Keep this a research observation and check whether the Face eligibility policy matches intended behavior; do not silently label as either bug or proven improvement.
- Recorded local continuation **attempted four KEY2 calls** for TC-02..TC-05: TC-02..04 complete `stop`, TC-05 incomplete with `finishReason=length` at **2,200/2,200 output tokens**. Successful independent TC-01 corrected probe is reused. No further paid calls or automatic retry authorized; attempt lock retained. This documentation change uses **0 Provider calls**.
- **S1-D normal-path structural sub-study CLOSED** by operator-provided verification summary; **S1 independent Human cue accuracy / two blind reviewers / capture repeatability remains HOLD**. Closing a scoped structural sub-study is not completing S1 overall. Independent evaluation must use separate consent/permissions for any reviewer sharing and avoid identifying data in commits/CI.
- **Next permitted work:** reuse existing evaluation-only #1310 cue metrics + inter-rater agreement, prepare an import/validation bridge for the four corrected-v2 case metadata and two independently collected reviewer labels, run synthetic negative checks locally and CI, and report coverage/disagreement/accuracy only after Human labels are supplied. Never infer `reference` from model output. This may proceed without Provider, image persistence, scoring activation, merge or deploy.
- **S2-E / S3 / S4 / S5:** existing synthetic research remains reviewable in parallel; real-photo recommendation scoring, Top Pick, Face/Style model changes, operational Provider prompt, new persistence and release still HOLD pending distinct approvals, Face owners, Human evidence and supply-chain/security #1208 remediation. Do not waive expired `node-forge` advisory exception or merge stacked PRs independently.

Watchtower-Track: face-lab-skin

### 2026-10-17 S1-D blind reviewer bridge implementation checkpoint

- [Draft #1342](https://github.com/gycha0109-beep/K_beauty/pull/1342) (stacked on unmerged #1310) adds a **research-only, offline** strict bridge between private corrected-v2 four-case metadata and independently collected reviewer A/B annotations; an explicit source-verified capture-tag record is required. Only exact two-reviewer agreement is eligible for provisional cue comparison; disagreements and unassessable references are not silently inferred from model output. `not_seen(0)` mapping is allowed **only for explicit v2 states**, never legacy v1 zero.
- Local synthetic **4×7** mapping verifier `PASS` and syntax checks `PASS`; Main Health adds the synthetic verifier, but **exact-HEAD CI verdict remains separate and is not implied by local PASS**. The code and tests contain no actual photos, private model output, human labels, subject identifiers or keys. No new Provider attempts.
- **Remaining user/owner-dependent gate:** genuinely independent two-rater visible-cue labels and capture condition metadata with consent for reviewer access. Until then S1 actual model accuracy, Face semantic parity, production score/ranking changes, S5 readiness and release **HOLD**. No merge/deployment.

### 2026-10-17 S3 explicit-v2 state comparability checkpoint

- Following the operator's instruction, **S1-D TC-01..04 normal-path structural study is CLOSED** using the previously supplied verification summary. No additional reviewer UI, independent Human labeling exercise or new KEY2/real-face Provider call is requested in this development iteration. Actual cue accuracy remains distinct/unverified and does not become a production approval.
- **S2-E** recommendation admission had already passed its **synthetic-only 120-pair sensitivity tests** in Draft #1339. This does not authorize production scoring/Top Pick changes. Continue with independent unblocked S3 research work rather than cycling back through S1 screens.
- **S3 resumed:** Draft [#1311](https://github.com/gycha0109-beep/K_beauty/pull/1311) now also contains a strict Skin-v2-to-comparability metadata adapter plus synthetic regression. Only explicitly observed `not_seen(value:0)` can become an observed zero; v1 numeric 0 cannot be inferred, `unknown/unassessable` remain null and block per-axis comparison, and Skin ineligibility requires zero axes. Missing/duplicate axes, contradictory confidence, unknown input fields, different subjects, filter, low confidence and other capture incompatibilities are rejected or reported conservatively.
- **Important cohort distinction:** TC-01..04 are distinct experiment case IDs, **not documented repeated photographs of the same individual**. Never manufacture a time series or improvement estimate from them. Real repeat-capture Human/privacy approval remains separate HOLD, as do production score, DB/Storage, release/security #1208 and stacked Draft merges.
- Local synthetic adapter verification **PASS** before commit; exact-head GitHub CI must be checked separately, not presumed. No image bytes, raw private model responses, secrets, Provider calls, application UI changes, merge or deploy.

### 2026-10-17 S4 saved report v2-state display checkpoint

- After scoped S1-D structural closeout, existing Draft [#1313](https://github.com/gycha0109-beep/K_beauty/pull/1313) was advanced **without creating a new evaluation screen**. In the native saved Premium report, explicit Skin-v2 `state=unknown|unassessable` no longer counts toward high/medium-confidence supporting visual observations, even if a malformed legacy confidence field says `high`. Only explicit `present|not_seen|observed`, or legacy shape without a state (preserved for compatibility), can count. Zero qualifying cues retain the existing limited-evidence/retake explanation; no claim of healthy skin.
- Synthetic tests for explicit v2 state vs low/unknown abstention were added to the existing Main Health verifier. **Exact-head CI still must be checked separately** before declaring this patch verified. Browser/native actual user acceptance, Android, dark mode and accessibility remain distinct S4 HOLD.
- Draft #1311 S3 state bridge exact head `0768fd995ebe357b1a89bf306d42a86d6d5dae8a`: **Main Health PASS, PIE PASS, CodeQL PASS**; Supply Chain gate fails on the outstanding dependency/security issue (#1208). S3 actual repeat photography/consent/retention and real improvement claims remain HOLD.
- No Face/Style behavior, Provider, user photos, scoring/Top Pick, persistence, API, DB/Auth/RLS, merge or deployment changed. All relevant branches stay Draft.

### 2026-10-17 S4 native account-reentry + S5 current evidence checkpoint

- Continued S4 in existing Draft [#1313](https://github.com/gycha0109-beep/K_beauty/pull/1313) without reopening S1 evaluation, making another UI prototype, using real faces or calling Provider. Native saved-report async loads are now gated by user ID and request generation, and invalidated on logout, account/locale changes, retry, screen teardown and authenticated share-sheet continuation. `subscribeNativeAuth` plus an initial-session race guard prevents older responses from reviving a previous user's report in the **client view**. This does **not** certify server RLS or replace live two-account acceptance.
- A synthetic-only S4 race verifier was integrated into Current Main Health; observed [prior candidate Main Health #39029975649](https://github.com/gycha0109-beep/K_beauty/actions/runs/39029975649) **PASS** including `verify-face-lab-skin-s4-saved-report-view-gate`. Later exact-head verification must be checked independently.
- Existing Mobile CI initially **FAIL** because two camera/ML-Kit contract verifiers asserted emulator camera and Expo prebuild setup in `mobile-native-shell.yml`; these responsibilities had migrated to the canonical `mobile-android-runtime.yml`. Narrowly updated the tests to check the *same required camera/prebuild/native-verification conditions* at their actual owning workflow plus strict Native Shell delegation. No camera implementation or security/workflow code was weakened. S4 exact-head `e4eee9dedd522ed7d3487cbd3bb9f88596746e3e` [Mobile CI #39030387235](https://github.com/gycha0109-beep/K_beauty/actions/runs/39030387235) **PASS**. This does not constitute physical Android capture acceptance.
- The S5 existing Draft [#1314](https://github.com/gycha0109-beep/K_beauty/pull/1314) now includes dated schema-conformant snapshot `skin-s5-readiness-snapshot-20261017.json` and fail-closed CI verifier. **Product gates: 5 HOLD; release gates: SCA FAIL + 5 HOLD.** Exact-head `a500bda7dd0ac6ee8b8281e6b0e57e0da23fcfae` [Main Health #39030122547](https://github.com/gycha0109-beep/K_beauty/actions/runs/39030122547) PASS, [PIE #39030122858](https://github.com/gycha0109-beep/K_beauty/actions/runs/39030122858) PASS; Supply Chain remains FAIL on expired `GHSA-86w9-cpqp-85rv` node-forge advisory exception (#1208). No exception/bypass, merge or deploy.
- **Next external gates** only after all automated tests: Android physical two-account sign-in/out, saved Premium reopen, locale/dark-mode/320px/accessibility, slow network and camera/error recovery; an approved repeat-photo/reviewer study and privacy/DB review if later explicitly requested; security owner remediation of #1208 and final S5 owner approvals. S1-D four-case normal-path *structural* study stays CLOSED per user's instruction; **do not reopen it**. Actual Human accuracy remains unverified and cannot be inferred from 4/4 structural agreement.

### 2026-10-18 S5 shared supply-chain security unblock

- **보안 블로커 해제 판정 반영:** 별도 Security [PR #1343](https://github.com/gycha0109-beep/K_beauty/pull/1343) 병합 `main@fc61d592b37f13608277812602ed7d69b5585a77` 및 Production READY 배포 완료. 병합 SHA의 [Supply Chain/CodeQL #39112482805](https://github.com/gycha0109-beep/K_beauty/actions/runs/39112482805), [Main Health #39112482806](https://github.com/gycha0109-beep/K_beauty/actions/runs/39112482806), Android Runtime 통과. 승인된 수정 패키지의 설치 코드/동작 및 원본 advisory 커버리지 검사 PASS. 원본 이름 기준 raw audit의 HIGH 경고는 유지되며 숨기거나 정책 예외를 연장한 것이 아님. 보안 트랙에서 완료한 공통 의존성 배포이지 Skin Draft 기능 배포는 아님.
- Skin S5 [Draft #1314](https://github.com/gycha0109-beep/K_beauty/pull/1314)에 **2026-10-18 신규 날짜별 스냅샷**과 테스트 추가: `sca_security=pass` (정확한 병합·검사 근거), 다른 제품 게이트 **5 HOLD**, 나머지 릴리스 게이트 **5 HOLD**. 따라서 `PRODUCT=HOLD`, `RELEASE=HOLD`. 과거 2026-10-17 `SCA FAIL/RELEASE BLOCKED` 스냅샷은 역사 기록으로 보존.
- **남은 독립 승인:** S0 현재 코드 감사, S1 독립 Human 정확도, S2 실제 의사결정 안전성, S3 동일 사용자 반복 촬영 신뢰도, S4 Android/Web 실사용 UAT, Skin 개인정보·동의·보존, Auth/RLS/Storage, Skin 기능 통합 CI, Skin 기능 롤백/모니터링, 책임자 제품/출시 승인. S1-D 4건 구조 실험은 사용자의 기존 마감 지시대로 다시 수행하지 않는다.
- 공통 보안 해제 ≠ Skin 제품 출시 승인. Skin 관련 PR은 Draft/미병합, 실제 기기/개인정보 검증과 Skin 기능 배포는 아직 미실행. 이 변경에서 신규 평가 UI·Provider 호출·사진·DB/운영 쓰기·병합·배포 없음.

### 2026-10-18 S4 native Premium account and duplicate-finalize hardening

- 기존 `main`의 Android/Expo `apps/mobile/app/premium.tsx` 실코드에서 **로그아웃·계정 전환·화면 이탈 후 늦게 끝난 Premium access/생성 요청이 UI 상태 또는 저장 리포트 이동을 덮어쓸 수 있는 비동기 경합**, 그리고 React 리렌더 전에 생성 버튼 연타 시 **중복 POST 가능성**을 확인했다. 서버 RLS 유출/실제 중복 생성이 관측됐다는 주장은 아님.
- [신규 독립 Draft #1345](https://github.com/gycha0109-beep/K_beauty/pull/1345)는 승인된 보안 패치가 반영된 **최신 main 기반**으로 Premium account+generation gate, synchronous single-flight finalize, Auth subscription + initial-session race guard, 이전 계정 제품 선택/오류/권한 상태 초기화, 같은 계정 token refresh 시 선택값 보존을 구현했다. 오래된 #1313 브랜치와 다른 파일만 변경하여 병합 충돌 가능성을 줄임.
- 로그인 A→B, 늦은 access 성공/실패, 중복 버튼, 오래된 finalize 완료가 새 계정 화면/lock에 영향 주지 않는 **합성 비동기 부정 테스트**를 기존 Current Main Health에 추가. 실제 계정/Provider/사진/결제/DB/서버 권한/배포 호출 없음. 서버에 이미 전달된 POST의 취소·중복 저장 방지는 보장하지 않으며 서버 측 idempotency는 별도 검증 필요.
- **S4 완료/제품 승인 아님:** exact-head CI, Android 실기기 2계정 전환/로그아웃, 실제 느린 네트워크와 인증 갱신, 결제·Premium 접근 경계 UAT는 독립적으로 남음. S1-D 4건 구조 실험은 재개하지 않음. SCA 해제 상태는 #1343 증거로 유지하며 다른 Skin 게이트는 HOLD.
