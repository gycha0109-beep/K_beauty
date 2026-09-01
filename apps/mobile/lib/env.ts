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

function requireProductionTransport(name: string, url: URL) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https in production`);
  }

  if (LOCAL_ONLY_HOSTNAMES.has(url.hostname)) {
    throw new Error(`${name} cannot target a local-only hostname in production`);
  }
}

export function getMobileApiBaseUrl() {
  const apiBaseUrl = requirePublicValue("EXPO_PUBLIC_API_BASE_URL", process.env.EXPO_PUBLIC_API_BASE_URL);
  const apiUrl = requireHttpUrl("EXPO_PUBLIC_API_BASE_URL", apiBaseUrl);

  requireProductionTransport("EXPO_PUBLIC_API_BASE_URL", apiUrl);

  return apiUrl.toString().replace(/\/$/, "");
}

export function getMobileSupabasePublicEnv(): MobileSupabasePublicEnv {
  const supabaseUrl = requirePublicValue("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requirePublicValue(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
  const parsedSupabaseUrl = requireHttpUrl("EXPO_PUBLIC_SUPABASE_URL", supabaseUrl);

  requireProductionTransport("EXPO_PUBLIC_SUPABASE_URL", parsedSupabaseUrl);

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
