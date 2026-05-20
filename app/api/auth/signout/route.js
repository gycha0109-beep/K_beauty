import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function signOut(request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/", request.url));
}

export async function GET(request) {
  return signOut(request);
}

export async function POST(request) {
  return signOut(request);
}
