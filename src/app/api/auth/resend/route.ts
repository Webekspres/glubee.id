import { appUrl } from "@/lib/config";
import { objectValue, readJson, success } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const body = objectValue(await readJson(request));
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (/^\S+@\S+\.\S+$/.test(email) && email.length <= 254) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: new URL(
          "/auth/callback?next=/onboarding",
          appUrl(),
        ).toString(),
      },
    });
  }
  return success(
    {
      message:
        "Jika akun memerlukan verifikasi, tautan baru telah dikirim. Buka di browser yang sama.",
    },
    202,
  );
}
