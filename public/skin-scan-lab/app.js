// BEJEWELY Skin Scan Lab: independent, browser-only image processing experiment.
// Licensed third-party runtime/model assets are loaded from pinned public URLs.
// No clinical disease classification, server upload, or persistent photo storage.
const MEDIAPIPE_VERSION = "0.10.35";
const VISION_MODULE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MEDIAPIPE_VERSION + "/vision_bundle.mjs";
const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MEDIAPIPE_VERSION + "/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SKIN_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const MAX_SIDE = 640;
const MAX_BYTES = 12 * 1024 * 1024;
const COLORS = {
  redness: [255, 87, 128],
  shine: [255, 188, 104],
  pores: [183, 137, 252],
  tone: [92, 187, 238],
  blemish: [255, 103, 96],
  texture: [163, 204, 215]
};
const DESCRIPTIONS = {
  mesh: ["얼굴 인식 랜드마크", "피부 문제를 표시한 것이 아니라 모델이 찾은 얼굴 좌표입니다."],
  redness: ["붉은색 분포", "피부 영역에서 상대적으로 붉은 픽셀을 표시합니다. 홍조 또는 염증 진단이 아닙니다."],
  shine: ["밝은 반사 패턴", "주변 피부보다 밝은 영역을 표시합니다. 조명 반사와 피지를 구별할 수 없습니다."],
  pores: ["미세 점 패턴", "주변보다 어두운 작은 영상 특징입니다. 개별 모공을 정확히 찾아낸 결과가 아닙니다."],
  tone: ["국소 밝기 편차", "주변 피부와 밝기가 다른 구역입니다. 그늘이나 촬영 조건의 영향을 받습니다."],
  blemish: ["트러블 유사 패턴", "붉은색·작은 암점·질감 특징의 조합입니다. 실제 여드름 위치 또는 개수를 의미하지 않습니다."],
  texture: ["피부결의 명암 변화", "작은 밝기 변화가 모인 구역입니다. 건조감이나 피부 장벽 상태를 직접 측정하지 않습니다."]
};
const $ = (id) => document.getElementById(id);
const state = {
  mode: "mesh",
  sensitivity: 55,
  face: null,
  skin: null,
  fields: null,
  photoUrl: null,
  generation: 0,
  processors: null
};
let processingPromise = null;

function setStatus(message, tone = "neutral") {
  $("status").textContent = message;
  $("statePill").textContent = tone === "error" ? "ERROR" : tone === "ok" ? "READY" : "WORKING";
}
function clearCanvas() {
  const canvas = $("overlay");
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}
function clearPrevious() {
  state.face = null;
  state.skin = null;
  state.fields = null;
  clearCanvas();
}
function setFaceMessage(message) {
  $("faceStatus").textContent = message;
}
function animateScan() {
  const beam = $("scanBeam");
  beam.classList.remove("active");
  void beam.offsetWidth;
  beam.classList.add("active");
}
function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
function quantile(sorted, percent) {
  return sorted[Math.floor((sorted.length - 1) * percent)] || 0;
}
function hasSkin() {
  return Boolean(state.fields && state.skin && state.face);
}
function setCurrentDescription() {
  const desc = DESCRIPTIONS[state.mode];
  $("findingTitle").textContent = desc[0];
  let note = desc[1];
  if (!state.face) {
    note += " 사진을 선택해야 표시됩니다.";
  } else if (state.mode !== "mesh" && !hasSkin()) {
    note += " 피부 마스크를 만들 수 없어 오버레이를 표시하지 않습니다.";
  }
  $("findingCopy").textContent = note;
}
function selectMode(mode) {
  if (!Object.hasOwn(DESCRIPTIONS, mode)) return;
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setCurrentDescription();
  renderOverlay();
}

// Uses the official Google browser SDK. Browser runs inference locally; models
// and runtime files are downloaded from Google and jsDelivr on first use.
async function getProcessors() {
  if (state.processors) return state.processors;
  if (processingPromise) return processingPromise;
  processingPromise = (async () => {
    const sdk = await import(VISION_MODULE);
    if (!sdk.FaceLandmarker || !sdk.ImageSegmenter || !sdk.FilesetResolver) {
      throw new Error("MediaPipe Vision SDK의 필요한 모듈을 찾지 못했습니다.");
    }
    const fileset = await sdk.FilesetResolver.forVisionTasks(WASM_ROOT);
    const face = await sdk.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 1
    });
    let skin = null;
    let segmentationError = null;
    try {
      skin = await sdk.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SKIN_MODEL, delegate: "CPU" },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false
      });
    } catch (error) {
      segmentationError = error;
    }
    state.processors = { face, skin, sdk, segmentationError };
    return state.processors;
  })().catch((error) => {
    processingPromise = null;
    throw error;
  });
  return processingPromise;
}

function buildIntegral(values, width, height) {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += values[(y - 1) * width + x - 1];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + row;
    }
  }
  return integral;
}
function squareMean(integral, width, height, x, y, radius) {
  const a = Math.max(0, x - radius);
  const b = Math.max(0, y - radius);
  const c = Math.min(width - 1, x + radius) + 1;
  const d = Math.min(height - 1, y + radius) + 1;
  const stride = width + 1;
  const sum = integral[d * stride + c] - integral[b * stride + c]
    - integral[d * stride + a] + integral[b * stride + a];
  return sum / ((c - a) * (d - b));
}
function normalizedField(raw, mask, minContrast) {
  const samples = [];
  for (let i = 0; i < raw.length; i += 4) {
    if (mask[i]) samples.push(raw[i]);
  }
  if (samples.length < 120) return new Float32Array(raw.length);
  samples.sort((a, b) => a - b);
  const low = quantile(samples, 0.55);
  const high = quantile(samples, 0.98);
  const output = new Float32Array(raw.length);
  if (high - low < minContrast) return output;
  const divisor = high - low;
  for (let i = 0; i < raw.length; i++) {
    output[i] = mask[i] ? clamp((raw[i] - low) / divisor) : 0;
  }
  return output;
}
function buildFields(imagePixels, width, height, segmentation) {
  const count = width * height;
  const mask = new Uint8Array(count);
  const lum = new Float32Array(count);
  const red = new Float32Array(count);
  const shine = new Float32Array(count);
  let skinCount = 0;
  for (let y = 0; y < height; y++) {
    const sy = Math.min(segmentation.height - 1, Math.floor(y * segmentation.height / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(segmentation.width - 1, Math.floor(x * segmentation.width / width));
      const i = y * width + x;
      // MediaPipe SelfieMulticlass: class 3 = face-skin, not body-skin.
      const isSkin = segmentation.labels[sy * segmentation.width + sx] === 3;
      mask[i] = isSkin ? 1 : 0;
      if (isSkin) skinCount += 1;
      const r = imagePixels[i * 4];
      const g = imagePixels[i * 4 + 1];
      const b = imagePixels[i * 4 + 2];
      lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      red[i] = r - (0.6 * g + 0.4 * b);
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      shine[i] = lum[i] - spread * 0.28;
    }
  }
  if (skinCount < count * 0.02) {
    throw new Error("피부 영역이 충분하지 않습니다. 정면 얼굴 사진을 사용해 주세요.");
  }
  const integral = buildIntegral(lum, width, height);
  const pores = new Float32Array(count);
  const tone = new Float32Array(count);
  const texture = new Float32Array(count);
  const blemish = new Float32Array(count);
  let redSum = 0;
  for (let i = 0; i < count; i++) if (mask[i]) redSum += red[i];
  const redAverage = redSum / skinCount;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const small = squareMean(integral, width, height, x, y, 3);
      const large = squareMean(integral, width, height, x, y, 12);
      const dark = Math.max(0, small - lum[i]);
      pores[i] = dark;
      tone[i] = Math.abs(lum[i] - large);
      const xDiff = Math.abs(lum[i - 1] - lum[i + 1]);
      const yDiff = Math.abs(lum[i - width] - lum[i + width]);
      texture[i] = (xDiff + yDiff) / 2;
      blemish[i] = Math.max(0, red[i] - redAverage) * 0.7 + dark * 0.7 + texture[i] * 0.2;
    }
  }
  const raw = { redness: red, shine, pores, tone, blemish, texture };
  const floors = { redness: 5, shine: 12, pores: 5, tone: 8, blemish: 8, texture: 7 };
  const maps = {};
  for (const key of Object.keys(raw)) {
    maps[key] = normalizedField(raw[key], mask, floors[key]);
  }
  return { mask, maps, width, height, skinCount };
}
function drawMesh(context, points, width, height, sdk) {
  const outline = sdk?.FaceLandmarker?.FACE_LANDMARKS_FACE_OVAL || [];
  context.lineWidth = Math.max(1.2, width / 350);
  context.strokeStyle = "rgba(167,244,225,0.85)";
  context.shadowColor = "rgba(124,239,223,.5)";
  context.shadowBlur = 8;
  context.beginPath();
  for (const edge of outline) {
    const a = points[edge.start];
    const b = points[edge.end];
    if (!a || !b) continue;
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
  }
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "rgba(183,255,239,.65)";
  for (let i = 0; i < points.length; i += 4) {
    const point = points[i];
    context.beginPath();
    context.arc(point.x * width, point.y * height, 1, 0, Math.PI * 2);
    context.fill();
  }
}
function renderOverlay() {
  clearCanvas();
  if (!state.face) return;
  const canvas = $("overlay");
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d");
  if (state.mode === "mesh") {
    drawMesh(context, state.face, width, height, state.processors?.sdk);
    return;
  }
  if (!hasSkin()) return;
  const field = state.fields.maps[state.mode];
  const mask = state.fields.mask;
  const color = COLORS[state.mode];
  if (!field || !color) return;
  const output = context.createImageData(width, height);
  const threshold = state.sensitivity / 100;
  for (let i = 0; i < field.length; i++) {
    if (!mask[i] || field[i] <= threshold) continue;
    const strength = clamp((field[i] - threshold) / (1 - threshold));
    output.data[i * 4] = color[0];
    output.data[i * 4 + 1] = color[1];
    output.data[i * 4 + 2] = color[2];
    output.data[i * 4 + 3] = Math.round(55 + 165 * strength);
  }
  context.putImageData(output, 0, 0);
}
async function analyzeFile(file) {
  const generation = ++state.generation;
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    setStatus("JPEG · PNG · WEBP 이미지만 지원합니다.", "error");
    return;
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    setStatus("12MB 이하의 정상 이미지 파일을 선택해 주세요.", "error");
    return;
  }
  clearPrevious();
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  const url = URL.createObjectURL(file);
  state.photoUrl = url;
  const photo = $("photo");
  photo.src = url;
  $("empty").classList.add("hidden");
  $("photoWrap").classList.remove("hidden");
  setStatus("사진 불러오는 중…");
  setFaceMessage("얼굴 좌표 계산 전");
  try {
    await photo.decode();
    if (generation !== state.generation) return;
    if (!photo.naturalWidth || !photo.naturalHeight) throw new Error("이미지 크기를 확인하지 못했습니다.");
    const scale = Math.min(1, MAX_SIDE / Math.max(photo.naturalWidth, photo.naturalHeight));
    const width = Math.max(1, Math.round(photo.naturalWidth * scale));
    const height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const canvas = $("overlay");
    canvas.width = width;
    canvas.height = height;
    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = width;
    imageCanvas.height = height;
    const imageContext = imageCanvas.getContext("2d", { willReadFrequently: true });
    imageContext.drawImage(photo, 0, 0, width, height);
    $("imageDimension").textContent = width + " × " + height + " analysis";
    animateScan();
    setStatus("MediaPipe 모델 불러오는 중…");
    const processors = await getProcessors();
    if (generation !== state.generation) return;
    setStatus("얼굴 랜드마크 감지 중…");
    const faceResult = processors.face.detect(imageCanvas);
    if (generation !== state.generation) return;
    if (faceResult.faceLandmarks.length !== 1 || !faceResult.faceLandmarks[0]?.length) {
      throw new Error("얼굴이 하나만 보이는 선명한 정면 사진을 사용해 주세요.");
    }
    state.face = faceResult.faceLandmarks[0];
    setFaceMessage("랜드마크 " + state.face.length + "개 확인");
    renderOverlay();
    if (!processors.skin) {
      setStatus("얼굴 스캔 완료 · 피부 마스크 모델 로딩 실패", "error");
      setCurrentDescription();
      return;
    }
    setStatus("피부 영역과 시각 특징 계산 중…");
    const segmentResult = processors.skin.segment(imageCanvas);
    const categoryMask = segmentResult.categoryMask;
    if (!categoryMask) throw new Error("피부 영역 마스크가 없습니다.");
    const segmentation = {
      width: categoryMask.width,
      height: categoryMask.height,
      labels: new Uint8Array(categoryMask.getAsUint8Array())
    };
    segmentResult.close?.();
    state.skin = segmentation;
    const imageData = imageContext.getImageData(0, 0, width, height);
    state.fields = buildFields(imageData.data, width, height, segmentation);
    if (generation !== state.generation) return;
    setStatus("영상 특징 분석 완료 · 실험용 결과", "ok");
    setFaceMessage("얼굴 피부 마스크 확인");
    renderOverlay();
    setCurrentDescription();
  } catch (error) {
    if (generation !== state.generation) return;
    const message = typeof error?.message === "string" ? error.message : "알 수 없는 오류";
    setStatus("분석 실패: " + message.slice(0, 150), "error");
    setFaceMessage(state.face ? "얼굴만 분석됨" : "분석되지 않음");
    clearCanvas();
    setCurrentDescription();
    // Deliberately no synthetic/fake heatmap on ML failure.
  }
}
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.setAttribute("aria-pressed", String(button.dataset.mode === "mesh"));
  button.addEventListener("click", () => selectMode(button.dataset.mode));
});
$("chooseButton").addEventListener("click", () => $("photoInput").click());
$("cameraButton").addEventListener("click", () => $("cameraInput").click());
$("photoInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) void analyzeFile(file);
});
$("cameraInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) void analyzeFile(file);
});
$("threshold").addEventListener("input", (event) => {
  state.sensitivity = Number(event.target.value);
  $("thresholdText").textContent = state.sensitivity < 40 ? "높음" : state.sensitivity < 65 ? "보통" : "낮음";
  renderOverlay();
});
window.addEventListener("pagehide", () => {
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
});
setCurrentDescription();
