import { AppState } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { GoTrueClient } from "@supabase/auth-js";
import { getMobileSupabasePublicEnv } from "./env";

const STORAGE_FILE_PREFIX = "bejewely-supabase-";

function getStorageUri(key: string) {
  if (!FileSystem.documentDirectory) {
    throw new Error("Mobile document storage is unavailable");
  }

  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${FileSystem.documentDirectory}${STORAGE_FILE_PREFIX}${safeKey}.json`;
}

const nativeSessionStorage = {
  async getItem(key: string) {
    const uri = getStorageUri(key);
    const info = await FileSystem.getInfoAsync(uri);

    if (!info.exists) {
      return null;
    }

    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8
    });
  },
  async setItem(key: string, value: string) {
    await FileSystem.writeAsStringAsync(getStorageUri(key), value, {
      encoding: FileSystem.EncodingType.UTF8
    });
  },
  async removeItem(key: string) {
    await FileSystem.deleteAsync(getStorageUri(key), { idempotent: true });
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
