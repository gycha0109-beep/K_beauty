import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("review_database_configuration_missing");
  return value;
}

export function createReviewConfirmClient(): SupabaseClient {
  return createClient(
    requiredEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
