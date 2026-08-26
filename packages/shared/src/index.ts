export const SUPPORTED_LOCALES = ["ko", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const FACE_CAPTURE_STATES = [
  "loading",
  "no_face",
  "multiple_faces",
  "not_frontal",
  "off_center",
  "too_close",
  "too_far",
  "stabilizing",
  "ready",
  "unavailable"
] as const;

export type FaceCaptureState = (typeof FACE_CAPTURE_STATES)[number];
