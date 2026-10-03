import * as FileSystem from "expo-file-system/legacy";

const leases = new Map<string, number>();
const pending = new Set<string>();

function ownedCacheUri(value: string) {
  if (!FileSystem.cacheDirectory) return null;
  try {
    const uri = new URL(value);
    const cache = new URL(FileSystem.cacheDirectory);
    const decodedPath = decodeURIComponent(uri.pathname);
    const prefix = cache.pathname.replace(/\/$/, "") + "/";
    if (uri.protocol !== "file:" || cache.protocol !== "file:" || uri.host !== cache.host ||
      uri.search || uri.hash || !uri.pathname.startsWith(prefix) ||
      decodedPath.split(/[\\/]/).includes("..") || /%2e|%2f|%5c/i.test(decodedPath)) return null;
    return uri.href;
  } catch { return null; }
}

export async function cleanupNativePhoto(uri: string) {
  const owned = ownedCacheUri(uri);
  if (!owned) return false;
  if ((leases.get(owned) ?? 0) > 0) { pending.add(owned); return false; }
  try {
    await FileSystem.deleteAsync(owned, { idempotent: true });
    pending.delete(owned);
    return true;
  } catch { return false; }
}

/** Defer camera/unmount cleanup until the active upload has settled. */
export function retainNativePhoto(uri: string) {
  const owned = ownedCacheUri(uri);
  if (!owned) return () => {};
  leases.set(owned, (leases.get(owned) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (leases.get(owned) ?? 1) - 1;
    if (count) leases.set(owned, count); else leases.delete(owned);
    if (!count && pending.has(owned)) void cleanupNativePhoto(owned);
  };
}
