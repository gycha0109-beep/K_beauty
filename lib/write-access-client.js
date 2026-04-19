export const WRITE_ACCESS_SESSION_KEY = "skinTestWriteAccessToken";

export function readWriteAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(WRITE_ACCESS_SESSION_KEY);
}

export function writeWriteAccessToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof token === "string" && token) {
    sessionStorage.setItem(WRITE_ACCESS_SESSION_KEY, token);
    return;
  }

  sessionStorage.removeItem(WRITE_ACCESS_SESSION_KEY);
}

export function clearWriteAccessToken() {
  writeWriteAccessToken(null);
}
