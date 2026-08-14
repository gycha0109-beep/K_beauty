import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL,
  FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT
} from "../packages/face-contracts/src/archetype-human-evaluation/index.js";

export const UI_VERSION = "face-lab-independent-human-cue-review-ui-ko-20260814-v1";
export const UI_AUTHORITY_SCHEMA_VERSION = "face-lab-independent-human-cue-review-ui-distribution-authority-v1";
export const EXECUTION_CANDIDATE_SCHEMA_VERSION = "face-lab-independent-human-cue-execution-candidate-response-v1";
export const EXPECTED_SOURCE_MAIN_SHA = "61d9d40db0f7fdac9aa2db1b68cad259f11e6ec0";
export const EXPECTED_PACKET_AUTHORITY_DIGEST = "1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c";
export const EXPECTED_PRIVATE_MAP_DIGEST = "628f7e4640183fc79c6a62ae42603210481e0c565844125b5d506b9cc0cccfea";
export const EXPECTED_REVIEW_ASSET_INVENTORY_DIGEST = "851d81a70654beeefa696b40d5b5af0a06a7cefd438aefffe48eb9fc39031648";
export const EXPECTED_PACKET_FILE_INVENTORY_DIGEST = "efe10614ee2343656242dc6e777ecebf60f09b09b71e14fbfe3c08f09bb11065";
export const EXPECTED_PACKET_DIGESTS = Object.freeze({
  R01: Object.freeze({ A: "49a3454653343244aed3e9ea2f6a820c386c1cb84a89a8f4743566732293fd14", B: "874a4116328659f263d8c4d2a02361610fa610ddbc98f6795bdcd7d667b5a7e3" }),
  R02: Object.freeze({ A: "6e66cd2858b11c0327222211c45413b1f3f94bf1c053f1d15575de96fbaf3616", B: "43db87e3db994d4d6054497b15517759b9240b9593e7db2960d84ad3d64aa795" }),
  R03: Object.freeze({ A: "658d9f6032bc793d37efc78a7cd87c683bff28b8c02db37e5bcb767cf9c9f726", B: "8bb97519a8c6fff14098f862e42ae6f85474de269fcc613e00aa5ec45b96bd5e" })
});

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sortKeys = (value) => Array.isArray(value)
  ? value.map(sortKeys)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
    : value;
export const stableStringify = (value) => JSON.stringify(sortKeys(value));
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeBytes = (file, bytes) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
};
const writeJson = (file, value) => writeBytes(file, jsonBytes(value));

export const KOREAN_TOKEN_MAP = Object.freeze({
  oval: "계란형", round: "둥근형", square: "사각형", oblong: "긴 사각형", heart: "하트형", diamond: "다이아몬드형", triangle: "삼각형", mixed: "혼합형",
  soft: "부드러움", moderate: "중간", angular: "각짐",
  short: "짧음", balanced: "균형", long: "김",
  upturned: "올라감", level: "수평", downturned: "내려감",
  narrow: "좁음", medium: "중간", wide: "넓음",
  small: "작음", large: "큼",
  spread: "넓게 분포", centered: "중심부에 모임",
  curved: "곡선 우세", straight: "직선 우세",
  defined: "선명함",
  uncertain: "판단 애매", not_assessable: "판단 불가",
  low: "낮음", high: "높음", not_applicable: "해당 없음"
});

export const KOREAN_REASON_MAP = Object.freeze({
  pose: "얼굴 각도",
  occlusion: "머리카락·물체 등에 가림",
  crop: "얼굴 일부가 잘림",
  image_quality: "화질 문제",
  expression: "표정 영향",
  lighting: "조명 영향",
  makeup: "화장 영향",
  perspective: "원근·렌즈 왜곡",
  editing_or_filter: "보정 또는 필터 가능성",
  axis_specific_limitation: "이 항목 자체의 판별 한계",
  insufficient_visible_evidence: "보이는 정보가 부족함"
});

const axis = (title, shortInstruction, observableTarget, referenceFrame, valueDefinitions, neighborContrasts, ambiguityRules, notAssessableConditions, imageConditionWarnings, humanReviewerInstruction) => Object.freeze({
  title, shortInstruction, observableTarget, referenceFrame, valueDefinitions: Object.freeze(valueDefinitions), neighborContrasts: Object.freeze(neighborContrasts), ambiguityRules: Object.freeze(ambiguityRules), notAssessableConditions: Object.freeze(notAssessableConditions), imageConditionWarnings: Object.freeze(imageConditionWarnings), humanReviewerInstruction
});

export const KOREAN_AXIS_CONTENT = Object.freeze({
  "observations.outline.faceShape": axis(
    "얼굴형", "얼굴 둘레의 길이, 너비, 좁아지는 방향과 아래 윤곽을 함께 살펴보세요.",
    "보이는 얼굴 둘레를 얼굴 길이, 윗얼굴 너비, 볼 너비, 아랫얼굴 너비, 좁아지는 정도, 아래 윤곽의 방향 변화로 나누어 봅니다.",
    "보이는 얼굴 둘레와 얼굴 안의 너비 관계만 기준으로 삼습니다. 사진 틀, 헤어스타일, 인구 집단의 평균을 기준으로 삼지 않습니다.",
    { oval: "세로가 가로보다 길고 볼 부위가 가장 넓거나 공동으로 가장 넓으며, 뚜렷한 모서리 없이 둥근 아랫얼굴로 서서히 좁아집니다.", round: "세로와 가로 길이가 비슷하고 볼의 곡선이 넓으며, 아래 둘레가 둥글고 좁아짐이나 모서리가 거의 없습니다.", square: "세로와 가로 길이가 비슷하고 윗얼굴·볼·아랫얼굴 너비가 비교적 고르며, 아래 윤곽의 방향 변화가 분명합니다.", oblong: "세로가 가로보다 뚜렷하게 길고, 윗얼굴·볼·아랫얼굴 너비가 계란형처럼 좁아지지 않고 비교적 고릅니다.", heart: "윗얼굴이 아랫얼굴보다 넓고 볼 너비도 두드러지며, 아래 둘레가 더 좁은 턱 쪽으로 좁아집니다.", diamond: "볼 부위가 윗얼굴과 아랫얼굴보다 뚜렷하게 넓고 이마와 턱 양쪽으로 좁아집니다.", triangle: "아랫얼굴이 윗얼굴보다 넓고 턱 끝으로 좁아지기보다 턱 쪽으로 너비가 늘어납니다.", mixed: "둘 이상의 구성 패턴이 충돌해 하나의 얼굴형이 우세하지 않습니다. 정보 부족을 뜻하지 않습니다." },
    ["계란형과 둥근형: 세로로 긴 둘레와 점진적 좁아짐 / 세로·가로가 비슷하고 넓은 연속 곡선", "계란형과 긴 사각형: 볼에서 턱으로 점차 좁아지고 둥근 아래 둘레 / 긴 윤곽에서 너비가 비교적 고름", "둥근형과 사각형: 연속적으로 둥근 아래 둘레 / 아래 윤곽의 방향 변화와 비교적 고른 너비", "사각형과 긴 사각형: 세로·가로가 비슷함 / 세로로 길고 너비가 비교적 고름", "하트형과 다이아몬드형: 윗얼굴 너비가 우세함 / 볼 너비가 윗얼굴과 아랫얼굴보다 큼", "삼각형과 하트형: 아랫얼굴이 더 넓음 / 윗얼굴이 더 넓음", "혼합형과 판단 애매: 혼합형은 충돌하는 패턴이 실제로 보여야 하며, 판단 애매는 비교를 지지할 정보가 부족한 경우입니다."],
    ["둘레는 보이지만 인접한 패턴을 신뢰성 있게 구분할 수 없으면 판단 애매를 선택합니다.", "서로 충돌하는 구성 패턴 자체가 보일 때만 혼합형을 선택합니다."],
    ["정면이 아닌 자세", "머리카락이 많이 가림", "이마 또는 턱이 잘림", "원근 왜곡", "얼굴 둘레가 충분히 보이지 않음"],
    ["머리카락 가림", "머리 자세", "렌즈 원근", "잘림", "턱 너비를 바꾸는 표정"],
    "이름 붙은 구성 관계를 먼저 확인한 뒤 얼굴형을 고릅니다. 막연한 전체 인상만으로 분류하지 않습니다."
  ),
  "observations.outline.jawlineAngularity": axis(
    "턱선의 각진 정도", "아랫얼굴 옆선부터 턱으로 이어지는 윤곽의 굽음과 방향 변화를 보세요.",
    "아랫얼굴 옆선에서 턱으로 이어지는 하악 윤곽에서 보이는 곡률과 방향 변화를 봅니다.",
    "수평에 가까운 정면 자세와 고른 조명에서 보이는 아랫얼굴 실루엣을 사용합니다. 그림자 농도나 얼굴의 마름이 아니라 형태를 판단합니다.",
    { soft: "아랫얼굴 윤곽이 둥근 전환으로 서서히 방향을 바꾸며, 뚜렷하게 우세한 턱 모서리가 없습니다.", moderate: "아랫얼굴 윤곽에 보이지만 지배적이지 않은 방향 변화가 있어, 완만한 곡선과 뚜렷한 모서리의 중간에 있습니다.", angular: "그림자 농도와 무관하게 뚜렷한 모서리나 급격한 방향 변화가 보입니다." },
    ["부드러움과 중간: 완만하고 연속적인 곡선 / 국소적으로 보이는 방향 변화", "중간과 각짐: 보이지만 약한 방향 변화 / 분명히 우세한 모서리나 급격한 전환"],
    ["조명이나 일부 가림 때문에 실제 모서리와 그림자 경계를 나눌 수 없으면 판단 애매를 선택합니다."],
    ["턱이 머리카락이나 수염에 가림", "정면이 아닌 자세", "아랫얼굴이 잘림", "강한 방향성 그림자", "과도한 보정"],
    ["조명", "수염", "머리카락 가림", "자세", "보정"],
    "보이는 아랫얼굴 둘레를 따라가며 방향 변화를 분류합니다. 어두움, 마름, 헤어스타일을 결정 신호로 쓰지 않습니다."
  ),
  "observations.vertical.faceLengthBalance": axis(
    "얼굴 길이 비율", "같은 얼굴 안에서 보이는 세로 길이와 넓은 볼 부위의 너비를 비교하세요.",
    "윗얼굴 경계부터 턱까지 보이는 세로 길이를 같은 얼굴의 넓은 볼 부위와 비교합니다.",
    "얼굴 자체의 보이는 세로 길이와 볼 너비를 사용합니다. 사진의 프레임은 기준이 아닙니다.",
    { short: "넓은 볼 부위에 비해 보이는 세로 길이가 덜 두드러져 세로 비율이 압축되어 보입니다.", balanced: "얼굴 안 비율에서 보이는 세로 길이와 볼 너비 어느 쪽도 뚜렷하게 우세하지 않습니다.", long: "볼 너비에 비해 보이는 세로 길이가 두드러져 세로 비율이 길게 보입니다." },
    ["짧음과 균형: 세로 길이가 뚜렷하게 덜 두드러짐 / 어느 쪽도 뚜렷하게 우세하지 않음", "균형과 김: 어느 쪽도 뚜렷하게 우세하지 않음 / 세로 길이가 뚜렷하게 우세함"],
    ["윗얼굴 경계가 일부만 보이지만 얼굴 안 비율은 고려할 수 있고 범주는 확실하지 않으면 판단 애매를 선택합니다."],
    ["윗얼굴 경계가 보이지 않음", "턱이 잘림", "머리의 위아래 기울기가 큼", "원근 왜곡", "얼굴 둘레가 가려짐"],
    ["헤어라인 가시성", "턱 가시성", "머리의 위아래 기울기", "렌즈 원근", "잘림"],
    "같은 얼굴의 보이는 높이와 볼 너비를 비교합니다. 사진 프레임이나 인구 집단 평균과 비교하지 않습니다."
  ),
  "observations.eyes.eyeDirection": axis(
    "눈꼬리 방향", "각 눈의 안쪽 눈꼬리와 바깥쪽 눈꼬리의 높이를 비교하세요.",
    "각 눈에서 바깥쪽 눈꼬리가 안쪽 눈꼬리보다 위인지 아래인지 봅니다.",
    "정면이고 수평이며 중립 표정인 이미지에서 각 눈의 안쪽부터 바깥쪽 눈꼬리를 봅니다.",
    { upturned: "판단 가능한 두 눈 모두 바깥쪽 눈꼬리가 안쪽보다 뚜렷하게 높습니다.", level: "판단 가능한 두 눈 모두 바깥쪽 눈꼬리의 위아래 이동이 뚜렷하지 않습니다.", downturned: "판단 가능한 두 눈 모두 바깥쪽 눈꼬리가 안쪽보다 뚜렷하게 낮습니다.", mixed: "판단 가능한 두 눈이 서로 반대 방향이거나 한쪽은 방향성이 있고 다른 쪽은 수평인 등, 의미 있게 다른 방향 패턴을 보입니다." },
    ["올라감과 수평: 바깥쪽이 뚜렷하게 높음 / 위아래 이동이 뚜렷하지 않음", "수평과 내려감: 위아래 이동이 뚜렷하지 않음 / 바깥쪽이 뚜렷하게 낮음", "한 방향과 좌우 다름: 두 눈이 한 패턴을 지지함 / 두 눈이 서로 다른 패턴을 지지함"],
    ["두 눈꼬리가 보이지만 높이 관계를 신뢰성 있게 구분할 수 없으면 판단 애매를 선택합니다."],
    ["한쪽 또는 양쪽 눈꼬리가 가림", "정면이 아닌 자세", "머리가 좌우로 기울어짐", "표정이 눈꼬리를 왜곡함", "선명도가 부족함"],
    ["머리의 좌우 기울기", "좌우 회전", "표정", "아이라이너", "머리카락 가림"],
    "각 눈의 안쪽과 바깥쪽 눈꼬리 관계를 판단합니다. 눈썹 방향을 결정 신호로 쓰지 않습니다."
  ),
  "observations.eyes.eyeOpenness": axis(
    "눈 뜬 정도", "같은 눈의 가로 길이에 비해 위아래 눈꺼풀 사이가 얼마나 열려 있는지 보세요.",
    "가로 눈 길이와 분리해, 위아래 눈꺼풀 가장자리 사이의 보이는 세로 개방 정도를 봅니다.",
    "각 눈의 가로 길이와 조심스럽게 확인한 홍채·흰자 노출을 같은 눈 안에서 기준으로 삼습니다.",
    { narrow: "같은 눈의 가로 길이에 비해 세로 눈꺼풀 틈이 뚜렷하게 좁고, 홍채나 흰자 노출도 그 개방 정도와 일치합니다.", medium: "같은 눈의 가로 길이에 비해 세로 개방이 뚜렷하게 좁지도 넓지도 않습니다.", wide: "같은 눈의 가로 길이에 비해 세로 눈꺼풀 틈이 뚜렷하게 넓고, 홍채나 흰자 노출도 그 개방 정도와 일치합니다." },
    ["좁음과 중간: 개방이 뚜렷하게 압축됨 / 좁지도 넓지도 않음", "중간과 넓음: 좁지도 넓지도 않음 / 개방이 뚜렷하게 넓음"],
    ["표정이나 눈꺼풀 위치가 일시적일 수 있지만 일부 해석은 가능하면 판단 애매를 선택합니다."],
    ["눈이 일부 감김", "중립 표정이 아님", "눈이 가림", "정면이 아닌 자세", "선명도가 부족함"],
    ["표정", "깜박임 상태", "좌우 회전", "아이라이너", "선명도"],
    "같은 눈의 가로 길이에 대한 세로 개방을 판단합니다. 가로 눈 길이 자체를 이 범주로 대신하지 않습니다."
  ),
  "observations.featureLayout.featureScale": axis(
    "이목구비 크기", "눈·눈썹·코·입술을 각각 본 뒤 같은 얼굴 안에서 종합하세요.",
    "눈, 눈썹, 코, 입술의 보이는 크기를 각각 판단한 뒤 같은 얼굴에 대한 크기로 종합합니다.",
    "같은 얼굴 둘레를 공통 기준으로 사용합니다. 광대뼈와 턱선은 이 버전의 크기 종합에서 제외합니다.",
    { small: "판단 가능한 구성 이목구비 대부분이 같은 얼굴에 비해 시각적으로 작아 보입니다.", medium: "판단 가능한 구성 이목구비 대부분이 같은 얼굴에 비해 뚜렷하게 작지도 크지도 않습니다.", large: "판단 가능한 구성 이목구비 대부분이 같은 얼굴에 비해 시각적으로 크게 두드러집니다.", mixed: "판단 가능한 이목구비들이 서로 의미 있게 다른 크기 범주를 지지합니다. 혼합형은 판단 애매가 아닙니다." },
    ["작음과 중간: 대부분이 뚜렷하게 작음 / 대부분 중간", "중간과 큼: 대부분 중간 / 대부분 뚜렷하게 큼", "한 범주와 혼합형: 구성 요소가 대체로 일치 / 서로 의미 있게 다른 크기 범주를 지지"],
    ["신뢰할 수 있는 이목구비가 너무 적거나 경계선의 요소들이 일치 또는 이질성을 확립하지 못하면 판단 애매를 선택합니다."],
    ["얼굴 둘레를 확인할 수 없음", "여러 중심 이목구비가 가림", "강한 원근", "표정이 이목구비를 왜곡함", "선명도가 부족함"],
    ["원근", "표정", "화장", "가림", "잘림"],
    "눈, 눈썹, 코, 입술을 따로 판단한 뒤 종합합니다. 광대뼈나 턱선은 포함하지 않고, 혼합형을 불확실성 대신 쓰지 않습니다."
  ),
  "observations.featureLayout.featureConcentration": axis(
    "이목구비 집중도", "눈·눈썹·코·입술이 얼굴 중심과 둘레 사이에 어떻게 분포하는지 보세요.",
    "눈, 눈썹, 코, 입술이 보이는 얼굴 중심과 둘레를 기준으로 공간에 어떻게 분포하는지 봅니다.",
    "정면이고 수평인 자세에서 보이는 얼굴 둘레의 중점을 사용합니다. 이목구비 크기는 결정 신호가 아닙니다.",
    { spread: "주요 중심 이목구비들이 보이는 얼굴의 더 넓은 부분을 차지하며 얼굴 중심에서 더 멀리 놓입니다.", balanced: "주요 중심 이목구비가 뚜렷하게 넓게 퍼지지도 중심에 모이지도 않습니다.", centered: "주요 중심 이목구비들이 얼굴 중심 가까이에 모여 주변 얼굴 영역이 더 많이 남습니다." },
    ["넓게 분포와 균형: 넓은 분포가 뚜렷하게 우세 / 넓은 분포와 중심 집중 어느 쪽도 우세하지 않음", "균형과 중심부에 모임: 어느 쪽도 우세하지 않음 / 중심 집중이 뚜렷하게 우세"],
    ["자세나 얼굴 둘레의 가시성 때문에 안정적으로 중심을 판단할 수 없거나 이목구비 위치가 서로 충돌하면 판단 애매를 선택합니다."],
    ["정면이 아닌 자세", "얼굴 둘레를 확인할 수 없음", "중심 이목구비가 가림", "강한 원근", "잘림"],
    ["좌우 회전", "렌즈 원근", "잘림", "표정", "가림"],
    "같은 얼굴의 중심과 둘레에 대한 이목구비 위치를 판단합니다. 이목구비 크기나 얼굴이 좁다는 사실만으로 집중도를 추정하지 않습니다."
  ),
  "observations.visualLanguage.straightCurveBalance": axis(
    "직선·곡선 균형", "눈썹, 눈, 코, 턱선, 입술에서 보이는 직선과 곡선의 우세를 함께 보세요.",
    "눈썹, 눈의 열린 윤곽, 콧대나 코 가장자리, 턱선, 입술 윤곽에서 보이는 곡선과 직선 형태의 균형을 봅니다.",
    "정해진 얼굴 구조만 각각 판단합니다. 헤어스타일, 옷, 배경, 화장 그래픽은 제외합니다.",
    { curved: "판단 가능한 구성 구조 전반에서 곡선 형태가 눈에 띄게 우세합니다.", balanced: "판단 가능한 구성 구조에 곡선과 직선이 모두 보이고 어느 쪽도 일관되게 우세하지 않습니다.", straight: "판단 가능한 구성 구조 전반에서 직선 또는 방향성이 뚜렷한 형태가 눈에 띄게 우세합니다." },
    ["곡선 우세와 균형: 곡선이 일관되게 우세 / 어느 쪽도 일관되게 우세하지 않음", "균형과 직선 우세: 어느 쪽도 일관되게 우세하지 않음 / 직선이 일관되게 우세"],
    ["구성 요소가 보이지만 너무 충돌하거나 경계에 있어 우세를 정할 수 없으면 판단 애매를 선택합니다. 균형은 판단 부족이 아니라 근거가 있는 혼합이어야 합니다."],
    ["대부분의 구성 구조가 가림", "정면이 아닌 자세", "진한 화장이 선의 모양을 바꿈", "표정이 윤곽을 바꿈", "선명도가 부족함"],
    ["화장", "표정", "자세", "가림", "보정"],
    "정해진 얼굴 구조만 봅니다. 균형은 곡선과 직선 근거가 모두 보여야 하며, 판단 애매는 근거가 균형을 지지하지 못하는 경우입니다."
  ),
  "observations.eyes.eyeLength": axis(
    "눈 가로 길이", "눈을 뜬 세로 정도와 구분해 안쪽부터 바깥쪽까지의 가로 길이를 보세요.",
    "세로 개방과 구분해, 보이는 눈의 안쪽과 바깥쪽 끝점 사이 가로 길이를 봅니다.",
    "같은 얼굴 너비와 주변 중심 이목구비 크기 안에서 두 눈을 봅니다. 아직 하나의 검증된 기준만 우세하지는 않습니다.",
    { short: "눈을 뜬 가로 길이가 같은 얼굴 너비와 주변 이목구비 맥락에서 짧아 보입니다.", medium: "눈을 뜬 가로 길이가 같은 얼굴 안에서 뚜렷하게 짧지도 길지도 않습니다.", long: "눈을 뜬 가로 길이가 같은 얼굴 너비와 주변 이목구비 맥락에서 길게 두드러집니다." },
    ["짧음과 중간: 가로 길이가 뚜렷하게 짧음 / 짧지도 길지도 않음", "중간과 김: 짧지도 길지도 않음 / 가로 길이가 뚜렷하게 김"],
    ["가능한 기준들이 서로 다르거나 가로 끝점은 보이지만 범주를 신뢰성 있게 나누기 어려우면 판단 애매를 선택합니다."],
    ["눈의 끝점이 가림", "정면이 아닌 자세", "강한 원근", "선명도가 부족함", "한쪽 눈이 보이지 않음"],
    ["좌우 회전", "원근", "아이라이너", "가림", "선명도"],
    "가로 길이만 판단합니다. 세로로 눈을 뜬 정도를 눈 길이 대신 쓰지 말고, 같은 얼굴 안의 기준들이 다르면 판단 애매를 선택합니다."
  ),
  "observations.visualLanguage.contourDefinition": axis(
    "얼굴 윤곽 선명도", "사진 효과를 제외하고 얼굴 둘레, 턱선, 볼 전환 경계가 얼마나 이어져 보이는지 보세요.",
    "사진의 가장자리 강화 효과와 구조 근거를 분리한 뒤, 얼굴 둘레·턱선 경계·볼 전환의 가시성과 기하학적 연속성을 봅니다.",
    "고른 조명과 안정적인 선명도에서 이름 붙은 얼굴 경계를 사용하고, 이미지 조건 근거는 따로 기록합니다.",
    { soft: "이미지 조건이 적절할 때 이름 붙은 구조 경계가 서서히 전환되고 강하게 구분되지 않습니다.", moderate: "이름 붙은 구조 경계가 보이고 국소적으로 구분되지만 전반적으로 강하게 구분되지는 않습니다.", defined: "강한 그림자나 선명화 인공물에 기대지 않고 여러 판단 가능 부위에서 구조 경계가 분명하게 이어집니다." },
    ["부드러움과 중간: 경계가 서서히 전환 / 국소적인 구분이 보임", "중간과 선명함: 국소적인 구분 / 여러 부위에서 분명한 구분"],
    ["구조적 경계와 사진 효과로 생긴 경계를 신뢰성 있게 분리할 수 없으면 판단 애매를 선택합니다."],
    ["고르지 않거나 강한 조명", "흐림 또는 과도한 선명화", "진한 윤곽 화장", "보정 가능성", "이름 붙은 경계가 가림"],
    ["조명", "대비", "선명도", "편집", "화장"],
    "이름 붙은 얼굴 경계만 사용하고, 구조적 선명함을 그림자·화장·대비·선명화 효과와 분리합니다."
  )
});

export const ATTESTATION_COPY = Object.freeze({
  generationTargetKnown: "이 이미지들이 어떤 특성을 의도해서 만들어졌는지 모릅니다.",
  generationPromptSeen: "이미지 제작에 사용된 지시문이나 설명을 본 적이 없습니다.",
  subtleModerateConditionKnown: "이미지들이 어떤 조건 그룹으로 나뉘는지 모릅니다.",
  archetypeTargetKnown: "각 이미지에 의도된 유형을 모릅니다.",
  visionObservationSeen: "AI가 이 이미지들을 어떻게 분석했는지 본 적이 없습니다.",
  shadowScoringSeen: "자동 점수나 순위 결과를 본 적이 없습니다.",
  peerJudgmentsSeen: "다른 참여자의 응답을 보지 않았습니다.",
  consensusSeen: "다른 참여자의 합의 결과를 보지 않았고 혼자 평가하겠습니다."
});

export function isStructurallyValidJudgment(judgment, enumOptions) {
  if (!judgment || !Array.isArray(enumOptions)) return false;
  if (judgment.response === "not_assessable") {
    return judgment.confidence === "not_applicable" &&
      Array.isArray(judgment.notAssessableReasonCodes) && judgment.notAssessableReasonCodes.length > 0;
  }
  if (judgment.response === "uncertain") return ["low", "medium"].includes(judgment.confidence);
  return enumOptions.includes(judgment.response) && ["low", "medium", "high"].includes(judgment.confidence) &&
    Array.isArray(judgment.notAssessableReasonCodes) && judgment.notAssessableReasonCodes.length === 0;
}

const parseArgs = (argv = process.argv.slice(2)) => {
  const pairs = {};
  for (let index = 0; index < argv.length; index += 2) {
    assert.match(argv[index] || "", /^--[a-z-]+$/);
    assert.ok(argv[index + 1], `missing value for ${argv[index]}`);
    pairs[argv[index].slice(2)] = argv[index + 1];
  }
  return pairs;
};

const recursiveInventory = (root) => readdirSync(root, { recursive: true })
  .filter((relativePath) => statSync(path.join(root, relativePath)).isFile())
  .map((relativePath) => {
    const bytes = readFileSync(path.join(root, relativePath));
    return { relativePath: relativePath.split(path.sep).join("/"), sha256: sha256(bytes), byteLength: bytes.length };
  })
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

const loadSource = (sourceRoot) => {
  const authority = readJson(path.join(sourceRoot, "private", "packet-authority-v1.json"));
  const privateMap = readJson(path.join(sourceRoot, "private", "human-cue-private-map-v1.json"));
  const assetInventory = readJson(path.join(sourceRoot, "private", "review-asset-inventory-v1.json"));
  const packetInventory = readJson(path.join(sourceRoot, "private", "reviewer-packet-file-inventory-v1.json"));
  assert.equal(authority.authorityDigest, EXPECTED_PACKET_AUTHORITY_DIGEST, "sealed packet authority mismatch");
  assert.equal(authority.reviewItemPrivateMapDigest, EXPECTED_PRIVATE_MAP_DIGEST, "private map mismatch");
  assert.equal(authority.reviewAssetInventoryDigest, EXPECTED_REVIEW_ASSET_INVENTORY_DIGEST, "review asset inventory mismatch");
  assert.equal(authority.reviewerPacketFileInventoryDigest, EXPECTED_PACKET_FILE_INVENTORY_DIGEST, "packet file inventory mismatch");
  assert.deepEqual(authority.reviewerPacketDigests, EXPECTED_PACKET_DIGESTS, "reviewer packet digests mismatch");
  assert.equal(privateMap.mapDigest, EXPECTED_PRIVATE_MAP_DIGEST);
  assert.equal(assetInventory.inventoryDigest, EXPECTED_REVIEW_ASSET_INVENTORY_DIGEST);
  assert.equal(packetInventory.inventoryDigest, EXPECTED_PACKET_FILE_INVENTORY_DIGEST);
  assert.equal(authority.humanJudgments, 0);
  return { authority, assetInventory };
};

const htmlEscapeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");

export function renderReviewHtml(model) {
  const embedded = htmlEscapeJson(model);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>얼굴 특징 판별 테스트</title>
<style>
:root{color-scheme:light;--ink:#17202a;--muted:#667085;--line:#d9dee7;--paper:#fff;--soft:#f5f7fa;--brand:#0f766e;--brand2:#115e59;--warn:#b42318;--focus:#2563eb}*{box-sizing:border-box}body{margin:0;background:#eef2f5;color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif;line-height:1.55}button,input{font:inherit}button{min-height:44px}.shell{max-width:1480px;margin:auto;padding:24px}.card{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:0 10px 30px rgba(16,24,40,.06)}.start{max-width:850px;margin:28px auto;padding:36px}.eyebrow{color:var(--brand);font-weight:800;letter-spacing:.04em}.start h1{font-size:clamp(28px,4vw,42px);line-height:1.2;margin:6px 0 18px}.lead{font-size:18px}.rules{padding:18px 22px;background:var(--soft);border-radius:14px}.attest{display:grid;gap:10px;margin:20px 0}.attest label,.reason{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:12px;cursor:pointer}.attest input,.reason input{width:20px;height:20px;flex:0 0 auto}.primary,.secondary{border:0;border-radius:12px;padding:11px 18px;font-weight:800;cursor:pointer}.primary{color:#fff;background:var(--brand)}.primary:hover{background:var(--brand2)}.primary:disabled{background:#aab4c0;cursor:not-allowed}.secondary{background:#e8eeef;color:#24323a}.app-grid{display:grid;grid-template-columns:minmax(380px,48%) minmax(0,52%);gap:22px;align-items:start}.visual{position:sticky;top:18px;padding:20px}.visual-head,.panel-head,.nav{display:flex;justify-content:space-between;gap:12px;align-items:center}.visual img{display:block;width:100%;max-height:70vh;object-fit:contain;background:#e8ecef;border-radius:14px;margin:14px 0}.reminder{padding:14px;background:#f0fdfa;border-left:4px solid var(--brand);border-radius:10px}.panel{padding:22px;min-width:0}.progress-track{height:10px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin:12px 0 20px}.progress-bar{height:100%;background:var(--brand);transition:width .2s}.axis-list{display:grid;gap:16px}.axis-card{padding:18px;border:1px solid var(--line);border-radius:15px}.axis-card h2{font-size:20px;margin:0 0 4px}.axis-card p{margin:0 0 12px;color:#475467}.label{font-size:14px;font-weight:800;margin:14px 0 7px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid #aeb7c2;border-radius:999px;background:#fff;padding:8px 14px;cursor:pointer}.chip[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:800}.chip:focus-visible,.primary:focus-visible,.secondary:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:2px}.reasons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.reason{padding:9px;font-size:14px}.details{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}summary{cursor:pointer;color:var(--brand2);font-weight:800}.detail-block{margin-top:12px;padding:14px;background:var(--soft);border-radius:12px}.detail-block h3{font-size:15px;margin:12px 0 5px}.detail-block ul{margin:5px 0;padding-left:22px}.value-def{margin:7px 0}.error{min-height:24px;color:var(--warn);font-weight:800;margin:12px 0}.nav{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}.hidden{display:none!important}.done{text-align:center;padding:36px}.done h1{font-size:32px}@media(max-width:900px){.shell{padding:12px}.app-grid{grid-template-columns:1fr}.visual{position:static}.visual img{max-height:55vh}.reasons{grid-template-columns:1fr}.start{padding:24px;margin:8px auto}}
</style>
</head>
<body>
<main class="shell"><section id="start" class="card start"></section><section id="review" class="app-grid hidden"><aside class="card visual"><div class="visual-head"><strong id="photo-count"></strong><span id="item-label"></span></div><img id="review-image" alt="평가할 얼굴 사진"><div class="reminder">전체 인상이나 닮은꼴이 아니라, 각 문항에서 지정한 얼굴 부분과 기준만 보고 판단해 주세요.</div></aside><section class="card panel"><div class="panel-head"><strong id="part-label"></strong><span id="part-progress"></span></div><div class="progress-track" aria-hidden="true"><div id="progress-bar" class="progress-bar"></div></div><div id="axis-list" class="axis-list"></div><div id="error" class="error" role="alert"></div><nav class="nav"><button id="prev" class="secondary" type="button">이전 사진</button><button id="next" class="primary" type="button">다음 사진</button></nav></section></section><section id="done" class="card done hidden"></section></main>
<script>
"use strict";
const DATA=${embedded};
const TOKEN_LABELS=DATA.tokenLabels;
const STORAGE_KEY=["face-lab-review-ui",DATA.protocolVersion,DATA.reviewerSlot,DATA.packetDigests.A,DATA.packetDigests.B].join("::");
const byId=(id)=>document.getElementById(id);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node};
const makeSessionId=()=>"hcs_ui_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,12);
const blankState=()=>({uiVersion:DATA.uiVersion,sessionId:makeSessionId(),attested:false,partIndex:0,imageIndex:0,judgments:{}});
let state=loadState();
function loadState(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));if(parsed&&parsed.uiVersion===DATA.uiVersion&&parsed.judgments)return parsed}catch{}return blankState()}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function judgmentKey(part,itemId,axisPath){return [part,itemId,axisPath].join("|")}
function getJudgment(part,itemId,axisPath){const key=judgmentKey(part,itemId,axisPath);if(!state.judgments[key])state.judgments[key]={reviewItemId:itemId,axisPath,response:null,confidence:null,evidenceTags:[],notAssessableReasonCodes:[]};return state.judgments[key]}
function isValid(j){if(j.response==="not_assessable")return j.confidence==="not_applicable"&&j.notAssessableReasonCodes.length>0;if(j.response==="uncertain")return ["low","medium"].includes(j.confidence);return j.response!==null&&["low","medium","high"].includes(j.confidence)}
function addHeading(parent,level,text){const node=el("h"+level,text);parent.append(node)}
function renderStart(){const root=byId("start");root.replaceChildren();root.append(el("div","오프라인 독립 평가","eyebrow"));addHeading(root,1,"얼굴 특징 판별 테스트");root.append(el("p","이 테스트는 얼굴 사진에서 눈에 보이는 형태와 구조의 특징을 기준에 따라 분류하는 작업입니다. 정답을 맞히는 시험은 아닙니다.","lead"));root.append(el("p","전체적인 인상이나 닮은꼴보다 각 문항에서 지정한 얼굴 부분과 기준만 보고 판단해 주세요."));const rules=el("div",undefined,"rules");addHeading(rules,2,"평가 원칙");const list=el("ul");["성격이나 분위기를 추측하지 않습니다.","나이, 성별, 인종 등의 외모 평가를 하지 않습니다.","고정관념이나 이상형을 판단 기준으로 사용하지 않습니다.","다른 참여자의 답을 보거나 상의하지 않습니다.","불확실하면 억지로 범주를 고르지 않습니다."].forEach(x=>list.append(el("li",x)));rules.append(list);addHeading(rules,3,"판단 애매");rules.append(el("p","얼굴 특징은 보이지만 인접한 범주 중 하나를 신뢰성 있게 고르기 어려운 경우입니다."));addHeading(rules,3,"판단 불가");rules.append(el("p","가림, 각도, 조명, 화질 등의 이유로 해당 특징 자체를 충분히 볼 수 없는 경우입니다."));root.append(rules);addHeading(root,2,"독립 평가 확인");root.append(el("p","아래 내용을 모두 확인해야 시작할 수 있습니다. 실명은 수집하지 않습니다."));const box=el("div",undefined,"attest");Object.entries(DATA.attestationCopy).forEach(([key,text])=>{const label=el("label");const input=el("input");input.type="checkbox";input.dataset.attestation=key;label.append(input,el("span",text));box.append(label)});root.append(box);const startButton=el("button","평가 시작","primary");startButton.type="button";startButton.disabled=true;box.addEventListener("change",()=>{startButton.disabled=!Array.from(box.querySelectorAll("input")).every(x=>x.checked)});startButton.addEventListener("click",()=>{state.attested=true;saveState();showReview()});root.append(startButton);if(state.attested)root.append(el("p","이 브라우저에 저장된 진행 상황이 있습니다. 평가 시작을 누르면 이어서 진행합니다."))}
function appendDetails(card,axis){const details=el("details",undefined,"details");details.append(el("summary","기준 자세히 보기"));const body=el("div",undefined,"detail-block");addHeading(body,3,"무엇을 보는지");body.append(el("p",axis.content.observableTarget));addHeading(body,3,"얼굴 안 기준");body.append(el("p",axis.content.referenceFrame));addHeading(body,3,"선택지 기준");Object.entries(axis.content.valueDefinitions).forEach(([token,text])=>{const p=el("p",undefined,"value-def");const strong=el("strong",TOKEN_LABELS[token]+": ");p.append(strong,document.createTextNode(text));body.append(p)});addHeading(body,3,"비슷한 선택지 구분");const contrasts=el("ul");axis.content.neighborContrasts.forEach(x=>contrasts.append(el("li",x)));body.append(contrasts);addHeading(body,3,"판단 애매 기준");const ambiguous=el("ul");axis.content.ambiguityRules.forEach(x=>ambiguous.append(el("li",x)));body.append(ambiguous);addHeading(body,3,"판단 불가 기준");const impossible=el("ul");axis.content.notAssessableConditions.forEach(x=>impossible.append(el("li",x)));body.append(impossible);addHeading(body,3,"주의할 이미지 조건");body.append(el("p",axis.content.imageConditionWarnings.join(", ")));addHeading(body,3,"검토 안내");body.append(el("p",axis.content.humanReviewerInstruction));details.append(body);card.append(details)}
function responseButton(j,token,rerender){const button=el("button",TOKEN_LABELS[token],"chip");button.type="button";button.setAttribute("aria-pressed",String(j.response===token));button.addEventListener("click",()=>{j.response=token;j.notAssessableReasonCodes=[];if(token==="not_assessable")j.confidence="not_applicable";else if(token==="uncertain"&&j.confidence==="high")j.confidence=null;else if(j.confidence==="not_applicable")j.confidence=null;saveState();rerender()});return button}
function renderAxis(axis,index,part,item){const j=getJudgment(part,item.reviewItemId,axis.axisPath);const card=el("article",undefined,"axis-card");addHeading(card,2,(index+1)+". "+axis.content.title);card.append(el("p",axis.content.shortInstruction));card.append(el("div","응답","label"));const responses=el("div",undefined,"chips");[...axis.enumOptions,"uncertain","not_assessable"].forEach(token=>responses.append(responseButton(j,token,renderPage)));card.append(responses);if(j.response&&j.response!=="not_assessable"){card.append(el("div","확신도","label"));const confidence=el("div",undefined,"chips");const levels=j.response==="uncertain"?["low","medium"]:["low","medium","high"];levels.forEach(token=>{const button=el("button",TOKEN_LABELS[token],"chip");button.type="button";button.setAttribute("aria-pressed",String(j.confidence===token));button.addEventListener("click",()=>{j.confidence=token;saveState();renderPage()});confidence.append(button)});card.append(confidence)}if(j.response==="not_assessable"){card.append(el("div","판단 불가 이유(하나 이상 선택)","label"));const reasons=el("div",undefined,"reasons");Object.entries(DATA.reasonLabels).forEach(([code,text])=>{const label=el("label",undefined,"reason");const input=el("input");input.type="checkbox";input.checked=j.notAssessableReasonCodes.includes(code);input.addEventListener("change",()=>{j.notAssessableReasonCodes=input.checked?[...j.notAssessableReasonCodes,code]:j.notAssessableReasonCodes.filter(x=>x!==code);saveState();renderPage()});label.append(input,el("span",text));reasons.append(label)});card.append(reasons)}appendDetails(card,axis);return card}
function current(){const part=state.partIndex===0?"A":"B";const packet=DATA.parts[part];const item=packet.items[state.imageIndex];return {part,packet,item}}
function renderPage(){const {part,packet,item}=current();byId("photo-count").textContent="사진 "+(state.imageIndex+1)+" / "+packet.items.length;byId("item-label").textContent="항목 "+String(state.imageIndex+1).padStart(2,"0");byId("part-label").textContent=part==="A"?"첫 번째 평가":"두 번째 평가";byId("part-progress").textContent=(state.imageIndex+1)+" / "+packet.items.length;byId("progress-bar").style.width=(((state.imageIndex+1)/packet.items.length)*100)+"%";byId("review-image").src=item.assetRelativePath;const list=byId("axis-list");list.replaceChildren(...packet.axes.map((axis,index)=>renderAxis(axis,index,part,item)));byId("error").textContent="";const prev=byId("prev");prev.disabled=state.partIndex===0&&state.imageIndex===0;const next=byId("next");next.textContent=state.partIndex===1&&state.imageIndex===packet.items.length-1?"평가 결과 저장":"다음 사진";next.disabled=false}
function validateCurrent(){const {part,packet,item}=current();return packet.axes.every(axis=>isValid(getJudgment(part,item.reviewItemId,axis.axisPath)))}
function previous(){if(state.imageIndex>0)state.imageIndex-=1;else if(state.partIndex>0){state.partIndex-=1;state.imageIndex=DATA.parts.A.items.length-1}saveState();renderPage();window.scrollTo(0,0)}
function next(){if(!validateCurrent()){byId("error").textContent="현재 사진의 모든 문항에서 응답과 필요한 확신도 또는 이유를 선택해 주세요.";return}const {packet}=current();if(state.imageIndex<packet.items.length-1)state.imageIndex+=1;else if(state.partIndex===0){state.partIndex=1;state.imageIndex=0}else{return exportCandidate()}saveState();renderPage();window.scrollTo(0,0)}
function orderedJudgments(){const out=[];for(const part of ["A","B"]){for(const item of DATA.parts[part].items){for(const axis of DATA.parts[part].axes)out.push(getJudgment(part,item.reviewItemId,axis.axisPath))}}return out}
function exportCandidate(){const judgments=orderedJudgments();if(!judgments.every(isValid)){byId("error").textContent="아직 완료되지 않은 문항이 있습니다.";return}const result={schemaVersion:DATA.executionCandidateSchemaVersion,responseType:"execution_candidate_response",uiVersion:DATA.uiVersion,protocolVersion:DATA.protocolVersion,reviewerSlot:DATA.reviewerSlot,packetDigests:DATA.packetDigests,reviewSessionId:state.sessionId,independenceAttestation:Object.fromEntries(Object.keys(DATA.attestationCopy).map(key=>[key,false])),judgments,completionTimestamp:new Date().toISOString()};const blob=new Blob([JSON.stringify(result,null,2)+"\\n"],{type:"application/json"});const url=URL.createObjectURL(blob);const link=el("a");link.href=url;link.download="review-response-"+DATA.reviewerSlot+".json";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);byId("review").classList.add("hidden");const done=byId("done");done.classList.remove("hidden");done.replaceChildren(el("h1","평가 결과를 저장했습니다."),el("p","다운로드된 응답 파일을 지정된 전달 절차에 따라 제출해 주세요. 이 파일은 아직 최종 사람 평가 권위가 아닌 실행 후보 응답입니다."))}
function showReview(){byId("start").classList.add("hidden");byId("review").classList.remove("hidden");renderPage()}
byId("prev").addEventListener("click",previous);byId("next").addEventListener("click",next);renderStart();if(state.attested)showReview();
</script>
</body>
</html>\n`;
}

const buildModel = ({ reviewerSlot, manifests, definitions }) => ({
  uiVersion: UI_VERSION,
  executionCandidateSchemaVersion: EXECUTION_CANDIDATE_SCHEMA_VERSION,
  protocolVersion: FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.protocolVersion,
  reviewerSlot,
  packetDigests: { A: manifests.A.packetDigest, B: manifests.B.packetDigest },
  tokenLabels: KOREAN_TOKEN_MAP,
  reasonLabels: KOREAN_REASON_MAP,
  attestationCopy: ATTESTATION_COPY,
  parts: Object.fromEntries(["A", "B"].map((part) => [part, {
    definitionProjectionDigest: manifests[part].definitionProjectionDigest,
    items: manifests[part].orderedReviewItems.map((item) => ({
      reviewItemId: item.reviewItemId,
      assetRelativePath: `assets/${path.basename(item.assetRelativePath)}`
    })),
    axes: definitions[part].axes.map((sourceAxis) => ({
      axisPath: sourceAxis.axisPath,
      enumOptions: sourceAxis.enumOptions,
      content: KOREAN_AXIS_CONTENT[sourceAxis.axisPath]
    }))
  }]))
});

export function buildDistribution({ sourceRoot, outputRoot, sourceMainSha }) {
  sourceRoot = path.resolve(sourceRoot);
  outputRoot = path.resolve(outputRoot);
  assert.equal(sourceMainSha, EXPECTED_SOURCE_MAIN_SHA, "source main SHA mismatch");
  assert.equal(existsSync(outputRoot), false, "output root already exists");
  const source = loadSource(sourceRoot);
  const beforeInventory = recursiveInventory(sourceRoot);
  const tempRoot = `${outputRoot}.tmp-${process.pid}`;
  assert.equal(existsSync(tempRoot), false, "temporary output root already exists");
  const packetBindings = {};
  try {
    for (const reviewerSlot of ["R01", "R02", "R03"]) {
      const reviewerName = `reviewer-${reviewerSlot.toLowerCase()}`;
      const sourceReviewerRoot = path.join(sourceRoot, "packets", reviewerName);
      const targetReviewerRoot = path.join(tempRoot, reviewerName);
      const manifests = {};
      const definitions = {};
      for (const part of ["A", "B"]) {
        const partRoot = path.join(sourceReviewerRoot, `part-${part.toLowerCase()}`);
        manifests[part] = readJson(path.join(partRoot, "review-manifest.json"));
        definitions[part] = readJson(path.join(partRoot, "reviewer-safe-definitions.json"));
        assert.equal(manifests[part].packetDigest, EXPECTED_PACKET_DIGESTS[reviewerSlot][part]);
        assert.equal(manifests[part].reviewerSlot, reviewerSlot);
        assert.equal(manifests[part].part, part);
        assert.equal(manifests[part].orderedReviewItems.length, 14);
        assert.equal(definitions[part].axes.length, part === "A" ? 8 : 2);
        for (const sourceAxis of definitions[part].axes) {
          assert.ok(KOREAN_AXIS_CONTENT[sourceAxis.axisPath], `Korean definition missing:${sourceAxis.axisPath}`);
          assert.deepEqual(Object.keys(KOREAN_AXIS_CONTENT[sourceAxis.axisPath].valueDefinitions), sourceAxis.enumOptions);
        }
      }
      assert.deepEqual(manifests.A.orderedReviewItems, manifests.B.orderedReviewItems, "Part item binding mismatch");
      const model = buildModel({ reviewerSlot, manifests, definitions });
      writeBytes(path.join(targetReviewerRoot, "review.html"), Buffer.from(renderReviewHtml(model), "utf8"));
      const copied = new Set();
      for (const item of manifests.A.orderedReviewItems) {
        const assetName = path.basename(item.assetRelativePath);
        if (copied.has(assetName)) continue;
        copied.add(assetName);
        const sourceAsset = path.join(sourceReviewerRoot, "assets", assetName);
        const targetAsset = path.join(targetReviewerRoot, "assets", assetName);
        mkdirSync(path.dirname(targetAsset), { recursive: true });
        copyFileSync(sourceAsset, targetAsset);
        assert.equal(sha256(readFileSync(targetAsset)), sha256(readFileSync(sourceAsset)), `asset copy mismatch:${assetName}`);
      }
      packetBindings[reviewerSlot] = {
        sourcePacketDigests: { A: manifests.A.packetDigest, B: manifests.B.packetDigest },
        definitionProjectionDigests: { A: manifests.A.definitionProjectionDigest, B: manifests.B.definitionProjectionDigest },
        orderedReviewItemIds: manifests.A.orderedReviewItems.map((item) => item.reviewItemId)
      };
    }
    const visibleEntries = recursiveInventory(tempRoot).filter((entry) => entry.relativePath.startsWith("reviewer-"));
    const reviewerDistributionDigests = Object.fromEntries(["R01", "R02", "R03"].map((slot) => {
      const prefix = `reviewer-${slot.toLowerCase()}/`;
      return [slot, sha256(stableStringify(visibleEntries.filter((entry) => entry.relativePath.startsWith(prefix))))];
    }));
    const distributionFileInventoryDigest = sha256(stableStringify(visibleEntries));
    const sourceBindings = {
      schemaVersion: "face-lab-independent-human-cue-review-ui-source-packet-bindings-v1",
      sourcePacketAuthorityDigest: source.authority.authorityDigest,
      sourcePacketDigests: EXPECTED_PACKET_DIGESTS,
      reviewerBindings: packetBindings,
      humanJudgments: 0
    };
    const authorityWithoutDigest = {
      schemaVersion: UI_AUTHORITY_SCHEMA_VERSION,
      sourceMainSha,
      sourceD2DPProtocolVersion: FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.protocolVersion,
      sourceD2DPProtocolDigest: FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.protocolDigest,
      sourcePacketAuthorityDigest: source.authority.authorityDigest,
      sourcePacketDigests: EXPECTED_PACKET_DIGESTS,
      uiVersion: UI_VERSION,
      reviewerSlots: ["R01", "R02", "R03"],
      distributionFileInventoryDigest,
      reviewerDistributionDigests,
      humanJudgments: 0
    };
    const authority = { ...authorityWithoutDigest, authorityDigest: sha256(stableStringify(authorityWithoutDigest)) };
    writeJson(path.join(tempRoot, "private", "source-packet-bindings-v1.json"), sourceBindings);
    writeJson(path.join(tempRoot, "private", "distribution-file-inventory-v1.json"), {
      schemaVersion: "face-lab-independent-human-cue-review-ui-distribution-file-inventory-v1",
      entries: visibleEntries,
      inventoryDigest: distributionFileInventoryDigest
    });
    writeJson(path.join(tempRoot, "private", "ui-distribution-authority-v1.json"), authority);
    const report = `# Korean offline Human cue review UI freeze\n\n- UI version: ${UI_VERSION}\n- Source main: ${sourceMainSha}\n- Source D2D-P authority: ${source.authority.authorityDigest}\n- Reviewer distributions: R01, R02, R03\n- Part A: 14 images x 8 axes\n- Part B: 14 images x 2 axes\n- featureContrast: excluded\n- Runtime network requests: 0\n- Human judgments: 0\n- Distribution inventory digest: ${distributionFileInventoryDigest}\n- Distribution authority digest: ${authority.authorityDigest}\n- Response boundary: execution_candidate_response; future D2D-X must validate, canonicalize, and seal.\n`;
    writeBytes(path.join(tempRoot, "reports", "korean-review-ui-freeze-report-v1.md"), Buffer.from(report, "utf8"));
    const afterInventory = recursiveInventory(sourceRoot);
    assert.deepEqual(afterInventory, beforeInventory, "sealed D2D-P source mutation detected");
    renameSync(tempRoot, outputRoot);
    return { status: "PASS", uiVersion: UI_VERSION, sourcePacketAuthorityDigest: source.authority.authorityDigest, distributionAuthorityDigest: authority.authorityDigest, distributionFileInventoryDigest, reviewerDistributionDigests, reviewerSlots: 3, imagesPerReviewer: 14, partAAxes: 8, partBAxes: 2, featureContrast: "excluded", networkRequests: 0, sourceMutationCount: 0, humanJudgments: 0, w2Status: "W2_REMAINS_LOCKED" };
  } catch (error) {
    if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs();
  assert.ok(args["source-root"], "--source-root is required");
  assert.ok(args.output, "--output is required");
  assert.ok(args["source-main-sha"], "--source-main-sha is required");
  console.log(JSON.stringify(buildDistribution({ sourceRoot: args["source-root"], outputRoot: args.output, sourceMainSha: args["source-main-sha"] }), null, 2));
}
