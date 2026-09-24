import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Redirect memakai URL publik: di server standalone request.url berisi host internal (0.0.0.0:3000).
  const origin = appUrl();
  const code = url.searchParams.get("code");
  const intent = url.searchParams.get("intent");
  const requestedNext = url.searchParams.get("next");
  const next =
    requestedNext === "/update-password" ||
    requestedNext === "/?resetPassword=required"
      ? "/update-password"
      : "/onboarding";

  if (!code)
    return NextResponse.redirect(
      new URL("/login?authError=invalid_callback", origin),
    );
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(
      new URL("/login?authError=invalid_or_expired_code", origin),
    );

  if (intent) {
    const { error: intentError } = await supabase.rpc(
      "consume_registration_intent",
      { p_nonce: intent },
    );
    if (intentError)
      return NextResponse.redirect(
        new URL(
          "/onboarding?authError=invalid_registration_intent",
          origin,
        ),
      );
  } else {
    await supabase.rpc("refresh_my_account_status");
  }

  return NextResponse.redirect(new URL(next, origin));
}
