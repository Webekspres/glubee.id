import "server-only";

import { createClient } from "@supabase/supabase-js";

// Isi akun demo milik Webekspres dengan profil, persetujuan, dan 14 hari catatan
// sintetis. Berjalan SEBAGAI akun demo itu (bukan service role), lewat RPC yang
// sama dengan aplikasi, sehingga RLS dan validasi tetap berlaku.
const FASTING = [104, 98, 112, 109, 101, 116, 95, 107, 113, 102, 119, 111, 99, 106];
const AFTER_MEAL = [162, 149, 171, 138, 155, 144, 167, 152, 141, 176, 158, 147, 136, 160];

export async function seedDemoAccount(email: string, password: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: session, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !session.user) throw new Error("demo_sign_in_failed");
  for (const type of ["age_and_region", "legal_documents", "health_data"]) {
    const { error: consentError } = await client.rpc("record_consent", {
      p_type: type,
      p_decision: "accept",
      p_method: "onboarding",
    });
    if (consentError) throw new Error("demo_consent_failed");
  }
  const { error: profileError } = await client
    .from("profiles")
    .update({ name: "Demo Glubee", birth_date: "1968-05-12", sex: "female", timezone_code: "WIB" })
    .eq("user_id", session.user.id);
  if (profileError) throw new Error("demo_profile_failed");
  await client.rpc("refresh_my_account_status");

  const now = new Date();
  let saved = 0;
  for (let day = 13; day >= 0; day--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - day);
    const at = (h: number, m: number) =>
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m));
    // 07.15 dan 13.30 WIB.
    for (const [value, context, time] of [
      [FASTING[13 - day], "fasting", at(0, 15)],
      [AFTER_MEAL[13 - day], "after_meal", at(6, 30)],
    ] as const) {
      if (time > now) continue;
      const { error: entryError } = await client.rpc("create_glucose_entry", {
        p_idempotency_key: crypto.randomUUID(),
        p_original_value: value,
        p_original_unit: "mg/dL",
        p_measurement_context: context,
        p_measured_at: time.toISOString(),
        p_note: null,
      });
      if (entryError) throw new Error("demo_entry_failed");
      saved++;
    }
  }
  await client.auth.signOut();
  return saved;
}
