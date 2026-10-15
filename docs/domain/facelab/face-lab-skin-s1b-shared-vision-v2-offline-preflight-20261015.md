# Face Lab / Skin S1-B — 공용 사진 분석 v2 출력 형식 사전 시험 (2026-10-15)

> **상태: 로컬·합성 입력 전용 사전 구현. 운영 Provider 연동, 공용 Vision v2 활성화 및 실제 사진 정확도 승인 아님.**
>
> 기준선 main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2. 설계 #1317, 선행 축별 계약 #1319, 로드맵 #1307. Skin/Style은 공용 얼굴 사진 요청과 Face 관찰 계약을 공유하지만 새 Skin 정보는 Face 상태를 덮어쓰지 않는다.

## 작업 범위

이 독립 PR은 서비스 수정 없이 다음 두 모듈을 검증 폴더에 둔다.

- scripts/facelab/skin/skin-vision-v2-candidate-core.mjs
  - 별도의 **v2 후보 프롬프트**를 생성하되 기존 v1 프롬프트는 수정하지 않음.
  - 기존 image eligibility와 Face 관찰 계약/판단 함수를 그대로 참조.
  - Skin 7축은 명시적으로 present(1~5), not_seen(0), unassessable(null), unknown(null)로 요구. 원래 skin.signals 숫자 8개를 새 증거로 자동 승격하지 않음.
  - 입력 버전이 v1이면 **기존 v1 정규화**만 호출하고 Skin 축별 진실 여부는 검증 불가로 보류.
  - v2에서는 Skin 평가 오류가 있어도 정상 Face 정보가 남을 수 있게 독립 평가. 별도 Face 엔진을 재구현하거나 사진을 추가 분석하지 않음.
  - 알 수 없는 필드/버전은 무조건 인정하는 대신 문제 코드와 보류로 구분.
  - 프롬프트 문자수/최소 합성 JSON 길이만 계산. **실제 토큰 수·Provider 비용·실패율은 측정하지 않음.**
- scripts/facelab/skin/verify-face-lab-skin-s1b-vision-v2-candidate.mjs
  - 합성 Face 구성과 v1/v2의 Face 정규화 결과 일치를 검증.
  - Skin 단일 축 누락, 중복, 잘못된 단서, 낮은 신뢰도 zero, 잘못된 숫자, 손상된 Skin 형식, 개인정보처럼 보이는 임의 필드, Provider와 맞지 않는 버전, Skin만 부적격/Face만 부적격을 각각 검증.
  - v1 사진의 0/5가 명시적 확인/부재라고 소급 판정되지 않음을 검증.
  - 실제 Provider, Analyze API, 저장, 추천 엔진에 시험용 모듈이 연결되지 않았음을 확인.
  - 기존 Main Health에서 호출하도록 연결.

## 어떤 조건에 특히 유의해야 하나

1. **한 번의 공용 호출**: 서비스와 Face Reading 호환 라우트는 변경하지 않는다. v2 후보는 문장/형식만 **생성**하며 실제 모델에 전달되지 않는다.
2. **Skin 부분 오류 vs Face 정상**: Face 판단은 기존 buildFaceLabObservationAnalysis가 수행. 피부 숫자가 부족하거나 보이지 않는다고 얼굴 구조를 불필요하게 버리지 않도록 분리한다.
3. **Face 부분 오류 vs Skin 정상**: Skin이 충분히 관찰됐어도 얼굴 특징은 독립적으로 unavailable/partial을 유지할 수 있다.
4. **과거 저장 결과**: v1에만 존재하는 정수 0은 관찰 불가·관찰했지만 문제 없음의 구별이 불가능. 저장된 리포트/추천은 재계산하지 않는다.
5. **현재 응답 길이 위험**: 공용 Vision 서비스 max_completion_tokens 기본 2,200. 새 Skin 7축×7필드는 구형 Skin 숫자보다 JSON 출력이 길어질 수 있다. 테스트의 문자 길이 비교는 실제 토큰·응답 시간의 대체 증거가 **아니다**.
6. **개인정보**: 시험 결과는 합성 문자열·열거값만 이용한다. 모델 원본 응답/사진·얼굴 특징/사진의 자유서술을 GitHub/CI/진단에 남기지 않는다.
7. **상태 문구**: 사진상 보이지 않음은 정상·질환 없음이 아니며, present는 의료적 확진이 아니다. 얼굴·Skin의 주장은 시각적 근거 범위에서만 사용한다.

## 테스트 범위 및 실행

- node scripts/facelab/skin/verify-face-lab-skin-s1-axis-evidence.mjs
- node scripts/facelab/skin/verify-face-lab-skin-s1b-vision-v2-candidate.mjs
- node scripts/verify-current-main-health.mjs

위 명령의 PASS는 **CI/로컬에서 실제 실행한 로그를 확인한 뒤** 기록한다. 프롬프트 문자열 비교만으로 진짜 Vision Provider가 7개 항목을 안정적으로 반환할 수 있다고 주장할 수 없다.

## 2026-10-15 첫 exact-head CI 근거 (오프라인)

확인한 PR #1323 커밋: f05c4346d0e04879729781c6225eca91334a6686.

- [BEJEWELY Current Main Health run 38667873431](https://github.com/gycha0109-beep/K_beauty/actions/runs/38667873431): **PASS**; 새 7축 v1/v2 합성 검사 PASS, 기존 Face 결과 일치 확인, 추천 164제품×12상황 PASS, Premium 31변형/462검사 PASS.
- [PIE Prospective Shadow run 38667874025](https://github.com/gycha0109-beep/K_beauty/actions/runs/38667874025): **PASS**.
- [Supply Chain Security run 38667873606](https://github.com/gycha0109-beep/K_beauty/actions/runs/38667873606): **FAIL** (기존 의존성 보안 이슈 #1208). 무시/예외 연장 없음.

**응답 길이 위험의 근거(문자 수일 뿐 토큰 측정 아님):**

| 오프라인 기준 | 기존 v1 | 새 v2 후보 | 변화 |
| --- | ---: | ---: | ---: |
| 프롬프트 문자 길이 | 11,647 | 14,789 | **+3,142** |
| 최소 합성 Skin JSON 문자 길이 | 126 | 827 | **+701** |

이 차이는 기존 Provider 기본 최대 출력 2,200 **tokens**에서 v2 데이터가 여유 있게 들어간다는 근거가 **될 수 없다**. 기존 Face 정보의 실제 출력도 함께 포함되므로, **모델 실출력·잘림·정규화 성공률을 통제된 별도 시험에서 확인하기 전 v2를 운영에 연결해서는 안 된다**. 위 비교는 v1/v2 Skin 데이터를 포함한 **최소 임의 합성 예시**로, 실제 관찰 수와 Face 반환량의 평균/최댓값이 아니다.

**검증 완료의 정확한 의미:** 현재 합성 계약은 불확실성을 보존하고 Face 결과가 피부 정보 오류로 함께 사라지지 않도록 동작한다. 실제 Vision 모델에서 동일한 데이터 형식이 안정적으로 생성되는지, 사람이 볼 때 그 관찰이 사실인지, 추천 안전성이 높아지는지까지 입증한 것은 아니다.

## 다음 출시 전 필수 외부 검증

| 단계 | 검증 조건 | 지금 상태 |
| --- | --- | --- |
| v1·v2 호환성 | 공용 사진 요청 1회, Face/Style 결과·기존 권한·구형 리포트 보호 | 이 PR은 **합성 오프라인 시험만** |
| 모델 출력 길이 | 기본 2,200 completion tokens에서 JSON 유효성·잘림·소요 시간·비용·Face 품질 변화 비교 | Provider 시험 승인 필요 |
| Human 독립 검수 | 조명·화장·가림에 따른 present/not_seen/unknown의 정확도·판단자 간 일치도·보류율 | 동의와 비공개 사진 보유/평가 정책 필요 |
| 점수 정책 | 새 항목별 신뢰도 필터가 기존 추천과 얼마나 다른지 #1322의 합성 영향 연구를 실제 사진과 연계 | 변경 적용 별도 승인 |
| 보안·출시 | 기존 보안 #1208 해결, 리포트/저장/Android 검증, 운영 책임자 승인 | HOLD |

**다음에 시행해도 되는 작업**: 이미 존재하는 합성 입력만 사용하는 프롬프트 출력 규모·문법 및 Face/Style 독립성 추가 검사.

**승인 전 수행하지 않는 작업**: 실제 이미지의 Provider 호출, 운영 v2 프롬프트 변경, 서비스의 사진 점수·추천 변경, 이미지/새 근거의 영속 저장, 사용자 대상 Preview/Production 배포.

Watchtower-Track: face-lab-skin
