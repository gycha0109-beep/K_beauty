export const ROUTINE_POLICY_VERSION = "routine-policy-v1";

const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const SENSITIVE_AXES = new Set(["barrier", "redness", "acne", "dehydration"]);

function text(value) {
  return String(value || "").normalize("NFKC").trim();
}

function number(value) {
  const parsed = Number(value);
 