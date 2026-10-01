import { createClient } from "@supabase/supabase-js";
import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, objectValue, readJson, success } from "@/lib/api";
import { exportFileName, reauthMethod } from "@/lib/domain/export";
import type { Timezone } from "@/lib/ui";

function authMethod(user: { app_metadata?: { providers?: string[]; provider?: string }; last_sign_in_at?: string | null }) {
  const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider ?? "email"];
  return reauthMethod({ providers, lastSignInAt: user.last_sign_in_at ?? null });
}

// Cara verifikasi yang berlaku untuk akun ini, agar UI tahu perlu password atau tidak.
export async function GET() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  return success({ method: authMethod(auth.user) });
}

// GLB-023 / FR-EXPORT-001: unduh semua data milik sendiri sebagai JSON setelah
// re-authentication. Tidak ada file yang disimpan di server.
export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "account.export", 5))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi dalam satu menit.", 429);

  const body = objectValue(await readJson(request));
  const method = authMethod(auth.user);

  if (method === "relogin_required")
    return failure("REAUTH_REQUIRED", "Demi keamanan, masuk ulang dengan Google lalu unduh lagi.", 401);
  if (method === "password") {
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password)
      return failure("VALIDATION_ERROR", "Masukkan password untuk melanjutkan.", 422, { password: "Wajib diisi." });
    // Verifikasi lewat sesi terpisah yang langsung dicabut; sesi pengguna tidak berubah.
    const check = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await check.auth.signInWithPassword({ email: auth.user.email!, password });
    if (error)
      return failure("INVALID_CREDENTIALS", "Password tidak sesuai.", 401, { password: "Password tidak sesuai." });
    await check.auth.signOut({ scope: "local" });
  }

  const { data, error } = await auth.supabase.rpc("export_my_data");
  if (error)
    return error.message?.includes("export_not_allowed")
      ? failure("EXPORT_NOT_ALLOWED", "Ekspor tidak tersedia untuk status akun ini.", 403)
      : failure("EXPORT_FAILED", "Ekspor belum dapat dibuat. Coba lagi.", 500);

  const zone = ((data as { account?: { timezone?: string } })?.account?.timezone ?? "WIB") as Timezone;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(new Date(), zone)}"`,
      "Cache-Control": "no-store",
    },
  });
}
