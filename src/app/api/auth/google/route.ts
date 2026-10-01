import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { createSupabaseServerClient, setRememberPreference } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Pilihan "Ingat saya" dibawa lewat query dan dipakai saat callback membuat sesi.
  await setRememberPreference(new URL(request.url).searchParams.get("remember") === "1");
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
