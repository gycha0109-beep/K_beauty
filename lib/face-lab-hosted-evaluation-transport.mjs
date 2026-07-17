const RETRYABLE_5XX = new Set([502, 503, 504]);
const TERMINAL_CLIENT = new Set([400, 401, 403, 404, 413, 415, 422]);

export function parseSafeInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer from