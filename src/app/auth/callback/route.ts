import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const intent = url.searchParams.get("intent");
  const requestedNext = url.searchParams.get("next") ?? "/?onboarding=required";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/?onboarding=required";

  if (!code) return NextResponse.redirect(new URL("/?authError=invalid_callback", url.origin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/?authError=invalid_or_expired_code", url.origin));

  if (intent) {
    const { error: intentError } = await supabase.rpc("consume_registration_intent", { p_nonce: intent });
    if (intentError) return NextResponse.redirect(new URL("/?authError=invalid_registration_intent", url.origin));
  } else {
    await supabase.rpc("refresh_my_account_status");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
