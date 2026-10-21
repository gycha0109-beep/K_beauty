# Face Lab Style M2 — MediaPipe ROI 브라우저 연동·독립 검수 프로토콜 (2026-10-21)

**Draft / 개발 전용 / Face Lab Style Track / 운영 미승인**

## 현재 완성된 연결 지점

- 설치된 `@mediapipe/tasks-vision@0.10.35`의 Face Landmarker Web IMAGE 모드와 ROI 기하 제안기 `proposePersonalColorCheekRegions`을 `lib/face-lab-v2/personal-color/mediapipe-roi-proposal.js`에서 연결합니다. 모델·WASM은 **버전/출처가 고정된 공개 자산**이며 클릭 전 로드하지 않습니다.
- `components/face-lab-test/FaceLabM2MediaPipeRoiResearch.jsx`: 기존 **development 전용** `/face-lab-test` 페이지에서 명시적 클릭 후 로컬 브라우저에서 이미지 디코딩·Face Landmarker 추론. 청록색 제안 볼 영역, 주황색 눈/입 제외 구역을 일시적으로 캔버스에 표시합니다.
- 이미지 방향(좌우 미러 없음)에 대한 사용자 확인이 없다면 실행하지 않습니다. 이 확인은 **전문가/독립 검수 증명은 아닙니다**.
- `lib/face-lab-v2/personal-color/roi-review-evaluation.js`: 별도 검수자가 만든 **독립 이진 피부 마스크**를 입력받은 경우에만 ROI IoU·precision·recall을 영역별로 수치화합니다. 반면 개발용 화면에는 검수 마스크가 없으므로 결과는 기하 `proposal_only`이며 피부 측정·퍼스널 컬러 추천으로 승격하지 않습니다.
- 결과 상태는 `proposal_only` 또는 `insufficient_evidence`. 0명/복수 얼굴/랜드마크 결함/미러링/범위 밖/모델 실패는 보류합니다. 구조화 결과에는 원본 사진, 원본 랜드마크·마스크·ROI 좌표를 넣지 않습니다.
- 검출 종료 후 `FaceLandmarker.close()`와 `ImageBitmap.close()`를 호출합니다. 브라우저 캔버스는 개발용 임시 오버레이이며 파일 저장·업로드 버튼이 없습니다.

## 안전·네트워크 제약

1. 모델 `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` 및 WASM `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm`을 **개발 UI에서 사용자가 클릭했을 때만** 로드합니다. 이 자산 다운로드는 인터넷 연결, 브라우저 CSP 및 제공자 가용성에 의존합니다. 사용자의 얼굴 이미지 파일을 이 코드에서 외부 URL로 전송하지 않습니다.
2. 기존 Face Lab 업로드·분석 API의 데이터 흐름은 **그대로**입니다. 따라서 기존 페이지에서 이미 수행하는 서버 분석과 이 별도 MediaPipe 브라우저 로컬 추론을 혼동하면 안 됩니다.
3. 이미지 방향은 브라우저 EXIF 해석에 따른 디코딩 좌표를 사용합니다. 원본 촬영 프레임·전면카메라 미러 여부가 불명확한 경우 독립 판정 없이 동일 좌우라고 가정하지 않습니다.
4. FaceMesh 얼굴 랜드마크는 표면의 기하 좌표이지 피부만 분리한 마스크가 아닙니다. 화장·수염·반사·그림자·머리카락 제거가 자동으로 보장되지 않으며, `reviewed-roi-sampling.js`의 독립 피부 마스크 검수 게이트는 계속 유지합니다.
5. 새 외부 서버 처리·사진 데이터베이스 저장·기기 접근 권한·유료 모델 제공자 호출 없음. **기존 보안 이슈 #1208과 M6 출시 게이트**는 별도 해결이 필요합니다.

## 테스트 증거의 수준

| 범위 | 이번 확인 | 현재 한계 |
| --- | --- | --- |
| MediaPipe 호출 계약 | 주입된 mock FilesetResolver/FaceLandmarker로 API 옵션, 한 번의 `detect(image)`, `close()` 수명주기 검사 | CI에서는 공개 모델을 실제 로드하지 않음 |
| 얼굴 및 기하 실패 | 얼굴 0/2명, 468개 미만/결함·비정상 좌표, 방향 불명, 모델 다운로드·검출 예외 시 보류 | 실제 기기별 얼굴 검출 성능 미측정 |
| ROI 독립 대조 | 후보 ROI와 **별도 작성된** synthetic 양측 볼 참조 이진 마스크로 IoU/precision/recall 계산, 입력 불량/좌우 뒤바뀜·겹침 보류 | 실제 사진 전문가 ROI 참조 세트와 IoU 벤치마크 0건 |
| 개발 브라우저 UI | 모델은 **사용자 클릭 전 자동 로드하지 않음** 및 모델 성능·피부 진단 미노출 | 실제 MediaPipe WASM/모델 다운로드 및 실사진 검출 성공 여부는 아직 현장 검증 필요 |
| 통합 | 기존 M2 Foundation 및 개발 전용 테스트 페이지에 연결 | Production Canonical, Premium Full Report, Skin Track은 수정하지 않음 |

## 출시 전 남은 게이트

- 실제 테스트 기기의 개발 모드 브라우저에서 모델·WASM 로드 및 최소 1장 실사진의 랜드마크 검출 확인.
- 동의받은 실사진에 대해 독립 참조 피부 마스크를 제작하고, 같은 좌표계에서 IoU·precision·recall 측정. ROI 검수자 간 합치도 조사.
- 강한 웜/쿨 조명·편집 사진, 실패 시 보류 UX, EXIF 회전·미러 변환, 느린 기기/네트워크 오류 테스트.
- 피부 반사색/퍼스널 컬러 적합성을 주장하려면 **계측·교정 근거 및 전문가 연구**가 별도로 필요. 이번 기능과 전혀 동등하지 않음.
- 병합·배포·외부 개인정보 전송 정책·별도 Provider/Storage 승인 없이 시행하지 않음.

**검증:** `node scripts/verify-face-lab-v2-personal-color-mediapipe-roi.mjs`, Foundation CI 및 M2 개발 화면 Chromium 테스트. CI 성공은 얼굴 검출기 모델의 실제 정확도 PASS를 뜻하지 않습니다.

Watchtower-Track: face-research
