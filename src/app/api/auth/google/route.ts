import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const callback = new URL(
    "/auth/callback?next=/onboarding",
    appUrl(),
  ).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback },
  });
  return error || !data.url
    ? NextResponse.redirect(
        new URL("/login?authError=google_unavailable", appUrl()),
      )
    : NextResponse.redirect(data.url);
}
