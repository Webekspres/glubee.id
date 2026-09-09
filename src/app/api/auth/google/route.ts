import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { failure } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const callback = new URL("/auth/callback?next=/?onboarding=required", appUrl()).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback },
  });
  return error || !data.url
    ? failure("OAUTH_UNAVAILABLE", "Login Google belum tersedia.", 503)
    : NextResponse.redirect(data.url);
}
