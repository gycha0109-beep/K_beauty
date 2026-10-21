# BEJEWELY Skin Scan Lab — 브라우저 전용 검증 시제품

상태: 실험 / 운영 기능 아님 / 의료 진단 아님 (2026-10-21).

## 실행

저장소 루트에서 다음 명령을 실행합니다.

    node scripts/run-skin-scan-lab.mjs

브라우저에서 http://127.0.0.1:3178 주소를 열고 정면에 가까운 얼굴 사진을 선택합니다.

사진은 이 코드에 의해 서버 전송되거나 저장되지 않습니다. 모델과 실행 파일은
처음에 jsDelivr 및 Google의 공식 주소에서 다운로드됩니다. 따라서 외부 호스트에
연결되는 트래픽이 있으며 완전한 오프라인이나 독립적인 보안을 보장하지 않습니다.

## 왜 로컬 실행만 지원하는가

BEJEWELY 운영 웹의 middleware는 문서 응답의 CSP에서 외부 script, connect,
worker를 제한합니다. 페이지 안의 자체 CSP는 상위 정책을 완화할 수 없습니다.
그래서 현재 정적 페이지의 운영 웹 URL은 지원 대상으로 간주하지 않습니다.
이 제한을 우회하거나 보안 설정을 수정하지 않기 위해 로컬 전용 서버를 제공합니다.

## 실제 계산 항목

- MediaPipe Face Landmarker: 얼굴 랜드마크와 윤곽
- MediaPipe SelfieMulticlass: 얼굴 피부에 해당하는 마스크 (class 3)
- 얼굴 피부 마스크 안에서만 계산한 상대적인 영상 특징:
  - 붉은색: RGB 기반 붉은색 채널 상대 강도
  - 광택: 밝기에서 색상 편차를 일부 차감
  - 미세 점: 주변보다 어두운 작은 패턴
  - 색상 편차: 국소 밝기 차이
  - 트러블 유사: 붉은색 + 암점 + 결 패턴 조합
  - 피부결: 인접 픽셀의 밝기 기울기

각 지도의 강도는 해당 사진 내부에서 정규화합니다. 따라서 동일한 수치라도
사진 간 피부 심각도를 비교할 수 없습니다.

정확한 여드름 개수·유형, 실제 모공 크기, 홍조의 의료 등급, 피부 수분량,
피부 장벽 기능, UV 손상 등은 구현하지 않습니다. 트러블 유사 지도는
임상적 병변 검출 결과가 아닙니다.

공개 Skin-Scan OSS 저장소는 조사 및 설계 참고용으로만 사용했습니다.
해당 프로젝트의 실제 특징 지도 코드를 복사하지 않았습니다.

## 외부 자산 및 권리 확인

- MediaPipe SDK: https://github.com/google-ai-edge/mediapipe
- JS 버전: 0.10.35 (jsDelivr 버전 고정)
- Face Landmarker: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- SelfieMulticlass: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
- 모델 문서: https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter

Google 공식 모델 카드에 Apache-2.0 사용 조건이 명시돼 있으나 실제 운영용으로
도입하기 전에는 정확한 아티팩트 버전, 체크섬, 라이선스와 NOTICE 등을 고정·검증해야
합니다. 특히 latest 모델 URL은 변경 가능성이 있으므로 그대로 운영에 도입하지 않습니다.

## 서비스 반영 전 필수 검증

1. 실제 동의받은 정면 얼굴 사진과 다양한 조명, 피부톤, 모바일 브라우저에서 실행 검증
2. 오류 사례, 모델 다운로드 실패, 여러 얼굴, 얼굴 인식 실패 상태 확인
3. 전문가 라벨과 비교하여 상대 영상 지도에서 발생하는 허위 양성 확인
4. 모델/WASM/SDK 자산을 서비스 원본 호스트에 두되 CSP를 완화하지 않는 구성 설계
5. 별도 라이선스 확인을 거친 병변 검출 모델 및 데이터 없이는 정확한 점 위치 표시 금지
6. 개인정보 처리와 이미지 삭제 정책·동의 UX 승인

작업 범위는 격리 실험 페이지 및 실행 스크립트뿐입니다.
기존 분석 API, 스타일 엔진, 추천 로직, 보안 미들웨어, DB, 결제, 배포 설정은 변경하지 않습니다.

## 테스트 상태

정적 코드 검사로 문법과 요소 연결을 확인할 수는 있지만, 실제 웹브라우저와
모델 파일 로딩, WebAssembly, 추론 결과, 촬영 품질 및 의학적 정확도를
검증한 것이 아닙니다. 실행 검증은 별도 완료 전까지 미검증으로 표기해야 합니다.
