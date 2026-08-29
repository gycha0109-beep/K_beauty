import type { NativeDetectedFace } from "../../modules/bejewely-face-guide/src/BejewelyFaceGuideModule";

export type NativeFaceGuidanceState =
  | "loading"
  | "no_face"
  | "multiple_faces"
  | "too_far"
  | "too_close"
  | "off_center"
  | "not_frontal"
  | "stabilizing"
  | "ready"
  | "unavailable";

export type NativeFaceGuidanceRect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

type NativeFaceGuidanceInput = Readonly<{
  faces: readonly NativeDetectedFace[];
  imageWidth: number;
  imageHeight: number;
  previewRect: NativeFaceGuidanceRect;
  guideRect: NativeFaceGuidanceRect;
  mirrored?: boolean;
}>;

export type NativeFaceGuidanceEvaluation = Readonly<{
  state: Exclude<NativeFaceGuidanceState, "loading" | "stabilizing">;
  metrics?: Readonly<{
    centerOffsetX: number;
    centerOffsetY: number;
    faceHeightRatio: number;
    faceWidthRatio: number;
    pitchDegrees: number;
    rollDegrees: number;
    yawDegrees: number;
  }>;
}>;

const THRESHOLDS = Object.freeze({
  centerOffsetX: 0.1,
  centerOffsetY: 0.1,
  maxFaceHeightRatio: 1.08,
  maxFaceWidthRatio: 1.04,
  maxPitchDegrees: 14,
  maxRollDegrees: 10,
  maxYawDegrees: 14,
  minFaceHeightRatio: 0.66,
  minFaceWidthRatio: 0.61
});

function mapImagePointToCoverFrame(
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
  previewRect: NativeFaceGuidanceRect,
  mirrored: boolean
) {
  const scale = Math.max(previewRect.width / imageWidth, previewRect.height / imageHeight);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  const offsetX = previewRect.left + (previewRect.width - renderedWidth) / 2;
  const offsetY = previewRect.top + (previewRect.height - renderedHeight) / 2;
  const rawX = offsetX + x * scale;
  const mappedX = mirrored
    ? previewRect.left + previewRect.width - (rawX - previewRect.left)
    : rawX;

  return {
    x: mappedX,
    y: offsetY + y * scale
  };
}

function mapBoundingBox(
  face: NativeDetectedFace,
  imageWidth: number,
  imageHeight: number,
  previewRect: NativeFaceGuidanceRect,
  mirrored: boolean
) {
  const first = mapImagePointToCoverFrame(
    face.boundingBox.left,
    face.boundingBox.top,
    imageWidth,
    imageHeight,
    previewRect,
    mirrored
  );
  const second = mapImagePointToCoverFrame(
    face.boundingBox.right,
    face.boundingBox.bottom,
    imageWidth,
    imageHeight,
    previewRect,
    mirrored
  );
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const bottom = Math.max(first.y, second.y);

  return {
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    height: bottom - top,
    width: right - left
  };
}

export function evaluateNativeFaceGuidance({
  faces,
  imageWidth,
  imageHeight,
  previewRect,
  guideRect,
  mirrored = true
}: NativeFaceGuidanceInput): NativeFaceGuidanceEvaluation {
  if (faces.length === 0) {
    return { state: "no_face" };
  }

  if (faces.length > 1) {
    return { state: "multiple_faces" };
  }

  const face = faces[0];
  if (
    !face ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    previewRect.width <= 0 ||
    previewRect.height <= 0 ||
    guideRect.width <= 0 ||
    guideRect.height <= 0
  ) {
    return { state: "unavailable" };
  }

  const bounds = mapBoundingBox(face, imageWidth, imageHeight, previewRect, mirrored);
  const faceWidthRatio = bounds.width / guideRect.width;
  const faceHeightRatio = bounds.height / guideRect.height;
  const centerOffsetX =
    (bounds.centerX - (guideRect.left + guideRect.width / 2)) / guideRect.width;
  const centerOffsetY =
    (bounds.centerY - (guideRect.top + guideRect.height / 2)) / guideRect.height;
  const metrics = {
    centerOffsetX,
    centerOffsetY,
    faceHeightRatio,
    faceWidthRatio,
    pitchDegrees: face.headEulerAngleX,
    rollDegrees: face.headEulerAngleZ,
    yawDegrees: face.headEulerAngleY
  };

  if (
    faceWidthRatio < THRESHOLDS.minFaceWidthRatio ||
    faceHeightRatio < THRESHOLDS.minFaceHeightRatio
  ) {
    return { metrics, state: "too_far" };
  }

  if (
    faceWidthRatio > THRESHOLDS.maxFaceWidthRatio ||
    faceHeightRatio > THRESHOLDS.maxFaceHeightRatio
  ) {
    return { metrics, state: "too_close" };
  }

  if (
    Math.abs(centerOffsetX) > THRESHOLDS.centerOffsetX ||
    Math.abs(centerOffsetY) > THRESHOLDS.centerOffsetY
  ) {
    return { metrics, state: "off_center" };
  }

  if (
    Math.abs(face.headEulerAngleX) > THRESHOLDS.maxPitchDegrees ||
    Math.abs(face.headEulerAngleY) > THRESHOLDS.maxYawDegrees ||
    Math.abs(face.headEulerAngleZ) > THRESHOLDS.maxRollDegrees
  ) {
    return { metrics, state: "not_frontal" };
  }

  return { metrics, state: "ready" };
}

export const NATIVE_FACE_GUIDANCE_SAMPLE_INTERVAL_MS = 1400;
export const NATIVE_FACE_GUIDANCE_STABLE_SAMPLES = 2;
export const NATIVE_FACE_GUIDANCE_THRESHOLDS = THRESHOLDS;
