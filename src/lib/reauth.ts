import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { failure } from "@/lib/api";
import { reauthMethod } from "@/lib/domain/export";

// Re-authentication untuk tindakan berisiko (ekspor, penghapusan akun), SRS §11.
export function authMethod(user: User) {
  const meta = user.app_metadata as { providers?: string[]; provider?: string } | undefined;
  const providers = meta?.providers ?? [meta?.provider ?? "email"];
  return reauthMethod({ providers, lastSignInAt: user.last_sign_in_at ?? null });
}

// Kembalikan respons gagal bila verifikasi tidak lolos, atau null bila lolos.
export async function requireReauth(user: User, body: Record<string, unknown> | null) {
  const method = authMethod(user);
  if (method === "relogin_required")
    return failure("REAUTH_REQUIRED", "Demi keamanan, masuk ulang dengan Google lalu ulangi.", 401);
  if (method === "recent_login") return null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password)
    return failure("VALIDATION_ERROR", "Masukkan password untuk melanjutkan.", 422, { password: "Wajib diisi." });
  // Verifikasi lewat sesi terpisah yang langsung dicabut; sesi pengguna tidak berubah.
  const check = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await check.auth.signInWithPassword({ email: user.email!, password });
  if (error)
    return failure("INVALID_CREDENTIALS", "Password tidak sesuai.", 401, { password: "Password tidak sesuai." });
  await check.auth.signOut({ scope: "local" });
  return null;
}
