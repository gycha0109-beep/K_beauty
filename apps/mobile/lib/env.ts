export const MOBILE_PUBLIC_ENV_KEYS = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY"
] as const;

export type MobilePublicEnv = {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type MobileSupabasePublicEnv = Pick<MobilePublicEnv, "supabaseUrl" | "supabaseAnonKey">;

const LOCAL_ONLY_HOSTNAMES = new Set(["localhost", "127.0.0.1", "10.0.2.2"]);

function requirePublicValue(name: (typeof MOBILE_PUBLIC_ENV_KEYS)[number], value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing mobile public environment value: ${name}`);
  }
  return normalized;
}

function requireHttpUrl(name: string, value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use http or https`);
  }
  return url;
}

export function getMobileApiBaseUrl() {
  const apiBaseUrl = requirePublicValue("EXPO_PUBLIC_API_BASE_URL", process.env.EXPO_PUBLIC_API_BASE_URL);
  const apiUrl = requireHttpUrl("EXPO_PUBLIC_API_BASE_URL", apiBaseUrl);

  if (process.env.NODE_ENV === "production" && LOCAL_ONLY_HOSTNAMES.has(apiUrl.hostname)) {
    throw new Error("Production mobile API base URL cannot target a local-only hostname");
  }

  return apiUrl.toString().replace(/\/$/, "");
}

export function getMobileSupabasePublicEnv(): MobileSupabasePublicEnv {
  const supabaseUrl = requirePublicValue("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requirePublicValue(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

  requireHttpUrl("EXPO_PUBLIC_SUPABASE_URL", supabaseUrl);

  return {
    supabaseUrl,
    supabaseAnonKey
  };
}

export function getMobilePublicEnv(): MobilePublicEnv {
  const { supabaseUrl, supabaseAnonKey } = getMobileSupabasePublicEnv();

  return {
    apiBaseUrl: getMobileApiBaseUrl(),
    supabaseUrl,
    supabaseAnonKey
  };
}
