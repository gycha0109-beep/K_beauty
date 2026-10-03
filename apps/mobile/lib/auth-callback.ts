export function parseNativeAuthCode(value: string, redirect: string) {
  if (value.length > 8192) throw new Error("mobile_auth_callback_invalid");
  const url = new URL(value);
  const expected = new URL(redirect);
  if (url.protocol !== expected.protocol || url.hostname !== expected.hostname ||
    url.pathname !== expected.pathname || url.port || url.username || url.password || url.hash) {
    throw new Error("mobile_auth_callback_invalid");
  }
  const allowed = new Set(["code", "error", "error_code", "error_description"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) {
      throw new Error("mobile_auth_callback_invalid");
    }
  }
  if (url.searchParams.has("error") || url.searchParams.has("error_code")) {
    throw new Error("mobile_auth_callback_failed");
  }
  const code = url.searchParams.get("code");
  if (!code || !/^[A-Za-z0-9._~-]{1,2048}$/.test(code)) {
    throw new Error("mobile_auth_callback_missing_code");
  }
  return code;
}
