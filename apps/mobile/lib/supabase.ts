import { AppState } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { GoTrueClient } from "@supabase/auth-js";
import { getMobileSupabasePublicEnv } from "./env";

const LEGACY_STORAGE_FILE_PREFIX = "bejewely-supabase-";
const SECURE_STORAGE_PREFIX = "bejewely.auth.";
const SECURE_STORE_CHUNK_SIZE = 400;
const SECURE_STORE_MAX_CHUNKS = 256;
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

type SecureManifest = {
  generation: number;
  chunks: number;
};

const storageQueues = new Map<string, Promise<unknown>>();

function sanitizeStorageKey(key: string) {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getLegacyStorageUri(key: string) {
  if (!FileSystem.documentDirectory) {
    throw new Error("Mobile document storage is unavailable");
  }

  return `${FileSystem.documentDirectory}${LEGACY_STORAGE_FILE_PREFIX}${sanitizeStorageKey(key)}.json`;
}

function getSecureBaseKey(key: string) {
  return `${SECURE_STORAGE_PREFIX}${sanitizeStorageKey(key)}`;
}

function getManifestKey(baseKey: string) {
  return `${baseKey}.manifest`;
}

function getChunkKey(baseKey: string, generation: number, index: number) {
  return `${baseKey}.g${generation}.${index}`;
}

function parseManifest(value: string | null): SecureManifest | null {
  if (!value) {
    return null;
  }

  const match = /^v1:(\d+):(\d+)$/.exec(value);

  if (!match) {
    return null;
  }

  const generation = Number(match[1]);
  const chunks = Number(match[2]);

  if (
    !Number.isSafeInteger(generation) ||
    generation < 1 ||
    !Number.isSafeInteger(chunks) ||
    chunks < 1 ||
    chunks > SECURE_STORE_MAX_CHUNKS
  ) {
    return null;
  }

  return { generation, chunks };
}

function splitSecureStoreValue(value: string) {
  const codePoints = Array.from(value);
  const chunks: string[] = [];

  for (let index = 0; index < codePoints.length; index += SECURE_STORE_CHUNK_SIZE) {
    chunks.push(codePoints.slice(index, index + SECURE_STORE_CHUNK_SIZE).join(""));
  }

  if (chunks.length === 0) {
    chunks.push("");
  }

  if (chunks.length > SECURE_STORE_MAX_CHUNKS) {
    throw new Error("Mobile auth session exceeds secure storage capacity");
  }

  return chunks;
}

function withStorageQueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = storageQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  storageQueues.set(key, current);

  return current.finally(() => {
    if (storageQueues.get(key) === current) {
      storageQueues.delete(key);
    }
  });
}

async function deleteSecureGeneration(baseKey: string, manifest: SecureManifest) {
  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(
        getChunkKey(baseKey, manifest.generation, index),
        SECURE_STORE_OPTIONS
      )
    )
  );
}

async function readSecureValue(key: string) {
  const baseKey = getSecureBaseKey(key);
  const manifestKey = getManifestKey(baseKey);
  const manifestValue = await SecureStore.getItemAsync(manifestKey, SECURE_STORE_OPTIONS);
  const manifest = parseManifest(manifestValue);

  if (!manifest) {
    if (manifestValue) {
      await SecureStore.deleteItemAsync(manifestKey, SECURE_STORE_OPTIONS);
    }
    return null;
  }

  const chunks = await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) =>
      SecureStore.getItemAsync(
        getChunkKey(baseKey, manifest.generation, index),
        SECURE_STORE_OPTIONS
      )
    )
  );

  if (chunks.some((chunk) => chunk === null)) {
    await deleteSecureGeneration(baseKey, manifest).catch(() => undefined);
    await SecureStore.deleteItemAsync(manifestKey, SECURE_STORE_OPTIONS).catch(() => undefined);
    return null;
  }

  return (chunks as string[]).join("");
}

async function writeSecureValue(key: string, value: string) {
  const baseKey = getSecureBaseKey(key);
  const manifestKey = getManifestKey(baseKey);
  const oldManifest = parseManifest(
    await SecureStore.getItemAsync(manifestKey, SECURE_STORE_OPTIONS)
  );
  const chunks = splitSecureStoreValue(value);
  const generation =
    oldManifest && oldManifest.generation < Number.MAX_SAFE_INTEGER
      ? oldManifest.generation + 1
      : 1;

  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(
        getChunkKey(baseKey, generation, index),
        chunk,
        SECURE_STORE_OPTIONS
      )
    )
  );

  await SecureStore.setItemAsync(
    manifestKey,
    `v1:${generation}:${chunks.length}`,
    SECURE_STORE_OPTIONS
  );

  if (oldManifest && oldManifest.generation !== generation) {
    await deleteSecureGeneration(baseKey, oldManifest).catch(() => undefined);
  }
}

async function removeSecureValue(key: string) {
  const baseKey = getSecureBaseKey(key);
  const manifestKey = getManifestKey(baseKey);
  const manifest = parseManifest(
    await SecureStore.getItemAsync(manifestKey, SECURE_STORE_OPTIONS)
  );

  if (manifest) {
    await deleteSecureGeneration(baseKey, manifest).catch(() => undefined);
  }

  await SecureStore.deleteItemAsync(manifestKey, SECURE_STORE_OPTIONS);
}

const nativeSessionStorage = {
  async getItem(key: string) {
    return withStorageQueue(key, async () => {
      const secureValue = await readSecureValue(key);

      if (secureValue !== null) {
        return secureValue;
      }

      const legacyUri = getLegacyStorageUri(key);
      const legacyInfo = await FileSystem.getInfoAsync(legacyUri);

      if (!legacyInfo.exists) {
        return null;
      }

      const legacyValue = await FileSystem.readAsStringAsync(legacyUri, {
        encoding: FileSystem.EncodingType.UTF8
      });

      await writeSecureValue(key, legacyValue);
      await FileSystem.deleteAsync(legacyUri, { idempotent: true });
      return legacyValue;
    });
  },
  async setItem(key: string, value: string) {
    await withStorageQueue(key, async () => {
      await writeSecureValue(key, value);
      await FileSystem.deleteAsync(getLegacyStorageUri(key), { idempotent: true });
    });
  },
  async removeItem(key: string) {
    await withStorageQueue(key, async () => {
      await removeSecureValue(key);
      await FileSystem.deleteAsync(getLegacyStorageUri(key), { idempotent: true });
    });
  }
};

type MobileSupabaseAuthClient = {
  auth: GoTrueClient;
};

let mobileSupabaseClient: MobileSupabaseAuthClient | null | undefined;
let appStateSubscription: { remove: () => void } | null = null;

export function getMobileSupabaseClient() {
  if (mobileSupabaseClient !== undefined) {
    return mobileSupabaseClient;
  }

  try {
    const { supabaseUrl, supabaseAnonKey } = getMobileSupabasePublicEnv();
    const auth = new GoTrueClient({
      url: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      },
      storageKey: "bejewely-native-auth",
      storage: nativeSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce"
    });

    mobileSupabaseClient = { auth };

    if (!appStateSubscription) {
      if (AppState.currentState === "active") {
        auth.startAutoRefresh();
      }

      appStateSubscription = AppState.addEventListener("change", (state) => {
        const currentAuth = mobileSupabaseClient?.auth;

        if (!currentAuth) {
          return;
        }

        if (state === "active") {
          currentAuth.startAutoRefresh();
        } else {
          currentAuth.stopAutoRefresh();
        }
      });
    }
  } catch {
    mobileSupabaseClient = null;
  }

  return mobileSupabaseClient;
}
