const FACE_OVAL_INDICES = Object.freeze([
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
  379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234,
  127, 162, 21, 54, 103, 67, 109
]);

const LANDMARK = Object.freeze({
  chin: 152,
  leftCheek: 234,
  leftEyeOuter: 33,
  noseTip: 1,
  rightCheek: 454,
  rightEyeOuter: 263
});

export const FACE_GUIDE_STATE = Object.freeze({
  loading: "loading",
  multipleFaces: "multiple_faces",
  noFace: "no_face",
  notFrontal: "not_frontal",
  offCenter: "off_center",
  ready: "ready",
  stabilizing: "stabilizing",
  tooClose: "too_close",
  tooFar: "too_far",
  unavailable: "unavailable"
});

export const FACE_GUIDE_EVALUATION_MODE = Object.freeze({
  enter: "enter",
  maintain: "maintain"
});

const ENTRY_THRESHOLDS = Object.freeze({
  centerOffsetX: 0.075,
  centerOffsetY: 0.075,
  containmentRatio: 0.93,
  maxFaceHeightRatio: 1,
  maxFaceWidthRatio: 0.98,
  maxPitchRatio: 0.62,
  maxRollDegrees: 9,
  minFaceHeightRatio: 0.7,
  minFaceWidthRatio: 0.65,
  minPitchRatio: 0.28,
  minYawSymmetry: 0.64,
  ovalInset: 0.985
});

const MAINTAIN_THRESHOLDS = Object.freeze({
  centerOffsetX: 0.1,
  centerOffsetY: 0.1,
  containmentRatio: 0.89,
  maxFaceHeightRatio: 1.05,
  maxFaceWidthRatio: 1.04,
  maxPitchRatio: 0.67,
  maxRollDegrees: 11,
  minFaceHeightRatio: 0.66,
  minFaceWidthRatio: 0.61,
  minPitchRatio: 0.24,
  minYawSymmetry: 0.58,
  ovalInset: 0.99
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPlainRect(rect) {
  if (!rect) {
    return null;
  }

  return {
    height: Number(rect.height) || 0,
    left: Number(rect.left) || 0,
    top: Number(rect.top) || 0,
    width: Number(rect.width) || 0
  };
}

function resolveThresholds(mode, overrides) {
  const base =
    mode === FACE_GUIDE_EVALUATION_MODE.maintain
      ? MAINTAIN_THRESHOLDS
      : ENTRY_THRESHOLDS;

  return overrides ? { ...base, ...overrides } : base;
}

export function mapLandmarkToCoverFrame({
  landmark,
  mirrored = true,
  videoHeight,
  videoRect,
  videoWidth
}) {
  const rect = toPlainRect(videoRect);
  if (
    !landmark ||
    !rect ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    !videoWidth ||
    !videoHeight
  ) {
    return null;
  }

  const scale = Math.max(rect.width / videoWidth, rect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = rect.left + (rect.width - renderedWidth) / 2;
  const offsetY = rect.top + (rect.height - renderedHeight) / 2;
  const rawX = offsetX + clamp(landmark.x, 0, 1) * renderedWidth;
  const x = mirrored ? rect.left + rect.width - (rawX - rect.left) : rawX;

  return {
    x,
    y: offsetY + clamp(landmark.y, 0, 1) * renderedHeight,
    z: Number(landmark.z) || 0
  };
}

function getMappedLandmark(landmarks, index, frame) {
  return mapLandmarkToCoverFrame({
    ...frame,
    landmark: landmarks[index]
  });
}

function getBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left
  };
}

function getFrontalMetrics(landmarks, frame) {
  const leftEye = getMappedLandmark(landmarks, LANDMARK.leftEyeOuter, frame);
  const rightEye = getMappedLandmark(landmarks, LANDMARK.rightEyeOuter, frame);
  const nose = getMappedLandmark(landmarks, LANDMARK.noseTip, frame);
  const chin = getMappedLandmark(landmarks, LANDMARK.chin, frame);
  const leftCheek = getMappedLandmark(landmarks, LANDMARK.leftCheek, frame);
  const rightCheek = getMappedLandmark(landmarks, LANDMARK.rightCheek, frame);

  if (!leftEye || !rightEye || !nose || !chin || !leftCheek || !rightCheek) {
    return null;
  }

  const eyeDeltaX = Math.abs(rightEye.x - leftEye.x);
  const eyeDeltaY = Math.abs(rightEye.y - leftEye.y);
  const rollRadians = Math.atan2(eyeDeltaY, eyeDeltaX);
  const rollDegrees = (rollRadians * 180) / Math.PI;
  const leftNoseSpan = Math.abs(nose.x - leftCheek.x);
  const rightNoseSpan = Math.abs(rightCheek.x - nose.x);
  const yawSymmetry =
    Math.max(leftNoseSpan, rightNoseSpan) > 0
      ? Math.min(leftNoseSpan, rightNoseSpan) / Math.max(leftNoseSpan, rightNoseSpan)
      : 0;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const eyeToChin = chin.y - eyeMidY;
  const pitchRatio = eyeToChin > 0 ? (nose.y - eyeMidY) / eyeToChin : 0;

  return {
    pitchRatio,
    rollDegrees,
    yawSymmetry
  };
}

function isInsideEllipse(point, guideRect, inset) {
  const radiusX = (guideRect.width * inset) / 2;
  const radiusY = (guideRect.height * inset) / 2;
  const centerX = guideRect.left + guideRect.width / 2;
  const centerY = guideRect.top + guideRect.height / 2;
  const normalizedX = (point.x - centerX) / Math.max(radiusX, 1);
  const normalizedY = (point.y - centerY) / Math.max(radiusY, 1);
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

export function evaluateFaceGuide({
  faceLandmarks,
  guideRect,
  mirrored = true,
  mode = FACE_GUIDE_EVALUATION_MODE.enter,
  thresholds: thresholdOverrides,
  videoHeight,
  videoRect,
  videoWidth
}) {
  const faces = Array.isArray(faceLandmarks) ? faceLandmarks : [];
  if (faces.length === 0) {
    return { state: FACE_GUIDE_STATE.noFace };
  }

  if (faces.length > 1) {
    return { state: FACE_GUIDE_STATE.multipleFaces };
  }

  const guide = toPlainRect(guideRect);
  const video = toPlainRect(videoRect);
  const landmarks = faces[0];
  if (
    !guide ||
    !video ||
    guide.width <= 0 ||
    guide.height <= 0 ||
    !Array.isArray(landmarks) ||
    landmarks.length <= LANDMARK.rightCheek
  ) {
    return { state: FACE_GUIDE_STATE.unavailable };
  }

  const thresholds = resolveThresholds(mode, thresholdOverrides);
  const frame = {
    mirrored,
    videoHeight,
    videoRect: video,
    videoWidth
  };
  const ovalPoints = FACE_OVAL_INDICES
    .map((index) => getMappedLandmark(landmarks, index, frame))
    .filter(Boolean);

  if (ovalPoints.length < FACE_OVAL_INDICES.length * 0.8) {
    return { state: FACE_GUIDE_STATE.unavailable };
  }

  const bounds = getBounds(ovalPoints);
  const widthRatio = bounds.width / guide.width;
  const heightRatio = bounds.height / guide.height;
  const metrics = {
    centerOffsetX: (bounds.centerX - (guide.left + guide.width / 2)) / guide.width,
    centerOffsetY: (bounds.centerY - (guide.top + guide.height / 2)) / guide.height,
    heightRatio,
    mode,
    widthRatio
  };

  if (
    widthRatio < thresholds.minFaceWidthRatio ||
    heightRatio < thresholds.minFaceHeightRatio
  ) {
    return { metrics, state: FACE_GUIDE_STATE.tooFar };
  }

  if (
    widthRatio > thresholds.maxFaceWidthRatio ||
    heightRatio > thresholds.maxFaceHeightRatio
  ) {
    return { metrics, state: FACE_GUIDE_STATE.tooClose };
  }

  const containedPoints = ovalPoints.filter((point) =>
    isInsideEllipse(point, guide, thresholds.ovalInset)
  ).length;
  const containmentRatio = containedPoints / ovalPoints.length;
  metrics.containmentRatio = containmentRatio;

  if (
    Math.abs(metrics.centerOffsetX) > thresholds.centerOffsetX ||
    Math.abs(metrics.centerOffsetY) > thresholds.centerOffsetY ||
    containmentRatio < thresholds.containmentRatio
  ) {
    return { metrics, state: FACE_GUIDE_STATE.offCenter };
  }

  const frontal = getFrontalMetrics(landmarks, frame);
  if (!frontal) {
    return { metrics, state: FACE_GUIDE_STATE.unavailable };
  }

  Object.assign(metrics, frontal);
  if (
    frontal.rollDegrees > thresholds.maxRollDegrees ||
    frontal.yawSymmetry < thresholds.minYawSymmetry ||
    frontal.pitchRatio < thresholds.minPitchRatio ||
    frontal.pitchRatio > thresholds.maxPitchRatio
  ) {
    return { metrics, state: FACE_GUIDE_STATE.notFrontal };
  }

  return { metrics, state: FACE_GUIDE_STATE.ready };
}

export const FACE_GUIDE_THRESHOLDS = Object.freeze({
  enter: ENTRY_THRESHOLDS,
  maintain: MAINTAIN_THRESHOLDS
});
