# Face Lab / Skin S1-B — 실제 Provider 응답 수집 전 2,200토큰·얼굴 품질 판정기

> 2026-10-15 / **정확한 상태: 테스트/판정 코드 준비만 완료. 실제 모델/동의된 얼굴 사진을 사용한 실행 없음.** 별도 리뷰/승인 전 Provider 호출, 이미지 전송, 새 운영 점수 활성화 금지.
>
> 기반: Skin 로드맵 #1307, S1-A 명시적 축별 증거 #1319, S1-B 후보 프롬프트 #1323, S2-C 108쌍 비교 #1322. 기존 메인 Vision v1 및 Style/얼굴 분석은 그대로 유지.

## 해결 대상

기존 분석기는 "사진을 한 번만 Provider에 전송"하지만 max_completion_tokens를 **2,200**으로 설정하며, 응답의 성공 여부를 JSON 구문과 정규화 결과 위주로 판정한다. Provider의 응답에는 choices[0].finish_reason과 usage.completion_tokens가 있으나, 현재 Vision 전용 품질 수용 기준에서는 다음 세 가지가 동시에 평가되지 않는다.

1. 출력이 토큰/길이 제한 때문에 **잘렸는지** (finish_reason=length).
2. Skin v2가 사진 7축을 빠짐없이 명시했는지 (0점/not_seen과 불가/null의 구분).
3. 동일 허가 사진의 v1 비교 대비 **Face 관찰 상태 및 유효 항목 수가 줄었는지**.

이번 코드는 **Provider를 새로 호출하지 않고**, 이 정보가 향후 허가된 시험에서 생성되었을 때 기계적으로 검증할 순수 평가기를 준비한다.

## 코드

- scripts/facelab/skin/skin-vision-v2-provider-evidence-gate.mjs
  - inspectSkinVisionTrial: 메모리에 잠시 존재하는 Chat Completions 응답 엔벨로프(JSON 문자열과 finish_reason, usage)를 분석. 결과로 **안전한 통계/열거값만 반환**하고 원문 문자열·사진·Face 자유 서술/원본 Provider 응답을 저장하지 않는다.
  - summarizeSkinVisionTrials: 같은 **비식별 시험 케이스 ID**의 v1/v2 한 쌍을 비교하여 얼굴 관찰 상태 저하·확인 가능한 필드 수 감소, v2 잘림·불완전한 7축, 상한 근접 응답, 완전한 평가 쌍 개수를 합산한다.
  - 실제 모델 출력의 정확성/Human 정답 여부는 확인하지 않는다.
- scripts/facelab/skin/verify-face-lab-s1b-provider-evidence-gate.mjs
  - 합성 제공자 응답(실제 API 호출 **0회**)으로 다음 부정 사례를 검증: JSON 형태는 정상인데 finish_reason=length인 경우, 2,200토큰 소진·초과, 실사용량 누락, 형식 오류, 불완전한 축, 얼굴 필드 감소, 버전 착오, 외부 자유 서술 유출 방지.
- scripts/verify-current-main-health.mjs에 새 합성 검증을 연결한다.

## 판정 의미

| 관측 | 시험 단계 판단 |
| --- | --- |
| v1/v2 둘 다 정상 stop, 파싱/계약 정상, 토큰 여유 있음, Face 상태·필드 감소 없음 | STRUCTURAL_PREFLIGHT_PASSED_ONLY: **형식 비교만 통과** |
| finish_reason=length 또는 completion_tokens ≥ 2,200 | 응답 완결성 FAIL, 운영 전환 금지 |
| 출력이 한도 90% 이상 사용 | 근접 경고. 현재 90%는 **잠정 검토 경계**, 실제 운영 품질 기준으로 확정하지 않음 |
| v2 Skin 축 누락/중복/잘못된 값 | 해당 사진의 v2 완전성 FAIL, 다른 유효 Face 관찰은 버리지 않음 |
| v2 Face 상태/필드 개수가 v1보다 감소 | Face/Style 회귀 우려. 실제 전문가 분석 전환 금지 |
| 응답 누락·비교 케이스 불일치 | 증거 부족, 보류 |
| 구조적 시험에서 전부 통과 | **실제 피부 관찰 정확도·피부 고민 진단·추천 품질·제품 출시 승인이 아님** |

### 실제 모델 시험에 필요한 최소 절차 (미실시)

1. 사전 승인된 비공개 시험용 사진과 촬영 조건/목적, 동의/취급 권한을 담당자가 확인한다. GitHub와 CI에 원본/임시 파일 업로드 금지.
2. **운영 호출은 그대로 한 번** 유지한다. v1/v2 비교를 위해 별도의 비운영 평가 절차가 승인될 경우에만, 동일한 사진을 각각 독립된 시험 호출로 평가할 수 있다. 승인 전 다회 Provider 호출 금지.
3. 허가된 비공개 환경에서 Provider 사용량/종료 이유 및 v1/v2 정규화 통계만 **익명 케이스별 메모리**에 기록하고 원본 응답·이미지는 정책에 따라 처리한다. 이 보고서는 수집·보관 인가를 대체하지 않는다.
4. paired metrics: 대조군 v1과 후보 v2의 출력 토큰, json/계약 충족률, Face 사용 가능 비율·유효 필드 수, 낮은 신뢰도·보류율, 시간·비용을 수집한다. 현재 평가기는 토큰·Face·Skin 형식만 판정하므로 **소요 시간·비용·실사진 정답률은 별도 근거 필요**.
5. 별개 Human 평가(#1310)의 독립 라벨·평가자 간 불일치를 대조해 FP/FN/coverage/abstain을 보고, 허용 기준을 실제 분포로 결정한다.
6. 앞 단계와 제품/보안/개인정보 게이트를 충족할 때만 별도의 score-policy 심사에서 #1322의 우선순위/Top Pick 변동에 대한 허용 여부를 결정한다.

### 현재의 확실한 한계

- OpenAI 모델 응답을 직접 받지 않았으므로 **실제로 2,200토큰 이내에 안정적으로 수용되는지는 아직 미검증**.
- v1/v2를 동일 사진에 돌렸다는 주장은 케이스 ID만으로 증명할 수 없다. 실제 촬영 파일·재현성·동의 여부는 **외부 독립 검증**이 필요하다.
- 테스트 데이터는 합성 JSON이므로 어떤 값도 사진 속 실제 피부 상태·얼굴 품질의 정확도를 증명하지 않는다.
- max_completion_tokens=2,200 유지. 임의 상향/모델 변경/추가 네트워크 요청/Provider 예외 정책 완화 없음.
- #1208 보안 문제는 독립적인 출시 차단. 기존 추천 엔진·저장 결과·Style 결과·운영 수치 모두 변경 없음.

### 실행

node scripts/facelab/skin/verify-face-lab-s1b-provider-evidence-gate.mjs

node scripts/verify-current-main-health.mjs

**상태 승격 규칙:** 합성 PASS만으로 Provider acceptance, PRODUCT_READY, RELEASE_READY는 절대로 PASS 처리하지 않는다.

Watchtower-Track: face-lab-skin
