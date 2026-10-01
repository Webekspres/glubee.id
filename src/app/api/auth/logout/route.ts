import { failure, success } from "@/lib/api";
import { createSupabaseServerClient, setRememberPreference } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  await setRememberPreference(false);
  return error ? failure("LOGOUT_FAILED", "Sesi belum dapat diakhiri.", 503) : success({ signedOut: true });
}
