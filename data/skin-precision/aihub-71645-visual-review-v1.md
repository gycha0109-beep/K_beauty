# AI-Hub 71645 — VS 이미지 × VL 여드름 좌표 육안 검수

> 상태 2026-10-22: Google Drive 원천데이터 **메타데이터 검수** 통과. 실제 얼굴 픽셀/병변 위치의 눈 검수는 아직 하지 않았으며, 모델 학습·상용 승인도 하지 않았다.

## 실제 소스 조사 결과 (대상: 검증용 / Validation)

- 세 기기 폴더에서 동일한 대상자 식별자 집합 **107개** 확인.
- 디지털카메라: 식별자별 JPEG 7장 — **749장**. 촬영 각도 `_01_F`, `Fb`, `Ft`, `L15`, `L30`, `R15`, `R30`.
- 스마트패드: 식별자별 JPEG 3장 — **321장**. `_02_F/L/R`; `0659` 빈 중복 폴더 1개 제외.
- 스마트폰: 식별자별 JPEG 3장 — **321장**. `_03_F/L/R`; Drive 업로드 중 일부 폴더·파일에 ` (1)` 접미사.
- **총 1,391장** 이미지 파일의 존재와 이름 패턴을 107개씩 실제 Google Drive 개별 폴더 조회로 검증했다. 얼굴 이미지 내용/화질/좌표 정답 정확성에 대한 증거로 해석하면 안 됨.
- 앞선 `VL.zip` 라벨 파싱 결과: 학습용 위치 2,851개, 검증용 375개, 총 3,226개. 5개 주요 acne type과 비정상 type `Circle(Clone)` 1건 보고됨. 단, 원본 파일의 육안 비교/라벨링 전문가 재검증 전이므로 임상적 gold로 확정하지 않음.
- 위 주석은 원본 이미지 확인 이전의 *source labels*이며 모델 검출 결과가 아니다. 개별 좌표가 단순 center point일 수 있으므로 bbox 성능(mAP) 정답으로 직접 취급하지 않는다.
- `acne=null`은 **negative가 아니다**. 별도 의미 확인 전 `not_assessed`로 제외.
- 홍조에 대한 마스크가 없으므로 홍조 영역 학습 정확도 주장 불가.

## 원본 얼굴 이미지 전송 없는 로컬 오버레이 도구

`scripts/review-aihub-71645-acne-local.mjs` — Node.js 기본 라이브러리만 사용. **원본 JPEG를 업로드·복사하지 않음**. 컴퓨터에서 파일 경로를 사용하여 브라우저가 **그 컴퓨터의 원본 JPG를 직접 표시**하도록 로컬 HTML을 생성. 단, 결과 HTML은 얼굴 사진의 로컬 경로를 포함하므로 외부 공유 금지.

1. VS.zip, VL.zip을 **본인 PC의 접근 통제된 디렉터리**에 각각 압축 해제. Google Drive 서버에서 분석하는 것이 아니라 로컬 사본을 사용.
2. 저장소 루트에서 (PowerShell, Node 18+):

       node scripts/review-aihub-71645-acne-local.mjs --self-test
       node scripts/review-aihub-71645-acne-local.mjs --labels "D:/private/aihub71645/VL" --images "D:/private/aihub71645/VS" --out "D:/private/aihub71645/acne-review.html" --limit 18

3. 생성한 `acne-review.html`을 같은 PC의 브라우저로 열고, 노란색 점/번호가 실제 병변 중심을 가리키는지 확인. 점마다 **정확 / 위치 오류 / 유형 오류 / 판정 어려움**을 선택.
4. 버튼으로 `aihub-acne-review-summary.json` 다운로드. **사진·파일명·개인 식별자는 내보내지 않으며**, 순번별 판정과 집계만 저장. 이 JSON만 별도 활용 가능할지 이용조건에 맞춰 검토.
5. 먼저 양성 정면 사진에 대해 위치 정답 일치율을 측정하고, 판정 불가능한 점은 분모·분자에서 무작정 제거하지 말고 별도 보고. 누락된 실제 병변(FN)은 모든 병변을 다시 읽는 전문가 **전수 검수** 없이는 측정 불가능하다는 점도 명시.

## 자동 차단 조건

- 이미지 파일명이 복수의 다른 원본으로 충돌 → 해당 사진 제외.
- 원본 JPEG dimensions가 JSON width/height와 불일치 → 제외.
- `Circle(Clone)`처럼 지원되지 않는 type → 제외 및 카운트.
- multiple points가 bbox vertices인지 복수 병변인지 불분명 → **추정하지 말고 제외**.
- 이미지 범위 밖 좌표, 중복 type/point, 해석 불가능한 구조 → 기록, 수정 없이 제외.
- 정상/무여드름 여부는 독립 전문가 확인 전까지 학습용 네거티브로 등록하지 않음.
- 얼굴 라벨의 연령/성별 등 민감 개인정보 필드와 원본 이미지/경로를 GitHub나 채팅으로 내보내지 않음.

## 결과의 올바른 표현

- **지금 통과한 검증:** Google Drive 파일 트리(1,391 JPEG), 촬영 파일명 패턴 및 식별자 집합 동등성. 스크립트의 합성 스키마/좌표/이미지 읽기 함수 테스트.
- **아직 완료되지 않은 검증:** 현장 실제 VL JSON schema로 로컬 스크립트 실행, 실제 JPG 디코딩 및 육안 오버레이 정확도, 독립 전문가 검수/민감정보 동의/모델 성능.
- **학습 착수 문턱:** 실제 이미지와 source point가 맞는지 현지 검수 + 이용허가 및 보관/전송 조건 충족 + source annotation confidence 확인. 독립 subject split은 폴더 식별자 의미 확인 후 적용.
- **서비스 문턱:** 외부 독립 평가, 모공/색소 표준 단위 및 기기 편향 평가, 홍조 별도 마스크, 사용자 앱 배포 결정은 모두 별도.

## 검증 실행 기록

- V8 격리된 함수 테스트에서 `--self-test` 10개 체크 통과.
- synthetic JSON 6개 표식 중 정상 2개를 유지하고, 거부 class/중복/이미지 범위 밖/모호한 다중 점을 각각 집계하며 JPEG 치수 매칭 성공 확인.
- Node CLI 실제 명령, 수천 JSON 실제 로컬 파싱, 원본 JPG open의 성공 여부는 이 대화 세션의 컨테이너/PC 실행 환경이 닫혀 **미검증**. 결과를 PASS로 보고하지 않음.
- 사용자 PC의 Remote Desktop Commander 장치는 현재 **오프라인**이므로 원본 이미지를 그 PC에서 대신 열거나 실행하지 않았음.

## 2026-10-22 Google Drive actual-bytes verification (supersedes earlier metadata-only status)

**Direct Google Drive connector reads now succeeded; no Desktop Commander is required.**
- Streamed source JPEG image bytes and decoded/displayed actual **1081_01_F.jpg** (digital camera, SOF dimensions **2136×3216**) and **1081_02_F.jpg** (tablet). Both contain real front-face images with an eye anonymization strip; illumination/perspective differ. This is a **limited visual sample**, not full image QA.
- Read actual **VL.zip** file bytes through the Drive connector and decoded its ZIP directory plus compressed JSON members in a self-contained V8 validator. ZIP: **12,843 entries**. For all **1,391** camera/tablet/phone `_*_00.json` lesion-region entries: **1,391/1,391 parsed; 0 parse failures**.
- Exact observed schema: `info.filename`, `images`, `annotations.acne`. Lesions carry `{name: "comedone" | "papule" | "pustule" | "nodule" | "cyst", points: [x,y]}`. Previous script version assumed a flat `filename` + `type` and would **not** parse the real VL.zip; corrected in `scripts/review-aihub-71645-acne-local.mjs` and augmented source-schema tests.
- **Annotation findings**: 58 positive camera frontal images, **375 source points**; papule 208, comedone 129, pustule 30, nodule 5, cyst 3. **All 375 source acne points are in digital-camera frontal images.** The remaining camera views and all 321 tablet / 321 smartphone photos have `acne` null/not assessed; these must **not** become negative training examples.
- Each of the 375 points is a 2D integer coordinate; no missing, malformed or out-of-bounds locations under dataset expected 2136×3216 coordinate system (label-to-actual size must still be checked per photo).
- Offline inspector **synthetic** tests now 12 PASS in isolated JS. ZIP member parser audit is real-source verification performed via Drive; the Node CLI is not yet run against extracted local files. Pictorial point-to-visible-lesion accuracy has **not** been measured. Do not claim gold-grade localization accuracy or smartphone-domain performance from this inspection.
- Practical conclusion: usable for **initial camera-frontal acne-point research** after rights review and spot visual adjudication; **not sufficient standalone** for deployable smartphone lesion detection, segmentation masks, or acne-negative classification. Other skin measurement/grade fields require separate domain/quality validation.
